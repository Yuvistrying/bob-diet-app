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

// Intent detection utility
function detectIntent(userMessage: string) {
  const msg = userMessage.toLowerCase();
  
  const intents = {
    food: /\b(ate|had|eat|eating|food|meal|breakfast|lunch|dinner|snack|log|for me)\b/i,
    weight: /\b(weight|weigh|scale|kg|lbs|pounds|kilos)\b/i,
    progress: /\b(progress|today|left|remaining|how|calories|status)\b/i,
    photo: /\b(photo|image|picture|upload)\b/i,
    greeting: /^(hi|hello|hey|good morning|morning)\b/i,
    confirmation: /^(yes|yep|sure|ok|correct|right|confirm)\b/i,
    search: /\b(similar|before|past|history|had before|eaten before|last time)\b/i,
  };
  
  const detected = [];
  for (const [intent, regex] of Object.entries(intents)) {
    if (regex.test(msg)) {
      detected.push(intent);
    }
  }
  
  return detected;
}

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
    
    // Get or create Agent thread
    const agentContext = await convexClient.action(api.agentBridge.loadAgentContext, {
      threadId: threadId || undefined,
      includeHistory: true,
    });
    
    const activeThreadId = agentContext.threadId;
    console.log("[Chat Stream API] Agent thread:", activeThreadId);
    
    // Save user message first
    await convexClient.mutation(api.chatHistory.saveUserMessage, {
      content: prompt,
      metadata: { 
        actionType: storageId ? "photo_analysis" : "text",
        threadId: activeThreadId,
        storageId: storageId || undefined
      }
    });
    
    // Get context from Convex with caching
    let coreStats: any, preferences: any, threadContext: any, pendingConfirmation: any;
    
    try {
      console.log("[Chat Stream API] Fetching cached context...");
      
      // 1. Get cached core stats (5min cache) - ~100 tokens
      coreStats = await convexClient.mutation(api.agentBridge.getCachedContext, {
        cacheKey: "coreStats"
      });
      
      // 2. Get preferences (30 day cache) - ~10 tokens
      preferences = await convexClient.mutation(api.agentBridge.getCachedContext, {
        cacheKey: "preferences"
      });
      
      // 3. Load thread context if we have an active thread - ~300 tokens when included
      if (activeThreadId) {
        try {
          threadContext = await convexClient.action(api.agentBridge.buildStreamingContext, {
            threadId: activeThreadId,
            userId
          });
          console.log("[Chat Stream API] Thread context loaded with:", {
            messageCount: threadContext.threadContext?.messageCount,
            establishedFacts: threadContext.historicalContext?.establishedFacts?.length,
            keyTopics: threadContext.keyTopics?.length
          });
        } catch (contextError: any) {
          console.log("[Chat Stream API] Could not load thread context:", contextError.message);
          threadContext = null;
        }
      }
      
      // 4. Check for pending confirmations
      try {
        pendingConfirmation = await convexClient.query(api.pendingConfirmations.getLatestPendingConfirmation, {
          threadId: activeThreadId
        });
        if (pendingConfirmation) {
          console.log("[Chat Stream API] Found pending confirmation:", {
            description: pendingConfirmation.confirmationData.description,
            totalCalories: pendingConfirmation.confirmationData.totalCalories
          });
        }
      } catch (error: any) {
        console.log("[Chat Stream API] Could not load pending confirmation:", error.message);
        pendingConfirmation = null;
      }
      
      console.log("[Chat Stream API] Context fetched successfully (cached)");
    } catch (convexError: any) {
      console.error("[Chat Stream API] Context fetch error:", {
        message: convexError.message,
        stack: convexError.stack
      });
      // Use default values if queries fail
      coreStats = {
        profile: { name: "there", dailyCalorieTarget: 2000, proteinTarget: 150 },
        todayStats: { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 },
        hasWeighedToday: false,
        caloriesRemaining: 2000
      };
      preferences = null;
      threadContext = null;
    }
    
    // Build messages array - empty since context is in system prompt
    const messages = [];
    
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
    
    // Use thread context if available, otherwise minimal context
    const systemPrompt = threadContext 
      ? buildFullPrompt(threadContext, coreStats, hour, defaultMealType, pendingConfirmation)
      : buildMinimalPrompt(coreStats, preferences, hour, defaultMealType, pendingConfirmation);
    
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
      // Get profile if not already loaded (for showProgress tool)
      const profile = coreStats?.profile || null;
      
      // Test without tools first if disableTools is set
      const shouldUseTools = !disableTools;
      console.log("[Chat Stream API] Tools enabled:", shouldUseTools);
      
      // Detect user intent for smart tool loading
      const intents = detectIntent(prompt);
      console.log("[Chat Stream API] Detected intents:", intents);
      
      // Create tools object based on intent
      const allTools: any = {};
      
      if (shouldUseTools) {
        console.log("[Chat Stream API] Creating tools based on intent...");
        
        // Check if user is confirming a pending food log
        const isConfirmingFood = intents.includes('confirmation') && pendingConfirmation;
        
        // Always load food tools since that's Bob's primary function
        // Unless it's clearly only about weight or progress
        const isOnlyWeightOrProgress = intents.length > 0 && 
          intents.every(intent => ['weight', 'progress'].includes(intent)) &&
          !isConfirmingFood;
        
        if (!isOnlyWeightOrProgress || isConfirmingFood) {
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
            
            // Save pending confirmation to database
            try {
              const toolCallId = `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
              await convexClient.mutation(api.pendingConfirmations.savePendingConfirmation, {
                threadId: activeThreadId,
                toolCallId,
                confirmationData: args,
              });
              console.log("[confirmFood] Saved pending confirmation with ID:", toolCallId);
            } catch (error: any) {
              console.error("[confirmFood] Failed to save pending confirmation:", error);
            }
            
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
              const logId = await convexClient.mutation(api.foodLogs.logFood, {
                description: args.description,
                foods: args.items,
                meal: args.mealType,
                aiEstimated: true,
                confidence: args.confidence,
              });
              
              // Generate embedding for the food log
              try {
                console.log("[logFood] Generating embedding for food log:", logId);
                
                // Create descriptive text for embedding
                const foodDescriptions = args.items.map(f => `${f.quantity} ${f.name}`).join(", ");
                const embeddingText = `${args.mealType}: ${foodDescriptions} - ${args.description} (${args.totalCalories} calories, ${args.totalProtein}g protein)`;
                
                const embedding = await convexClient.action(api.embeddings.generateEmbedding, {
                  text: embeddingText,
                });
                
                await convexClient.mutation(api.embeddings.updateFoodLogEmbedding, {
                  foodLogId: logId,
                  embedding,
                });
                
                console.log("[logFood] Embedding generated and saved successfully");
              } catch (embeddingError: any) {
                console.error("[logFood] Failed to generate embedding:", embeddingError);
                // Don't fail the whole operation if embedding fails
              }
              
              // Mark pending confirmation as confirmed if it exists
              if (pendingConfirmation) {
                try {
                  await convexClient.mutation(api.pendingConfirmations.confirmPendingConfirmation, {
                    confirmationId: pendingConfirmation._id,
                  });
                  console.log("[logFood] Marked pending confirmation as confirmed");
                } catch (error: any) {
                  console.log("[logFood] Could not mark confirmation as confirmed:", error.message);
                }
              }
              
              return { success: true, logId };
            } catch (error: any) {
              console.error("[logFood] Error:", error);
              return { success: false, error: error.message };
            }
          },
        });
        }
        
        // Add photo tool if photo intent or storageId provided
        if (storageId || intents.includes('photo')) {
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
        
        // Add weight tool if weight intent detected
        if (intents.includes('weight')) {
          allTools.logWeight = tool({
          description: "Log user's weight",
          parameters: z.object({
            weight: z.number().describe("Weight value"),
            unit: z.enum(["kg", "lbs"]).describe("Weight unit"),
            notes: z.string().optional().describe("Any notes about the weight"),
          }),
          execute: async (args) => {
            try {
              const logId = await convexClient.mutation(api.weightLogs.logWeight, args);
              
              // Note: Embedding generation for notes is handled by the mutation itself
              // via scheduler if notes are provided
              
              return { success: true, logId };
            } catch (error: any) {
              console.error("[logWeight] Error:", error);
              return { success: false, error: error.message };
            }
          },
        });
        }
        
        // Add search tool if search intent detected
        if (intents.includes('search') || intents.includes('food')) {
          allTools.findSimilarMeals = tool({
            description: "Search for similar meals from user's history",
            parameters: z.object({
              searchText: z.string().describe("Description of the meal to search for"),
              limit: z.number().default(3).describe("Number of similar meals to return"),
            }),
            execute: async (args) => {
              try {
                const results = await convexClient.action(
                  api.agentBridge.searchSimilarMeals,
                  args
                );
                
                if (results.length === 0) {
                  return { message: "No similar meals found in your history." };
                }
                
                return {
                  meals: results,
                  message: `Found ${results.length} similar meals you've had before.`
                };
              } catch (error: any) {
                console.error("[findSimilarMeals] Error:", error);
                return { error: true, message: error.message };
              }
            },
          });
        }
        
        // Add progress tool if progress intent or as default
        if (intents.includes('progress') || Object.keys(allTools).length === 0) {
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
        }
        
        console.log("[Chat Stream API] Tools created:", Object.keys(allTools));
        console.log("[Chat Stream API] Tool count:", Object.keys(allTools).length);
      }
      
      const streamConfig: any = {
        model: anthropic('claude-sonnet-4-20250514'),
        system: systemPrompt,
        messages,
        experimental_telemetry: {
          isEnabled: false,
        },
        maxSteps: 5,
        onChunk: ({ chunk }: any) => {
        console.log("[Chat Stream API] Chunk received:", {
          type: chunk.type,
          timestamp: new Date().toISOString(),
          chunkData: chunk.type === 'text-delta' ? chunk : 'non-text chunk'
        });
      },
      onError: (error: any) => {
        console.error("[Chat Stream API] Stream error caught in onError:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          timestamp: new Date().toISOString(),
          errorString: error.toString()
        });
      },
      onFinish: async ({ text, toolCalls, usage }: any) => {
        console.log("[Chat Stream API] Finished with text:", text);
        console.log("[Chat Stream API] Token usage:", usage);
        // Save to Agent thread with error handling
        try {
          await convexClient.action(api.agentBridge.saveStreamedMessage, {
            threadId: activeThreadId,
            message: {
              role: "assistant",
              content: text,
            },
            toolCalls: toolCalls || [],
            usage: usage ? {
              promptTokens: usage.promptTokens || 0,
              completionTokens: usage.completionTokens || 0,
              totalTokens: usage.totalTokens || 0,
            } : undefined,
          });
        } catch (agentError: any) {
          console.error("[Chat Stream API] Failed to save to Agent:", agentError);
          // Don't throw - we still want to save to regular chat history
        }
        
        // Also save to regular chat history for backward compatibility
        await convexClient.mutation(api.chatHistory.saveBobMessage, {
          content: text,
          metadata: {
            actionType: storageId ? "photo_analysis_response" : "general_chat",
            threadId: activeThreadId,
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

// Build minimal prompt when no thread context
function buildMinimalPrompt(
  coreStats: any, 
  preferences: any, 
  hour: number, 
  defaultMealType: string,
  pendingConfirmation: any
): string {
  const isStealthMode = preferences?.displayMode === "stealth";
  
  return `You are Bob, ${coreStats.profile.name}'s diet coach. Be direct and concise.
Stats: ${coreStats.caloriesRemaining} cal left, ${coreStats.todayStats.protein}/${coreStats.profile.proteinTarget}g protein
${pendingConfirmation ? `PENDING: "${pendingConfirmation.confirmationData.description}" - if user says yes, logFood immediately` : ""}

STYLE: Answer directly. 1-2 sentences max. Only give details if asked.
TOOLS: Food→confirmFood→logFood. Photos→analyzePhoto→confirmFood.
${!coreStats.hasWeighedToday ? "No weigh-in yet today." : ""}`;
}

// Build full prompt with thread context
function buildFullPrompt(
  context: any,
  coreStats: any,
  hour: number,
  defaultMealType: string,
  pendingConfirmation: any
): string {
  const isStealthMode = context?.user?.displayMode === "stealth";
  
  // Build historical context summary
  let historicalNotes = "";
  if (context?.historicalContext) {
    const { establishedFacts, recentPatterns, ongoingGoals } = context.historicalContext;
    if (establishedFacts?.length > 0) {
      historicalNotes += `\n\nESTABLISHED FACTS:\n${establishedFacts.slice(0, 3).map((f: string) => `- ${f}`).join('\n')}`;
    }
    if (recentPatterns?.length > 0) {
      historicalNotes += `\n\nRECENT PATTERNS:\n${recentPatterns.slice(0, 3).map((p: string) => `- ${p}`).join('\n')}`;
    }
    if (ongoingGoals?.length > 0) {
      historicalNotes += `\n\nUSER'S GOALS:\n${ongoingGoals.slice(0, 2).map((g: string) => `- ${g}`).join('\n')}`;
    }
  }
  
  return `You are Bob, a friendly and encouraging AI diet coach helping ${context?.user?.name || "there"}.

USER CONTEXT:
- Name: ${context?.user?.name}
- Goal: ${context?.user?.goal === "cut" ? "lose weight" : context?.user?.goal === "gain" ? "gain muscle" : "maintain weight"}
- Current weight: ${context?.user?.currentWeight || "unknown"}kg
- Target weight: ${context?.user?.targetWeight || "unknown"}kg  
- Display mode: ${isStealthMode ? "stealth (no numbers)" : "standard (show numbers)"}

TODAY'S PROGRESS:
- Calories: ${context?.todayProgress?.calories.consumed}/${context?.todayProgress?.calories.target} (${context?.todayProgress?.calories.remaining} remaining)
- Protein: ${context?.todayProgress?.protein?.consumed}/${context?.todayProgress?.protein?.target}g
- Meals logged: ${context?.todayProgress?.meals || 0}
- Daily weigh-in: ${coreStats.hasWeighedToday ? "✅ Completed" : "❌ Not yet logged"}

${context?.todaySummary?.entries?.length > 0 ? `TODAY'S FOOD LOG:\n${context.todaySummary.entries.map((e: any) => `- ${e.time} ${e.meal}: ${e.description} (${e.calories}cal, ${e.protein}g protein)`).join('\n')}` : ''}

${context?.conversationSummary ? `\nTODAY'S CONVERSATION SO FAR:\n${context.conversationSummary}` : ''}
${context?.keyTopics?.length > 0 ? `\nFOODS DISCUSSED TODAY: ${context.keyTopics.join(', ')}` : ''}
${historicalNotes}

${pendingConfirmation ? `PENDING CONFIRMATION:
You just showed the user a confirmation card for: "${pendingConfirmation.confirmationData.description}"
- Total: ${pendingConfirmation.confirmationData.totalCalories} calories, ${pendingConfirmation.confirmationData.totalProtein}g protein
- Items: ${pendingConfirmation.confirmationData.items.map((i: any) => `${i.quantity} ${i.name}`).join(', ')}
- Meal type: ${pendingConfirmation.confirmationData.mealType}

If the user responds with yes/yep/sure/correct/okay/that's right, IMMEDIATELY use the logFood tool with this exact data.
DO NOT ask for confirmation again - you already showed it!` : ''}

CONVERSATION STYLE:
1. Answer the user's question DIRECTLY first - no preamble
2. Keep responses to 1-2 sentences unless they ask for details
3. Only mention calories/macros when relevant to their question
4. Save encouragement for actual achievements, not every message
5. When asked for meal ideas, give 2-3 specific options immediately

CORE RULES:
1. ALWAYS ask for confirmation before logging food using the confirmFood tool
2. When using confirmFood, say "Let me confirm:" (nothing more)
3. Only use the logFood tool AFTER user confirms (yes, sure, yep, etc.)
4. ${isStealthMode ? "Stealth mode: no numbers" : "Include calories/macros"}
5. Current time: ${hour}:00 (likely ${defaultMealType})
6. ${!coreStats.hasWeighedToday ? "User hasn't weighed in today - ask once if appropriate" : ""}

TOOL USAGE:
- Food mention → "Let me confirm:" + confirmFood tool
- User confirms → logFood tool + "Logged! X calories left."
- Photo shared → analyzePhoto → confirmFood immediately
- Progress question → showProgress tool

GOOD vs BAD EXAMPLES:
❌ BAD: "Hey! Great to hear you're planning lunch! That's awesome for staying on track! What are you thinking..."
✅ GOOD: "What are you thinking for lunch?"

❌ BAD: "Looking at your goals to lose weight and track consistently, here are some ideas..."
✅ GOOD: "Here are 3 lunch options:
- Chicken salad (350 cal, 30g protein)
- Turkey wrap (400 cal, 25g protein)
- Greek yogurt bowl (300 cal, 20g protein)"

RELIABILITY:
1. ALWAYS complete logging when user confirms
2. NEVER say "logged" without using logFood tool
3. Use exact data from confirmFood/analyzePhoto`;
}