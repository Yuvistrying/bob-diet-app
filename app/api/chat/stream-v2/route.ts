import { auth } from "@clerk/nextjs/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../convex/_generated/api";
import { getBobSystemPrompt, buildPromptContext } from "../../../../convex/prompts";
import { createTools, detectIntent, getToolsForIntent } from "../../../../convex/tools";
import { StreamDebugger } from "./debug";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Log if API key is present (without exposing it)
console.log("[stream-v2] Anthropic API key present:", !!process.env.ANTHROPIC_API_KEY);
console.log("[stream-v2] API key length:", process.env.ANTHROPIC_API_KEY?.length || 0);

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const debug = new StreamDebugger();
  debug.log("REQUEST_START", { method: "POST", url: req.url });
  
  try {
    debug.log("AUTH_START", {});
    
    const { userId, getToken } = await auth();
    if (!userId) {
      debug.error("AUTH_ERROR", { error: "No userId" });
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    debug.log("AUTH_USER", { userId });

    const token = await getToken({ template: "convex" });
    if (!token) {
      debug.error("AUTH_ERROR", { error: "No token" });
      console.error("[stream-v2] Failed to get Convex auth token");
      throw new Error("Failed to get authentication token");
    }
    
    debug.log("AUTH_SUCCESS", { hasToken: true });
    console.log("[stream-v2] Got auth token, setting on Convex client");
    convexClient.setAuth(token);

    const body = await req.json();
    const { prompt, threadId: providedThreadId, storageId } = body;
    
    console.log("[stream-v2] Request received:", {
      promptLength: prompt?.length || 0,
      hasPrompt: !!prompt,
      hasStorageId: !!storageId,
      providedThreadId
    });
    
    debug.log("CONVEX_MUTATION_START", { mutation: "getOrCreateDailyThread" });
    
    // 1. Get or create thread (simplified)
    let threadResult;
    try {
      threadResult = await convexClient.mutation(api.threads.getOrCreateDailyThread, {});
      debug.log("CONVEX_MUTATION_SUCCESS", { mutation: "getOrCreateDailyThread", threadId: threadResult.threadId });
    } catch (error: any) {
      debug.error("CONVEX_MUTATION_ERROR", { mutation: "getOrCreateDailyThread", error: error.message });
      throw error;
    }
    
    const threadId = providedThreadId || threadResult.threadId;
    
    debug.log("CONVEX_MUTATION_START", { mutation: "saveMessage", role: "user" });
    
    // 2. Save user message (embedding is handled by threads.saveMessage)
    let userMessageId;
    try {
      userMessageId = await convexClient.mutation(api.threads.saveMessage, {
        threadId,
        role: "user",
        content: prompt,
        metadata: { 
          storageId: storageId || undefined
        }
      });
      debug.log("CONVEX_MUTATION_SUCCESS", { mutation: "saveMessage", messageId: userMessageId });
    } catch (error: any) {
      debug.error("CONVEX_MUTATION_ERROR", { mutation: "saveMessage", error: error.message });
      throw error;
    }
    
    // 3. Get daily summary and other context in parallel
    console.log("[stream-v2] Fetching context data for thread:", threadId);
    
    let dailySummary, preferences, pendingConfirmation, threadMessages, calibrationData, todayFoodLogs;
    
    try {
      [dailySummary, preferences, pendingConfirmation, threadMessages, calibrationData, todayFoodLogs] = await Promise.all([
      // Daily summary (includes profile, stats, yesterday summary)
      convexClient.query(api.dailySummary.getDailySummary, {}),
      // User preferences
      convexClient.query(api.userPreferences.getUserPreferences, {}),
      // Pending confirmations
      convexClient.query(api.pendingConfirmations.getLatestPendingConfirmation, {
        threadId
      }),
      // Get ALL messages from today's thread for full context
      convexClient.query(api.threads.getThreadMessages, {
        threadId,
        limit: 100  // Should cover a full day's conversation
      }),
      // Calibration insights
      convexClient.query(api.calibration.getLatestCalibration, {}),
      // Get today's actual food logs
      convexClient.query(api.foodLogs.getTodayLogs, {})
    ]);
    } catch (queryError: any) {
      console.error("[stream-v2] Error fetching context data:", queryError);
      console.error("[stream-v2] Query error details:", {
        message: queryError.message,
        stack: queryError.stack,
        name: queryError.name
      });
      throw new Error(`Failed to fetch context data: ${queryError.message}`);
    }
    
    // Build coreStats from daily summary
    const coreStats = {
      profile: dailySummary?.profile || { name: "there", dailyCalorieTarget: 2000, proteinTarget: 150 },
      todayStats: dailySummary?.today.stats || { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 },
      hasWeighedToday: dailySummary?.today.hasWeighedIn || false,
      caloriesRemaining: dailySummary?.today.remaining?.calories || 2000,
      todaySummary: dailySummary?.today.summary || "",
      todayFoodLogs: dailySummary?.today.foodLogs || [],
      yesterdayTotal: dailySummary?.yesterday.total || ""
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
      } : undefined,
      coreStats.todaySummary,
      coreStats.yesterdayTotal,
      coreStats.hasWeighedToday,
      todayFoodLogs
    );
    
    let systemPrompt = getBobSystemPrompt(promptContext);
    
    // Add photo analysis instruction if storageId is present
    if (storageId) {
      systemPrompt = `${systemPrompt}\n\nThe user has uploaded a food photo with ID ${storageId}. You MUST:
1. Call analyzePhoto EXACTLY ONCE
2. Wait for the result
3. Then call confirmFood with the analysis results
4. Do NOT call analyzePhoto again - you already have the results!`;
      
      console.log("[stream-v2] Photo upload detected with storageId:", storageId);
    }
    
    // 6. Detect intents and create tools using centralized system
    const intents = detectIntent(prompt);
    
    debug.log("TOOLS_CREATE_START", { intents });
    
    let tools;
    try {
      tools = createTools(
        convexClient,
        userId,
        threadId,
        storageId,
        pendingConfirmation
      );
      debug.log("TOOLS_CREATE_SUCCESS", { toolNames: Object.keys(tools) });
    } catch (error: any) {
      debug.error("TOOLS_CREATE_ERROR", { error: error.message });
      throw error;
    }
    
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
        ? threadMessages
            .filter((m: any) => m.content && m.content.trim()) // Filter out empty messages
            .map((m: any) => ({
              role: m.role as "user" | "assistant",
              content: m.content.trim(),
            }))
        : [{
            role: "user" as const,
            content: prompt || "Hello"
          }];
      
      // Ensure we have at least one message
      if (messages.length === 0) {
        messages.push({
          role: "user" as const,
          content: prompt || "Hello"
        });
      }
      
      console.log("[stream-v2] Prepared messages:", messages.length);

      let result;
      try {
        result = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        system: systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        maxSteps: 5,  // Allow complex multi-tool workflows
        toolChoice: undefined,  // Let AI decide which tools to use
        onChunk: ({ chunk }) => {
          debug.log("CHUNK", { 
            type: chunk.type,
            content: chunk.type === 'text' ? chunk.text?.substring(0, 50) : undefined
          });
          
          if (chunk.type === 'error') {
            debug.error("CHUNK_ERROR", {
              chunk,
              error: chunk.error,
              message: 'Vercel AI SDK generated an error chunk'
            });
            // Log but don't panic - we filter these out in the stream
          }
        },
        onToolCall: async ({ toolCall }) => {
          debug.log("TOOL_CALL", {
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            args: toolCall.args
          });
          
          console.log("[stream-v2] Tool called:", {
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            hasArgs: !!toolCall.args,
            argsPreview: JSON.stringify(toolCall.args).substring(0, 100)
          });
        },
        onFinish: async ({ text, toolCalls, usage, finishReason }: any) => {
          debug.log("STREAM_FINISH", {
            hasText: !!text,
            textLength: text?.length,
            toolCallsCount: toolCalls?.length,
            finishReason
          });
          
          try {
            console.log("[stream-v2] Stream finished:", { 
              hasText: !!text, 
              textLength: text?.length,
              toolCallsCount: toolCalls?.length,
              finishReason
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
            } else if (!toolCalls || toolCalls.length === 0) {
              // No text and no tool calls - this might be why we get errors
              console.warn("[stream-v2] Stream finished with no content or tool calls");
            }
          } catch (saveError: any) {
            console.error("[stream-v2] Error saving message in onFinish:", saveError);
            console.error("[stream-v2] Save error details:", {
              message: saveError.message,
              stack: saveError.stack
            });
            // Don't throw - let the stream complete successfully
          }
        },
      });
      } catch (streamTextError: any) {
        console.error("[stream-v2] Error calling streamText:", streamTextError);
        console.error("[stream-v2] streamText error details:", {
          message: streamTextError.message,
          stack: streamTextError.stack,
          name: streamTextError.name,
          code: streamTextError.code
        });
        
        // Don't throw - create a proper error response
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            // Send initial text explaining the error
            controller.enqueue(encoder.encode(`0:"I encountered an error processing your request. "\\n`));
            controller.enqueue(encoder.encode(`0:"Please try again in a moment."\\n`));
            controller.close();
          }
        });
        
        return new Response(errorStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
      
      console.log("[stream-v2] Stream created successfully");
      console.log("[stream-v2] Result type:", typeof result);
      console.log("[stream-v2] Result has toDataStreamResponse:", typeof result.toDataStreamResponse);
      
      try {
        // Get the response but intercept the stream
        const baseResponse = result.toDataStreamResponse();
        console.log("[stream-v2] Got base response, intercepting stream");
        
        if (!baseResponse.body) {
          throw new Error("No response body to filter");
        }
        
        // Create a new response with filtered stream
        const reader = baseResponse.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        
        console.log("[stream-v2] Creating filtered stream");
        const filteredStream = new ReadableStream({
          async start(controller) {
            let buffer = '';
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  // Debug log every line
                  if (line.trim()) {
                    console.log('[stream-v2] Stream line:', line.substring(0, 100));
                  }
                  
                  // Filter out error chunks (type 3) but ONLY if they contain generic errors
                  if (line.startsWith('3:')) {
                    const errorContent = line.substring(2);
                    // Only filter out the generic "An error occurred" messages
                    if (errorContent.includes('"An error occurred"') || 
                        errorContent.includes('"An error occurred."') ||
                        errorContent === '""' ||
                        errorContent === 'null') {
                      console.log('[stream-v2] Filtering out generic error chunk');
                      continue;
                    }
                    // Let real errors through
                    console.log('[stream-v2] Allowing specific error through:', line);
                  }
                  
                  // Pass through all other lines
                  if (line.trim() !== '') {
                    controller.enqueue(encoder.encode(line + '\n'));
                  } else {
                    controller.enqueue(encoder.encode('\n'));
                  }
                }
              }
              
              // Handle any remaining buffer
              if (buffer.trim() && !buffer.startsWith('3:')) {
                controller.enqueue(encoder.encode(buffer));
              }
            } catch (error) {
              console.error('[stream-v2] Stream filter error:', error);
              controller.error(error);
            } finally {
              controller.close();
            }
          }
        });
        
        // Log the final debug dump
        const debugDump = debug.getDump();
        console.log("[stream-v2] Debug summary:", {
          totalTime: debugDump.totalTime,
          chunkTypes: debugDump.logs.filter(l => l.type === 'CHUNK').map(l => l.data.type),
          errorCount: debugDump.logs.filter(l => l.type.includes('ERROR')).length,
          toolCalls: debugDump.logs.filter(l => l.type === 'TOOL_CALL_START').map(l => l.data.toolName)
        });
        
        return new Response(filteredStream, {
          headers: baseResponse.headers
        });
      } catch (responseError: any) {
        console.error("[stream-v2] Error creating response:", responseError);
        throw responseError;
      }
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
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
        },
      });
    }
    
  } catch (error: any) {
    // Log the debug dump to see where we failed
    const debugDump = debug.getDump();
    console.error("[Chat Stream V2] Failed at stage:", debugDump.logs[debugDump.logs.length - 1]);
    console.error("[Chat Stream V2] Debug trace:", debugDump.logs.map(l => `${l.type}@${l.timestamp}ms`).join(' -> '));
    
    console.error("[Chat Stream V2] Outer catch - Error:", error.message);
    console.error("[Chat Stream V2] Outer catch - Full error:", error);
    console.error("[Chat Stream V2] Outer catch - Stack trace:", error.stack);
    console.error("[Chat Stream V2] Outer catch - Error name:", error.name);
    console.error("[Chat Stream V2] Outer catch - Error constructor:", error.constructor.name);
    
    // Provide more specific error messages
    let errorMessage = error.message || 'An error occurred';
    console.error("[Chat Stream V2] Sending error to client:", errorMessage);
    
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