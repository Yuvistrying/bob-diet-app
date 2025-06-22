import { auth } from "@clerk/nextjs/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../convex/_generated/api";
import { getBobSystemPrompt, buildPromptContext } from "../../../../convex/prompts";
import { createTools, detectIntent, getToolsForIntent } from "../../../../convex/tools";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Log if API key is present (without exposing it)
console.log("[stream-v2] Anthropic API key present:", !!process.env.ANTHROPIC_API_KEY);

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = await getToken({ template: "convex" });
    if (!token) throw new Error("Failed to get authentication token");
    
    convexClient.setAuth(token);

    const body = await req.json();
    const { prompt, threadId: providedThreadId, storageId } = body;
    
    console.log("[stream-v2] Request received:", {
      promptLength: prompt?.length || 0,
      hasPrompt: !!prompt,
      hasStorageId: !!storageId,
      providedThreadId
    });
    
    // 1. Get or create thread (simplified)
    const threadResult = await convexClient.mutation(api.threads.getOrCreateDailyThread, {});
    const threadId = providedThreadId || threadResult.threadId;
    
    // 2. Save user message (embedding is handled by threads.saveMessage)
    const userMessageId = await convexClient.mutation(api.threads.saveMessage, {
      threadId,
      role: "user",
      content: prompt,
      metadata: { 
        storageId: storageId || undefined
      }
    });
    
    // 3. Build context with direct queries
    const [profile, todayStats, latestWeight, preferences, pendingConfirmation, threadMessages, calibrationData] = await Promise.all([
      // User profile
      convexClient.query(api.userProfiles.getUserProfile, {}),
      // Today's food stats
      convexClient.query(api.foodLogs.getTodayStats),
      // Latest weight
      convexClient.query(api.weightLogs.getLatestWeight),
      // User preferences
      convexClient.query(api.userPreferences.getUserPreferences),
      // Pending confirmations
      convexClient.query(api.pendingConfirmations.getLatestPendingConfirmation, {
        threadId
      }),
      // Recent messages for context
      convexClient.query(api.threads.getThreadMessages, {
        threadId,
        limit: 10
      }),
      // Calibration insights
      convexClient.query(api.calibration.getLatestCalibration)
    ]);
    
    // Build coreStats object to match expected format
    const coreStats = {
      profile: profile || { name: "there", dailyCalorieTarget: 2000, proteinTarget: 150 },
      todayStats: todayStats || { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 },
      hasWeighedToday: latestWeight ? latestWeight.date === new Date().toISOString().split('T')[0] : false,
      caloriesRemaining: (profile?.dailyCalorieTarget || 2000) - (todayStats?.calories || 0)
    };
    
    // 4. Get meal type
    const hour = new Date().getHours();
    const defaultMealType = 
      hour < 11 ? "breakfast" :
      hour < 15 ? "lunch" :
      hour < 18 ? "snack" :
      "dinner";
    
    // 5. Build system prompt using centralized prompts
    const promptContext = buildPromptContext(
      coreStats.profile,
      coreStats.todayStats,
      preferences,
      calibrationData,
      pendingConfirmation ? {
        description: pendingConfirmation.confirmationData.description,
        totalCalories: pendingConfirmation.confirmationData.totalCalories,
        items: pendingConfirmation.confirmationData.items,
      } : undefined
    );
    
    let systemPrompt = getBobSystemPrompt(promptContext);
    
    // Add photo analysis instruction if storageId is present
    if (storageId) {
      systemPrompt = `${systemPrompt}\n\nThe user has uploaded a food photo. Use the analyzePhoto tool immediately to analyze it, then use confirmFood to show what you found.`;
      
      console.log("[stream-v2] Photo upload detected with storageId:", storageId);
    }
    
    // 6. Detect intents and create tools using centralized system
    const intents = detectIntent(prompt);
    const tools = createTools(
      convexClient,
      userId,
      threadId,
      storageId,
      pendingConfirmation
    );
    
    console.log("[stream-v2] Available tools:", Object.keys(tools));
    
    // 7. Stream response
    try {
      console.log("[stream-v2] Starting stream with:", {
        hasTools: Object.keys(tools).length > 0,
        toolNames: Object.keys(tools),
        messagesCount: threadMessages.length,
        systemPromptLength: systemPrompt.length,
        hasStorageId: !!storageId
      });

      // Log the actual messages being sent
      console.log("[stream-v2] Thread messages:", threadMessages.map((m: any) => ({
        role: m.role,
        contentLength: m.content?.length || 0,
        hasContent: !!m.content
      })));

      // Prepare messages - ensure we have valid content
      const messages = threadMessages.length > 0 
        ? threadMessages.map((m: any) => ({
            role: m.role,
            content: m.content || "",
          }))
        : [{
            role: "user" as const,
            content: prompt || "Please analyze this food photo"
          }];
      
      console.log("[stream-v2] Prepared messages:", messages.length);

      const result = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        maxSteps: 5,
        toolChoice: storageId ? { type: 'any' } : undefined, // Let the model decide
        onToolCall: async ({ toolCall }) => {
          console.log("[stream-v2] Tool called:", {
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            hasArgs: !!toolCall.args
          });
        },
        onFinish: async ({ text, toolCalls, usage }: any) => {
          console.log("[stream-v2] Stream finished:", { 
            hasText: !!text, 
            textLength: text?.length,
            toolCallsCount: toolCalls?.length 
          });
          
          // Only save assistant message if there's actual content
          if (text && text.trim().length > 0) {
            await convexClient.mutation(api.threads.saveMessage, {
              threadId,
              role: "assistant",
              content: text,
              toolCalls: toolCalls || [],
              metadata: {
                usage: usage ? {
                  promptTokens: usage.promptTokens || 0,
                  completionTokens: usage.completionTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                } : undefined,
              }
            });
          } else {
            console.log("[stream-v2] Skipping save of empty assistant message");
          }
        },
      });
      
      console.log("[stream-v2] Stream created successfully");
      console.log("[stream-v2] Result type:", typeof result);
      console.log("[stream-v2] Result has toDataStreamResponse:", typeof result.toDataStreamResponse);
      
      return result.toDataStreamResponse();
    } catch (streamError: any) {
      console.error("[stream-v2] Stream error:", streamError);
      console.error("[stream-v2] Stream error details:", {
        name: streamError.name,
        message: streamError.message,
        stack: streamError.stack,
        cause: streamError.cause
      });
      
      // Try to provide more specific error info
      if (streamError.message?.includes('model')) {
        console.error("[stream-v2] Model error - check if claude-sonnet-4-20250514 is available");
      }
      if (streamError.response?.data) {
        console.error("[stream-v2] API response data:", streamError.response.data);
      }
      
      // Don't throw, return error response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const errorData = JSON.stringify("Failed to process your request. Please try again.");
          controller.enqueue(encoder.encode(`3:${errorData}\n`));
          controller.close();
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
  } catch (error: any) {
    console.error("[Chat Stream V2] Error:", error.message);
    console.error("[Chat Stream V2] Full error:", error);
    console.error("[Chat Stream V2] Stack trace:", error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'An error occurred';
    
    // Log specific error details
    if (error.response) {
      console.error("[Chat Stream V2] Response error:", error.response);
    }
    if (error.code) {
      console.error("[Chat Stream V2] Error code:", error.code);
    }
    
    // Return error in proper format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send the error in the correct SSE format
        const errorData = JSON.stringify(errorMessage);
        controller.enqueue(encoder.encode(`3:${errorData}\n`));
        controller.close();
      }
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
}