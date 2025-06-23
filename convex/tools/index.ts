import { tool } from "ai";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Tool schemas
const foodItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const confidenceSchema = z.enum(["low", "medium", "high"]);

// Create tools function that accepts context
export function createTools(
  convexClient: ConvexHttpClient,
  userId: string,
  threadId: string,
  storageId?: string | Id<"_storage">,
  pendingConfirmation?: any
) {
  const tools: any = {};

  // Food confirmation tool
  tools.confirmFood = tool({
    description: "Show food understanding and ask for confirmation before logging",
    parameters: z.object({
      description: z.string().describe("Natural description of the food"),
      items: z.array(foodItemSchema).describe("Breakdown of food items"),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      mealType: mealTypeSchema.describe("Type of meal based on time of day"),
      confidence: confidenceSchema.describe("Confidence in the estimation"),
    }),
    execute: async (args) => {
      const toolCallId = `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await convexClient.mutation(api.pendingConfirmations.savePendingConfirmation, {
        threadId,
        toolCallId,
        confirmationData: args,
      });
      return args;
    },
  });

  // Food logging tool
  tools.logFood = tool({
    description: "Actually log the food after user confirmation",
    parameters: z.object({
      description: z.string(),
      items: z.array(foodItemSchema),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      mealType: mealTypeSchema,
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
      
      // Generate embedding for vector search
      try {
        const foodDescriptions = args.items.map((f: any) => `${f.quantity} ${f.name}`).join(", ");
        const embeddingText = `${args.mealType}: ${foodDescriptions} - ${args.description} (${args.totalCalories} calories, ${args.totalProtein}g protein)`;
        
        const embedding = await convexClient.action(api.embeddings.generateEmbedding, {
          text: embeddingText,
        });
        
        await convexClient.mutation(api.embeddings.updateFoodLogEmbedding, {
          foodLogId: logId,
          embedding,
        });
      } catch (error) {
        console.error("[logFood] Failed to generate embedding:", error);
      }
      
      // Confirm pending if exists
      if (pendingConfirmation) {
        await convexClient.mutation(api.pendingConfirmations.confirmPendingConfirmation, {
          confirmationId: pendingConfirmation._id,
        });
      }
      
      return { success: true, logId };
    },
  });

  // Photo analysis tool (only if storageId provided)
  if (storageId) {
    let hasAnalyzed = false; // Track if we've already analyzed this photo
    
    tools.analyzePhoto = tool({
      description: "Analyze a food photo to estimate calories and macros. Only call this ONCE per photo.",
      parameters: z.object({
        mealContext: z.string().optional().describe("Additional context about the meal type"),
      }),
      execute: async (args) => {
        console.log("[analyzePhoto tool] Execute called with storageId:", storageId);
        
        // Prevent multiple analyses of the same photo
        if (hasAnalyzed) {
          console.warn("[analyzePhoto tool] Already analyzed this photo, returning cached result");
          return { error: "Photo already analyzed. Use confirmFood to show the results." };
        }
        
        if (!storageId) {
          return { error: "No image uploaded. Please upload an image first." };
        }
        
        hasAnalyzed = true; // Mark as analyzed
        
        try {
          console.log("[analyzePhoto tool] Calling vision.analyzeFoodPublic");
          const result = await convexClient.action(api.vision.analyzeFoodPublic, {
            storageId: storageId as Id<"_storage">,
            context: args.mealContext,
          });
          
          console.log("[analyzePhoto tool] Result from vision:", result);
        
          if (!result.error && result.foods) {
            console.log("[analyzePhoto tool] Saving photo analysis");
            await convexClient.mutation(api.photoAnalyses.savePhotoAnalysis, {
              userId,
              timestamp: Date.now(),
              storageId: storageId as Id<"_storage">,
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
        } catch (error: any) {
          console.error("[analyzePhoto tool] Error:", error);
          return { 
            error: `Failed to analyze photo: ${error.message || 'Unknown error'}`,
          };
        }
      },
    });
    
    // Combined analyze and confirm tool for photos
    tools.analyzeAndConfirmPhoto = tool({
      description: "Analyze a food photo and immediately ask for confirmation - combines analyzePhoto and confirmFood in one step",
      parameters: z.object({
        mealContext: z.string().optional().describe("Additional context about the meal type"),
      }),
      execute: async (args) => {
        console.log("[analyzeAndConfirmPhoto tool] Execute called with storageId:", storageId);
        
        if (!storageId) {
          return { error: "No image uploaded. Please upload an image first." };
        }
        
        try {
          // Step 1: Analyze the photo
          console.log("[analyzeAndConfirmPhoto tool] Analyzing photo");
          const analysisResult = await convexClient.action(api.vision.analyzeFoodPublic, {
            storageId: storageId as Id<"_storage">,
            context: args.mealContext,
          });
          
          if (analysisResult.error || !analysisResult.foods) {
            return { error: analysisResult.error || "Failed to analyze photo" };
          }
          
          // Save photo analysis
          await convexClient.mutation(api.photoAnalyses.savePhotoAnalysis, {
            userId,
            timestamp: Date.now(),
            storageId: storageId as Id<"_storage">,
            analysis: {
              foods: analysisResult.foods,
              totalCalories: analysisResult.totalCalories,
              totalProtein: analysisResult.totalProtein,
              totalCarbs: analysisResult.totalCarbs,
              totalFat: analysisResult.totalFat,
              overallConfidence: analysisResult.confidence || analysisResult.overallConfidence,
              metadata: analysisResult.metadata,
            },
            confirmed: false,
            embedding: analysisResult.embedding,
          });
          
          // Step 2: Create confirmation data
          const hour = new Date().getHours();
          const mealType = 
            hour < 11 ? "breakfast" :
            hour < 15 ? "lunch" :
            hour < 18 ? "snack" :
            "dinner";
          
          const confirmationData = {
            description: analysisResult.foods.map((f: any) => f.name).join(", "),
            items: analysisResult.foods,
            totalCalories: analysisResult.totalCalories,
            totalProtein: analysisResult.totalProtein,
            totalCarbs: analysisResult.totalCarbs,
            totalFat: analysisResult.totalFat,
            mealType,
            confidence: analysisResult.confidence || "medium",
          };
          
          // Save pending confirmation
          const toolCallId = `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await convexClient.mutation(api.pendingConfirmations.savePendingConfirmation, {
            threadId,
            toolCallId,
            confirmationData,
          });
          
          // Return combined result
          return {
            analysisComplete: true,
            ...confirmationData,
          };
        } catch (error: any) {
          console.error("[analyzeAndConfirmPhoto tool] Error:", error);
          return { 
            error: `Failed to analyze photo: ${error.message || 'Unknown error'}`,
          };
        }
      },
    });
  }

  // Weight logging tool
  tools.logWeight = tool({
    description: "Log user's weight",
    parameters: z.object({
      weight: z.number().describe("Weight value"),
      unit: z.enum(["kg", "lbs"]).describe("Weight unit"),
      notes: z.string().optional().describe("Any notes about the weight"),
    }),
    execute: async (args) => {
      const logId = await convexClient.mutation(api.weightLogs.logWeight, args);
      return { success: true, logId };
    },
  });

  // Progress tool
  tools.showProgress = tool({
    description: "Show user's daily progress and remaining calories/macros",
    parameters: z.object({
      showDetailed: z.boolean().default(false).describe("Whether to show detailed macro breakdown"),
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
        carbs: stats.carbs,
        fat: stats.fat,
        meals: stats.meals || 0,
        detailed: args.showDetailed,
      };
    },
  });

  // Similar meals search tool
  tools.findSimilarMeals = tool({
    description: "Search for similar meals the user has eaten before",
    parameters: z.object({
      searchText: z.string().describe("Description of the meal to search for"),
      limit: z.number().default(3).describe("Number of similar meals to return"),
    }),
    execute: async (args) => {
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

  return tools;
}

// Intent detection utility
export function detectIntent(userMessage: string) {
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

// Helper to determine which tools to load
export function getToolsForIntent(intents: string[], hasPendingConfirmation: boolean) {
  const isConfirmingFood = intents.includes('confirmation') && hasPendingConfirmation;
  const needsFoodTools = !intents.length || 
    intents.some(i => ['food', 'photo', 'search'].includes(i)) || 
    isConfirmingFood;
  const needsWeightTool = intents.includes('weight');
  const needsProgressTool = intents.includes('progress') || !intents.length;
  const needsSearchTool = intents.includes('search') || intents.includes('food');
  
  return {
    needsFoodTools,
    needsWeightTool,
    needsProgressTool,
    needsSearchTool,
  };
}