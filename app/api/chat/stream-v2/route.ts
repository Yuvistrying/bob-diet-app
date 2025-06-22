import { auth } from "@clerk/nextjs/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../../../../convex/_generated/api";
import { getBobSystemPrompt } from "../../../../convex/lib/bobPrompts";

// Same Anthropic setup
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Same intent detection
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
  console.log("[Chat Stream V2] Request received");
  
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

    const { prompt, threadId: providedThreadId, storageId } = await req.json();
    
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
    const [profile, todayStats, latestWeight, preferences, pendingConfirmation, threadMessages] = await Promise.all([
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
      })
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
    
    // 5. Build system prompt (centralized)
    const systemPrompt = getBobSystemPrompt({
      userName: coreStats.profile.name,
      caloriesRemaining: coreStats.caloriesRemaining,
      proteinConsumed: coreStats.todayStats.protein,
      proteinTarget: coreStats.profile.proteinTarget,
      hasWeighedToday: coreStats.hasWeighedToday,
      isStealthMode: preferences?.displayMode === "stealth",
      currentHour: hour,
      mealType: defaultMealType,
      pendingConfirmation: pendingConfirmation ? {
        description: pendingConfirmation.confirmationData.description,
        totalCalories: pendingConfirmation.confirmationData.totalCalories,
        items: pendingConfirmation.confirmationData.items,
      } : undefined,
    });
    
    // 6. Detect intents for smart tool loading
    const intents = detectIntent(prompt);
    const isConfirmingFood = intents.includes('confirmation') && pendingConfirmation;
    const needsFoodTools = !intents.length || 
      intents.some(i => ['food', 'photo', 'search'].includes(i)) || 
      isConfirmingFood;
    
    // 7. Create tools (exact same as before)
    const tools: any = {};
    
    // Food tools
    if (needsFoodTools) {
      tools.confirmFood = tool({
        description: "Show food understanding and ask for confirmation before logging",
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
          confidence: z.enum(["low", "medium", "high"]),
        }),
        execute: async (args) => {
          // Save pending confirmation
          const toolCallId = `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await convexClient.mutation(api.pendingConfirmations.savePendingConfirmation, {
            threadId,
            toolCallId,
            confirmationData: args,
          });
          return args;
        },
      });
      
      tools.logFood = tool({
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
          // Log the food
          const logId = await convexClient.mutation(api.foodLogs.logFood, {
            description: args.description,
            foods: args.items,
            meal: args.mealType,
            aiEstimated: true,
            confidence: args.confidence,
          });
          
          // Generate embedding for vector search with rich context
          try {
            console.log("[logFood] Generating embedding for food log:", logId);
            
            // Create descriptive text for embedding
            const foodDescriptions = args.items.map((f: any) => `${f.quantity} ${f.name}`).join(", ");
            const embeddingText = `${args.mealType}: ${foodDescriptions} - ${args.description} (${args.totalCalories} calories, ${args.totalProtein}g protein)`;
            
            const embedding = await convexClient.action(api.embeddings.generateEmbedding, {
              text: embeddingText,
            });
            
            // Update food log with embedding
            await convexClient.mutation(api.embeddings.updateFoodLogEmbedding, {
              foodLogId: logId,
              embedding,
            });
            
            console.log("[logFood] Embedding generated and saved successfully");
          } catch (embeddingError: any) {
            console.error("[logFood] Failed to generate embedding:", embeddingError);
            // Don't fail the whole operation if embedding fails
          }
          
          if (pendingConfirmation) {
            await convexClient.mutation(api.pendingConfirmations.confirmPendingConfirmation, {
              confirmationId: pendingConfirmation._id,
            });
          }
          
          return { success: true };
        },
      });
    }
    
    // Photo tool
    if (storageId || intents.includes('photo')) {
      tools.analyzePhoto = tool({
        description: "Analyze a food photo to estimate calories and macros",
        parameters: z.object({
          storageId: z.string().optional(),
          mealContext: z.string().optional(),
        }),
        execute: async (args) => {
          const result = await convexClient.action(api.vision.analyzeFoodPublic, {
            storageId: args.storageId || storageId,
            context: args.mealContext,
          });
          
          if (!result.error) {
            await convexClient.mutation(api.photoAnalyses.savePhotoAnalysis, {
              userId,
              timestamp: Date.now(),
              storageId: args.storageId || storageId,
              analysis: {
                foods: result.foods,
                totalCalories: result.totalCalories,
                totalProtein: result.totalProtein,
                totalCarbs: result.totalCarbs,
                totalFat: result.totalFat,
                overallConfidence: result.confidence || result.overallConfidence,
                metadata: result.metadata,
              },
              confirmed: false,
              embedding: result.embedding,
            });
          }
          
          return result;
        },
      });
    }
    
    // Weight tool
    if (intents.includes('weight')) {
      tools.logWeight = tool({
        description: "Log user's weight",
        parameters: z.object({
          weight: z.number(),
          unit: z.enum(["kg", "lbs"]),
          notes: z.string().optional(),
        }),
        execute: async (args) => {
          const logId = await convexClient.mutation(api.weightLogs.logWeight, args);
          
          // Note: Embedding generation for notes is handled by the mutation itself
          // via scheduler if notes are provided
          
          return { success: true, logId };
        },
      });
    }
    
    // Progress tool
    if (intents.includes('progress') || Object.keys(tools).length === 0) {
      tools.showProgress = tool({
        description: "Show user's daily progress",
        parameters: z.object({
          showDetailed: z.boolean().default(false),
        }),
        execute: async (args) => {
          const stats = await convexClient.query(api.foodLogs.getTodayStats);
          const profile = await convexClient.query(api.userProfiles.getUserProfile, {});
          
          if (!stats || !profile) {
            return { summary: "No data available yet." };
          }
          
          return {
            calories: { 
              consumed: stats.calories, 
              target: profile.dailyCalorieTarget, 
              remaining: profile.dailyCalorieTarget - stats.calories 
            },
            protein: { 
              consumed: stats.protein, 
              target: profile.proteinTarget, 
              remaining: profile.proteinTarget - stats.protein 
            },
            meals: stats.meals || 0,
          };
        },
      });
    }
    
    // Search tool
    if (intents.includes('search') || intents.includes('food')) {
      tools.findSimilarMeals = tool({
        description: "Search for similar meals from history using vector search",
        parameters: z.object({
          searchText: z.string(),
          limit: z.number().default(3),
        }),
        execute: async (args) => {
          // Use vector search to find similar meals
          const results = await convexClient.action(
            api.vectorSearch.searchSimilarMeals,
            {
              searchText: args.searchText,
              limit: args.limit,
            }
          );
          return {
            meals: results,
            message: results.length ? 
              `Found ${results.length} similar meals.` : 
              "No similar meals found."
          };
        },
      });
    }
    
    // 8. Stream response
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: threadMessages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      maxSteps: 5,
      onFinish: async ({ text, toolCalls, usage }: any) => {
        // Save assistant message
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
      },
    });
    
    return result.toDataStreamResponse();
    
  } catch (error: any) {
    console.error("[Chat Stream V2] Error:", error);
    
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