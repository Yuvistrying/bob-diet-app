import { auth } from "@clerk/nextjs/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// Initialize Anthropic with API key
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Using Claude 4 Sonnet
const MODEL_ID = 'claude-sonnet-4-20250514';

// Create a Convex client for server-side use
const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  console.log("[Chat Stream API] Request received at:", new Date().toISOString());
  console.log("[Chat Stream API] Environment check:", {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY_LENGTH: process.env.ANTHROPIC_API_KEY?.length,
    CONVEX_URL: !!process.env.NEXT_PUBLIC_CONVEX_URL,
    NODE_ENV: process.env.NODE_ENV
  });
  
  try {
    const { userId, getToken } = await auth();
    console.log("[Chat Stream API] Auth:", { userId, hasGetToken: !!getToken });
    
    if (!userId) {
      console.error("[Chat Stream API] No userId - returning 401");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get auth token for Convex
    const token = await getToken({ template: "convex" });
    console.log("[Chat Stream API] Convex token obtained:", !!token);
    
    if (!token) {
      console.error("[Chat Stream API] Failed to get Convex token");
      throw new Error("Failed to get authentication token");
    }
    
    // Set the auth token for Convex client
    convexClient.setAuth(token);
    console.log("[Chat Stream API] Convex client authenticated");

    const body = await req.json();
    const { prompt, threadId, storageId, disableTools, debugMinimal } = body;
    console.log("[Chat Stream API] Request body:", { prompt, threadId, storageId, disableTools, debugMinimal });
    
    // Save user message first
    await convexClient.mutation(api.chatHistory.saveUserMessage, {
      content: prompt,
      metadata: { 
        actionType: storageId ? "photo_analysis" : "text",
        threadId: threadId || undefined,
        storageId: storageId || undefined
      }
    });
    
    // Get context from Convex
    let profile, todayStats, preferences, chatHistory;
    
    try {
      console.log("[Chat Stream API] Fetching Convex data...");
      [profile, todayStats, preferences, chatHistory] = await Promise.all([
        convexClient.query(api.userProfiles.getUserProfile, {}),
        convexClient.query(api.foodLogs.getTodayStats),
        convexClient.query(api.userPreferences.getUserPreferences),
        threadId ? convexClient.query(api.chatHistory.getThreadMessages, { threadId, limit: 10 }) : Promise.resolve([])
      ]);
      console.log("[Chat Stream API] Convex data fetched successfully");
    } catch (convexError: any) {
      console.error("[Chat Stream API] Convex query error:", {
        message: convexError.message,
        stack: convexError.stack
      });
      // Use default values if Convex queries fail
      profile = null;
      todayStats = null;
      preferences = null;
      chatHistory = [];
    }
    
    // Build messages array
    const messages = chatHistory?.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })) || [];
    
    // Current message is already saved, just add to context
    messages.push({ role: 'user', content: prompt });
    
    // Get current time for meal type detection
    const now = new Date();
    const hour = now.getHours();
    const defaultMealType = 
      hour < 11 ? "breakfast" :
      hour < 15 ? "lunch" :
      hour < 18 ? "snack" :
      "dinner";
    
    // Build system prompt
    const isStealthMode = preferences?.displayMode === "stealth";
    
    // Use minimal prompt if debugging
    const useMinimalPrompt = body.debugMinimal || false;
    const systemPrompt = useMinimalPrompt 
      ? "You are Bob, a helpful AI assistant." 
      : `You are Bob, a friendly and encouraging AI diet coach helping ${profile?.name || "there"}.

USER CONTEXT:
- Name: ${profile?.name}
- Goal: ${profile?.goal === "cut" ? "lose weight" : profile?.goal === "gain" ? "gain muscle" : "maintain weight"}
- Current weight: ${profile?.currentWeight || "unknown"}kg
- Target weight: ${profile?.targetWeight || "unknown"}kg  
- Display mode: ${isStealthMode ? "stealth (no numbers)" : "standard (show numbers)"}

TODAY'S PROGRESS:
- Calories: ${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000} (${(profile?.dailyCalorieTarget || 2000) - (todayStats?.calories || 0)} remaining)
- Protein: ${todayStats?.protein || 0}/${profile?.proteinTarget || 150}g
- Meals logged: ${todayStats?.mealsLogged || 0}

IMPORTANT RULES:
1. ALWAYS ask for confirmation before logging food using the confirmFood tool
2. Parse natural language for food mentions and estimate calories/macros
3. Only use the logFood tool AFTER user explicitly confirms
4. ${isStealthMode ? "In stealth mode: Focus on habits and encouragement, avoid showing numbers" : "Show calories and macro counts"}
5. Detect meal type based on time of day (current time: ${hour}:00, likely ${defaultMealType})
6. Be encouraging and supportive, like a gym buddy
7. Keep responses concise and friendly`;
    
    // Stream the response using Vercel AI SDK
    console.log("[Chat Stream API] Starting stream with:", {
      messagesCount: messages.length,
      lastMessage: messages[messages.length - 1],
      systemPromptLength: systemPrompt.length,
      hasStorageId: !!storageId,
      disableTools: process.env.DISABLE_TOOLS === 'true'
    });
    
    let result;
    try {
      // Test without tools first if disableTools is set
      const shouldUseTools = !disableTools;
      console.log("[Chat Stream API] Tools enabled:", shouldUseTools);
      
      // Create tools object
      const allTools: any = {};
      
      if (shouldUseTools) {
        console.log("[Chat Stream API] Creating tools...");
        
        // Always include these basic tools
        allTools.confirmFood = tool({
          description: "Show food understanding and ask for confirmation before logging",
          parameters: z.object({
            description: z.string().describe("Natural description of the food"),
            items: z.array(z.object({
              name: z.string(),
              quantity: z.string(),
              calories: z.number(),
              protein: z.number(),
              carbs: z.number(),
              fat: z.number(),
            })).describe("Breakdown of food items"),
            totalCalories: z.number(),
            totalProtein: z.number(),
            totalCarbs: z.number(),
            totalFat: z.number(),
            mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Type of meal based on time of day"),
            confidence: z.enum(["low", "medium", "high"]).describe("Confidence in the estimation"),
          }),
          execute: async (args) => {
            console.log("[confirmFood] Called with:", args);
            return args;
          },
        });
        
        allTools.logFood = tool({
          description: "Actually log the food after user confirmation",
          parameters: z.object({
            description: z.string(),
            items: z.array(z.object({
              name: z.string(),
              quantity: z.string(),
              calories: z.number(),
              protein: z.number(),
              carbs: z.number(),
              fat: z.number(),
            })),
            totalCalories: z.number(),
            totalProtein: z.number(),
            totalCarbs: z.number(),
            totalFat: z.number(),
            mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
            aiEstimated: z.boolean().default(true),
            confidence: z.string(),
          }),
          execute: async (args) => {
            try {
              await convexClient.mutation(api.foodLogs.logFood, {
                description: args.description,
                foods: args.items,
                meal: args.mealType,
                aiEstimated: true,
                confidence: args.confidence,
              });
              return { success: true };
            } catch (error: any) {
              console.error("[logFood] Error:", error);
              return { success: false, error: error.message };
            }
          },
        });
        
        // Add photo tool only if storageId is provided
        if (storageId) {
          allTools.analyzePhoto = tool({
            description: "Analyze a food photo to estimate calories and macros",
            parameters: z.object({
              storageId: z.string().optional().describe("Convex storage ID of the food image to analyze"),
              mealContext: z.string().optional().describe("Any context about the meal"),
            }),
            execute: async (args) => {
              try {
                const result = await convexClient.action(api.vision.analyzeFood, {
                  storageId: args.storageId || storageId,
                  context: args.mealContext,
                });
                
                if (result.error) {
                  return result;
                }
                
                await convexClient.mutation(api.photoAnalyses.savePhotoAnalysis, {
                  storageId: args.storageId || storageId,
                  analysis: {
                    foods: result.foods,
                    totalCalories: result.totalCalories,
                    totalProtein: result.totalProtein,
                    totalCarbs: result.totalCarbs,
                    totalFat: result.totalFat,
                    confidence: result.confidence,
                    description: result.description,
                    metadata: result.metadata,
                  },
                  embedding: result.embedding,
                });
                
                return result;
              } catch (error: any) {
                console.error("[analyzePhoto] Error:", error);
                return { error: true, message: error.message };
              }
            },
          });
        }
        
        // Add remaining tools
        allTools.logWeight = tool({
          description: "Log user's weight",
          parameters: z.object({
            weight: z.number().describe("Weight value"),
            unit: z.enum(["kg", "lbs"]).describe("Weight unit"),
            notes: z.string().optional().describe("Any notes about the weight"),
          }),
          execute: async (args) => {
            try {
              await convexClient.mutation(api.weightLogs.logWeight, args);
              return { success: true };
            } catch (error: any) {
              console.error("[logWeight] Error:", error);
              return { success: false, error: error.message };
            }
          },
        });
        
        allTools.showProgress = tool({
          description: "Show user's daily progress and remaining calories/macros",
          parameters: z.object({
            showDetailed: z.boolean().default(false).describe("Whether to show detailed macro breakdown"),
          }),
          execute: async (args) => {
            try {
              const stats = await convexClient.query(api.foodLogs.getTodayStats);
              const userProfile = profile || await convexClient.query(api.userProfiles.getUserProfile, {});
              
              if (!stats || !userProfile) {
                return { summary: "No data available yet. Start logging your meals!" };
              }
              
              const remainingCalories = userProfile.dailyCalorieTarget - stats.calories;
              const remainingProtein = userProfile.proteinTarget - stats.protein;
              
              return {
                calories: { consumed: stats.calories, target: userProfile.dailyCalorieTarget, remaining: remainingCalories },
                protein: { consumed: stats.protein, target: userProfile.proteinTarget, remaining: remainingProtein },
                carbs: { consumed: stats.carbs },
                fat: { consumed: stats.fat },
                meals: stats.mealsLogged,
                showDetailed: args.showDetailed
              };
            } catch (error: any) {
              console.error("[showProgress] Error:", error);
              return { error: true, message: error.message };
            }
          },
        });
        
        console.log("[Chat Stream API] Tools created:", Object.keys(allTools));
      }
      
      const streamConfig: any = {
        model: anthropic('claude-sonnet-4-20250514'),
        system: systemPrompt,
        messages,
        experimental_telemetry: {
          isEnabled: false,
        },
        maxSteps: 5,
        onChunk: ({ chunk }) => {
        console.log("[Chat Stream API] Chunk received:", {
          type: chunk.type,
          timestamp: new Date().toISOString(),
          chunkData: chunk.type === 'text-delta' ? chunk : 'non-text chunk'
        });
      },
      onError: (error) => {
        console.error("[Chat Stream API] Stream error caught in onError:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          timestamp: new Date().toISOString(),
          errorString: error.toString()
        });
      },
      onFinish: async ({ text, toolCalls }) => {
        console.log("[Chat Stream API] Finished with text:", text);
        // Save the complete message to Convex
        await convexClient.mutation(api.chatHistory.saveBobMessage, {
          content: text,
          metadata: {
            actionType: storageId ? "photo_analysis_response" : "general_chat",
            threadId,
            toolCalls: toolCalls || undefined,
          }
        });
      },
      };
      
      // Add tools if enabled
      if (shouldUseTools && Object.keys(allTools).length > 0) {
        streamConfig.tools = allTools;
      }
      
      console.log("[Chat Stream API] Stream config ready, calling streamText");
      result = streamText(streamConfig);
      
    } catch (streamTextError: any) {
      console.error("[Chat Stream API] Error calling streamText:", {
        name: streamTextError.name,
        message: streamTextError.message,
        stack: streamTextError.stack,
        cause: streamTextError.cause,
        response: streamTextError.response,
        status: streamTextError.status,
        timestamp: new Date().toISOString()
      });
      
      // Log the specific error details
      if (streamTextError.message?.includes('tool')) {
        console.error("[Chat Stream API] Tool-related error detected");
      }
      if (streamTextError.response?.data) {
        console.error("[Chat Stream API] Response data:", streamTextError.response.data);
      }
      
      throw streamTextError;
    }
    
    // Return the streaming response
    console.log("[Chat Stream API] About to create stream response", {
      hasResult: !!result,
      resultType: typeof result,
      hasToDataStreamResponse: !!result?.toDataStreamResponse
    });
    
    try {
      const response = result.toDataStreamResponse();
      console.log("[Chat Stream API] Stream response created:", {
        hasResponse: !!response,
        responseType: response?.constructor?.name,
        timestamp: new Date().toISOString()
      });
      return response;
    } catch (streamError: any) {
      console.error("[Chat Stream API] Error creating stream response:", {
        name: streamError.name,
        message: streamError.message,
        stack: streamError.stack,
        fullError: JSON.stringify(streamError, null, 2)
      });
      throw streamError;
    }
  } catch (error: any) {
    console.error("[Chat Stream API] Top-level error caught:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      response: error.response,
      status: error.status,
      timestamp: new Date().toISOString(),
      errorType: error.constructor.name,
      fullError: JSON.stringify(error, null, 2)
    });
    
    // Return error as streaming response for consistency
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`3:"${error.message || 'Internal server error'}"\n`));
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