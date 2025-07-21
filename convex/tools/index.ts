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

// Tool selection interface
interface ToolSelection {
  needsFoodTools: boolean;
  needsWeightTool: boolean;
  needsProgressTool: boolean;
  needsSearchTool: boolean;
  needsOnboardingTool: boolean;
}

// Create tools function that accepts context and tool selection
export function createTools(
  convexClient: ConvexHttpClient,
  userId: string,
  threadId: string,
  storageId?: string | Id<"_storage">,
  pendingConfirmation?: any,
  toolSelection?: ToolSelection,
) {
  const tools: any = {};

  // If no selection provided, load all tools (backward compatibility)
  if (!toolSelection) {
    toolSelection = {
      needsFoodTools: true,
      needsWeightTool: true,
      needsProgressTool: true,
      needsSearchTool: true,
      needsOnboardingTool: false,
    };
  }

  // Food confirmation tool (only if needed)
  if (toolSelection.needsFoodTools) {
    tools.confirmFood = tool({
      description:
        "Show food understanding and ask for confirmation before logging",
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
        // Generate a proper UUID for this confirmation
        const confirmationId = `confirm-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const toolCallId = `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        await convexClient.mutation(
          api.pendingConfirmations.savePendingConfirmation,
          {
            threadId,
            toolCallId,
            confirmationData: args,
          },
        );

        // Return args with the confirmationId included
        return {
          ...args,
          confirmationId,
        };
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
          const foodDescriptions = args.items
            .map((f: any) => `${f.quantity} ${f.name}`)
            .join(", ");
          const embeddingText = `${args.mealType}: ${foodDescriptions} - ${args.description} (${args.totalCalories} calories, ${args.totalProtein}g protein)`;

          const embedding = await convexClient.action(
            api.embeddings.generateEmbedding,
            {
              text: embeddingText,
            },
          );

          await convexClient.mutation(api.embeddings.updateFoodLogEmbedding, {
            foodLogId: logId,
            embedding,
          });
        } catch (error) {
          console.error("[logFood] Failed to generate embedding:", error);
        }

        // Confirm pending if exists
        if (pendingConfirmation) {
          await convexClient.mutation(
            api.pendingConfirmations.confirmPendingConfirmation,
            {
              confirmationId: pendingConfirmation._id,
            },
          );
        }

        return { success: true, logId };
      },
    });
  }

  // Photo analysis tool (only if storageId provided and food tools needed)
  if (storageId && toolSelection.needsFoodTools) {
    // Combined analyze and confirm tool for photos
    tools.analyzeAndConfirmPhoto = tool({
      description:
        "Analyze a food photo and immediately ask for confirmation - combines analyzePhoto and confirmFood in one step",
      parameters: z.object({
        mealContext: z
          .string()
          .optional()
          .describe("Additional context about the meal type"),
      }),
      execute: async (args) => {
        console.log(
          "[analyzeAndConfirmPhoto tool] Execute called with storageId:",
          storageId,
        );

        if (!storageId) {
          return { error: "No image uploaded. Please upload an image first." };
        }

        try {
          // Step 1: Analyze the photo
          console.log("[analyzeAndConfirmPhoto tool] Analyzing photo");
          const analysisResult = await convexClient.action(
            api.vision.analyzeFoodPublic,
            {
              storageId: storageId as Id<"_storage">,
              context: args.mealContext,
            },
          );

          console.log("[analyzeAndConfirmPhoto tool] Analysis result:", {
            hasError: !!analysisResult.error,
            noFood: analysisResult.noFood,
            hasFoods: !!analysisResult.foods,
            foodCount: analysisResult.foods?.length,
            totalCalories: analysisResult.totalCalories,
            rawKeys: Object.keys(analysisResult),
          });

          if (analysisResult.error || !analysisResult.foods) {
            // Check if it's a "no food detected" error
            if (analysisResult.noFood) {
              console.log(
                "[analyzeAndConfirmPhoto tool] No food detected, returning minimal response",
              );
              // Return minimal response to let Bob handle it with regular text
              return {
                noFoodDetected: true,
              };
            }
            // For other errors, return minimal error info
            console.log(
              "[analyzeAndConfirmPhoto tool] Other error, returning error response",
            );
            return {
              error: true,
            };
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
              overallConfidence:
                analysisResult.confidence || analysisResult.overallConfidence,
              metadata: analysisResult.metadata,
            },
            confirmed: false,
            embedding: analysisResult.embedding,
          });

          // Step 2: Create confirmation data
          const hour = new Date().getHours();
          const mealType =
            hour < 11
              ? "breakfast"
              : hour < 15
                ? "lunch"
                : hour < 18
                  ? "snack"
                  : "dinner";

          const confirmationData = {
            description: analysisResult.foods
              .map((f: any) => f.name)
              .join(", "),
            items: analysisResult.foods.map((f: any) => ({
              name: f.name,
              quantity: f.quantity,
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
              // Remove confidence field from items
            })),
            totalCalories: analysisResult.totalCalories,
            totalProtein: analysisResult.totalProtein,
            totalCarbs: analysisResult.totalCarbs,
            totalFat: analysisResult.totalFat,
            mealType,
            confidence: analysisResult.confidence || "medium",
          };

          // Generate a proper UUID for this confirmation
          const confirmationId = `confirm-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          const toolCallId = `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          // Save pending confirmation
          await convexClient.mutation(
            api.pendingConfirmations.savePendingConfirmation,
            {
              threadId,
              toolCallId,
              confirmationData,
            },
          );

          // Return combined result with confirmationId
          return {
            analysisComplete: true,
            ...confirmationData,
            confirmationId,
          };
        } catch (error: any) {
          console.error("[analyzeAndConfirmPhoto tool] Error:", error);
          return {
            error: `Failed to analyze photo: ${error.message || "Unknown error"}`,
          };
        }
      },
    });
  }

  // Weight logging tool (only if needed)
  if (toolSelection.needsWeightTool) {
    tools.logWeight = tool({
      description: "Log user's weight",
      parameters: z.object({
        weight: z.number().describe("Weight value"),
        unit: z.enum(["kg", "lbs"]).describe("Weight unit"),
        notes: z.string().optional().describe("Any notes about the weight"),
      }),
      execute: async (args) => {
        console.log("[logWeight tool] Execute called with args:", args);
        console.log(
          "[logWeight tool] Weight:",
          args.weight,
          "Unit:",
          args.unit,
        );

        if (!args.weight || !args.unit) {
          console.error(
            "[logWeight tool] ERROR: Missing required parameters!",
            {
              weight: args.weight,
              unit: args.unit,
              fullArgs: args,
            },
          );
          return {
            success: false,
            error: `Missing required parameters: weight=${args.weight}, unit=${args.unit}`,
          };
        }

        try {
          const logId = await convexClient.mutation(
            api.weightLogs.logWeight,
            args,
          );
          console.log(
            "[logWeight tool] Successfully logged weight with ID:",
            logId,
          );
          return { success: true, logId };
        } catch (error) {
          console.error("[logWeight tool] ERROR calling mutation:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },
    });
  }

  // Progress tool (only if needed)
  if (toolSelection.needsProgressTool) {
    tools.showProgress = tool({
      description: "Show user's daily progress and remaining calories/macros",
      parameters: z.object({
        showDetailed: z
          .boolean()
          .default(false)
          .describe("Whether to show detailed macro breakdown"),
      }),
      execute: async (args) => {
        const stats = await convexClient.query(api.foodLogs.getTodayStats);
        const profile = await convexClient.query(
          api.userProfiles.getUserProfile,
          {},
        );

        if (!stats || !profile) {
          return { summary: "No data available yet." };
        }

        return {
          calories: {
            consumed: stats.calories,
            target: profile.dailyCalorieTarget,
            remaining: profile.dailyCalorieTarget - stats.calories,
          },
          protein: {
            consumed: stats.protein,
            target: profile.proteinTarget,
            remaining: profile.proteinTarget - stats.protein,
          },
          carbs: stats.carbs,
          fat: stats.fat,
          meals: stats.meals || 0,
          detailed: args.showDetailed,
        };
      },
    });
  }

  // Similar meals search tool (only if needed)
  if (toolSelection.needsSearchTool) {
    tools.findSimilarMeals = tool({
      description: "Search for similar meals the user has eaten before",
      parameters: z.object({
        searchText: z
          .string()
          .describe("Description of the meal to search for"),
        limit: z
          .number()
          .default(3)
          .describe("Number of similar meals to return"),
      }),
      execute: async (args) => {
        const results = await convexClient.action(
          api.vectorSearch.searchSimilarMeals,
          {
            searchText: args.searchText,
            limit: args.limit,
          },
        );
        return {
          meals: results,
          message: results.length
            ? `Found ${results.length} similar meals.`
            : "No similar meals found.",
        };
      },
    });
  }

  // Weekly insights tool (for Sunday summaries) - always include on Sundays
  const isSunday = new Date().getDay() === 0;
  if (isSunday || toolSelection.needsProgressTool) {
    tools.weeklyInsights = tool({
      description:
        "Show weekly summary with progress, insights, and calibration updates",
      parameters: z.object({
        showCalibration: z
          .boolean()
          .default(true)
          .describe("Whether to include calibration update if applicable"),
      }),
      execute: async (args) => {
        // Get user profile
        const profile = await convexClient.query(
          api.userProfiles.getUserProfile,
          {},
        );
        if (!profile) {
          return { error: "No user profile found" };
        }

        // Get week dates
        const now = new Date();
        const sunday = new Date(now);
        sunday.setDate(now.getDate() - now.getDay()); // Last Sunday
        const monday = new Date(sunday);
        monday.setDate(sunday.getDate() - 6); // Monday before

        const weekStartStr = monday.toISOString().split("T")[0];
        const weekEndStr = sunday.toISOString().split("T")[0];

        // Get weight data for the week
        const weightLogs = await convexClient.query(
          api.weightLogs.getWeightLogsRange,
          {
            startDate: weekStartStr,
            endDate: weekEndStr,
          },
        );

        // Get food logs for the week
        const foodStats = await convexClient.query(
          api.foodLogs.getWeeklyStats,
          {
            weekStartDate: weekStartStr,
          },
        );

        // Get calibration data
        const calibrationData = await convexClient.query(
          api.calibration.getLatestCalibration,
          {},
        );

        // Calculate metrics
        const startWeight = weightLogs[0]?.weight || profile.currentWeight;
        const endWeight =
          weightLogs[weightLogs.length - 1]?.weight || startWeight;
        const weightChange = endWeight - startWeight;
        const loggingConsistency = foodStats
          ? Math.round((foodStats.mealsLogged / 21) * 100)
          : 0;

        // Format dates for display
        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          return `${months[date.getMonth()]} ${date.getDate()}`;
        };

        // Build summary data
        const summaryData = {
          weekStartDate: weekStartStr,
          weekEndDate: weekEndStr,
          weekStartDateFormatted: formatDate(weekStartStr),
          weekEndDateFormatted: formatDate(weekEndStr),
          startWeight,
          endWeight,
          weightChange,
          averageDailyCalories: foodStats?.averageCalories || 0,
          targetDailyCalories: profile.dailyCalorieTarget,
          mealsLogged: foodStats?.mealsLogged || 0,
          totalMealsPossible: 21,
          loggingConsistency,
          weightTrackingDays: weightLogs.length,
          expectedWeightChange: foodStats?.expectedWeightChange || 0,
          actualWeightChange: weightChange,
          calibrationAdjustment: calibrationData?.adjustment || undefined,
        };

        // Remove formatted dates before saving to database
        const dataForDb = {
          weekStartDate: summaryData.weekStartDate,
          weekEndDate: summaryData.weekEndDate,
          startWeight: summaryData.startWeight,
          endWeight: summaryData.endWeight,
          weightChange: summaryData.weightChange,
          averageDailyCalories: summaryData.averageDailyCalories,
          targetDailyCalories: summaryData.targetDailyCalories,
          mealsLogged: summaryData.mealsLogged,
          totalMealsPossible: summaryData.totalMealsPossible,
          loggingConsistency: summaryData.loggingConsistency,
          weightTrackingDays: summaryData.weightTrackingDays,
          expectedWeightChange: summaryData.expectedWeightChange,
          actualWeightChange: summaryData.actualWeightChange,
          calibrationAdjustment: summaryData.calibrationAdjustment,
        };

        // Save summary to database
        await convexClient.mutation(
          api.weeklySummaries.saveWeeklySummary,
          dataForDb,
        );

        return summaryData;
      },
    });
  }

  // Dietary preferences tools (always available)
  tools.updateDietaryRestrictions = tool({
    description: "Update user's dietary restrictions based on conversation",
    parameters: z.object({
      action: z
        .enum(["add", "remove"])
        .describe("Whether to add or remove restrictions"),
      restrictions: z
        .array(z.string())
        .describe("Dietary restrictions to add or remove"),
      reason: z
        .string()
        .optional()
        .describe("Why the user is making this change"),
    }),
    execute: async (args) => {
      try {
        // Get current preferences
        const currentPrefs = await convexClient.query(
          api.dietaryPreferences.getUserDietaryPreferences,
          {},
        );

        let newRestrictions = currentPrefs?.restrictions || [];

        if (args.action === "add") {
          // Add new restrictions
          const toAdd = args.restrictions.filter(
            (r) => !newRestrictions.includes(r),
          );
          newRestrictions = [...newRestrictions, ...toAdd];
        } else {
          // Remove restrictions
          newRestrictions = newRestrictions.filter(
            (r) => !args.restrictions.includes(r),
          );
        }

        // Update preferences
        await convexClient.mutation(
          api.dietaryPreferences.setDietaryPreferences,
          {
            restrictions: newRestrictions,
            customNotes: currentPrefs?.customNotes,
            intermittentFasting: currentPrefs?.intermittentFasting,
          },
        );

        return {
          success: true,
          action: args.action,
          restrictions: args.restrictions,
          currentRestrictions: newRestrictions,
        };
      } catch (error) {
        console.error("Error updating dietary restrictions:", error);
        return { error: "Failed to update dietary restrictions" };
      }
    },
  });

  tools.setIntermittentFasting = tool({
    description: "Set or update intermittent fasting schedule",
    parameters: z.object({
      enabled: z.boolean().describe("Whether intermittent fasting is enabled"),
      startHour: z
        .number()
        .min(0)
        .max(23)
        .describe("Hour when eating window starts (0-23)"),
      endHour: z
        .number()
        .min(0)
        .max(23)
        .describe("Hour when eating window ends (0-23)"),
    }),
    execute: async (args) => {
      try {
        // Get current preferences
        const currentPrefs = await convexClient.query(
          api.dietaryPreferences.getUserDietaryPreferences,
          {},
        );

        // Update preferences
        await convexClient.mutation(
          api.dietaryPreferences.setDietaryPreferences,
          {
            restrictions: currentPrefs?.restrictions || [],
            customNotes: currentPrefs?.customNotes,
            intermittentFasting: args.enabled
              ? {
                  enabled: true,
                  startHour: args.startHour,
                  endHour: args.endHour,
                }
              : undefined,
          },
        );

        return {
          success: true,
          enabled: args.enabled,
          schedule: args.enabled
            ? `${args.startHour}:00 - ${args.endHour}:00`
            : "Disabled",
        };
      } catch (error) {
        console.error("Error updating intermittent fasting:", error);
        return { error: "Failed to update intermittent fasting settings" };
      }
    },
  });

  tools.addCustomDietaryNote = tool({
    description:
      "Add or update custom dietary notes (allergies, medical conditions, preferences)",
    parameters: z.object({
      note: z
        .string()
        .describe("Custom dietary note or medical condition to add"),
      append: z
        .boolean()
        .default(true)
        .describe("Whether to append to existing notes or replace"),
    }),
    execute: async (args) => {
      try {
        // Get current preferences
        const currentPrefs = await convexClient.query(
          api.dietaryPreferences.getUserDietaryPreferences,
          {},
        );

        let newNotes = args.note;
        if (args.append && currentPrefs?.customNotes) {
          newNotes = currentPrefs.customNotes + ". " + args.note;
        }

        // Update preferences
        await convexClient.mutation(
          api.dietaryPreferences.setDietaryPreferences,
          {
            restrictions: currentPrefs?.restrictions || [],
            customNotes: newNotes,
            intermittentFasting: currentPrefs?.intermittentFasting,
          },
        );

        return {
          success: true,
          customNotes: newNotes,
        };
      } catch (error) {
        console.error("Error updating custom dietary notes:", error);
        return { error: "Failed to update custom dietary notes" };
      }
    },
  });

  // Onboarding progress tool (only if needed)
  if (toolSelection.needsOnboardingTool) {
    tools.saveOnboardingProgress = tool({
      description:
        "Save user's onboarding response and progress to the next step",
      parameters: z.object({
        step: z
          .string()
          .describe("Current onboarding step (e.g., 'name', 'current_weight')"),
        response: z
          .any()
          .describe("User's response to the onboarding question"),
      }),
      execute: async (args) => {
        try {
          await convexClient.mutation(api.onboarding.saveOnboardingProgress, {
            step: args.step,
            response: args.response,
          });

          return {
            success: true,
            step: args.step,
            saved: true,
          };
        } catch (error) {
          console.error("Error saving onboarding progress:", error);
          return { error: "Failed to save onboarding progress" };
        }
      },
    });
  }

  return tools;
}

// Intent detection utility
export function detectIntent(userMessage: string) {
  const msg = userMessage.toLowerCase();

  // Check for query patterns first (higher priority)
  const queryPatterns = [
    /what (did i|have i|i) (eat|ate|had)/i,
    /show me (my|today|what)/i,
    /how (much|many) (did i|have i|calories)/i,
    /list (my|today|what i)/i,
    /tell me (what|about)/i,
  ];

  const isQuery = queryPatterns.some((pattern) => pattern.test(msg));

  const intents: Record<string, RegExp> = {
    food: /\b(ate|had|eat|eating|food|meal|breakfast|lunch|dinner|snack|log|for me)\b/i,
    weight: /\b(weight|weigh|weighed|weighing|scale|kg|lbs|pounds|kilos)\b/i,
    progress: /\b(progress|today|left|remaining|how|calories|status)\b/i,
    photo: /\b(photo|image|picture|upload)\b/i,
    greeting: /^(hi|hello|hey|good morning|morning)\b/i,
    confirmation: /^(yes|yep|sure|ok|correct|right|confirm)\b/i,
    search:
      /\b(similar|before|past|history|had before|eaten before|last time)\b/i,
  };

  const detected = [];

  // If it's a query, prioritize progress intent
  if (isQuery) {
    detected.push("query");
    detected.push("progress");
    // Don't add 'food' intent for queries
    return detected;
  }

  // Otherwise, normal intent detection
  for (const [intent, regex] of Object.entries(intents)) {
    if (regex.test(msg)) {
      detected.push(intent);
    }
  }

  return detected;
}

// Helper to determine which tools to load
export function getToolsForIntent(
  intents: string[],
  hasPendingConfirmation: boolean,
) {
  const isConfirmingFood =
    intents.includes("confirmation") && hasPendingConfirmation;
  const isQuery = intents.includes("query");

  // For queries, only load showProgress tool
  if (isQuery && !isConfirmingFood) {
    return {
      needsFoodTools: false,
      needsWeightTool: false,
      needsProgressTool: true,
      needsSearchTool: false,
      needsOnboardingTool: false,
    };
  }

  const needsFoodTools =
    !intents.length ||
    intents.some((i) => ["food", "photo", "search"].includes(i)) ||
    isConfirmingFood;
  const needsWeightTool = intents.includes("weight");
  const needsProgressTool = intents.includes("progress") || !intents.length;
  const needsSearchTool =
    intents.includes("search") || intents.includes("food");

  return {
    needsFoodTools,
    needsWeightTool,
    needsProgressTool,
    needsSearchTool,
    needsOnboardingTool: false, // Will be determined by onboarding status
  };
}
