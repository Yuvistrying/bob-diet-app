import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { bobAgent } from "./bobAgent";
import { z } from "zod";

// Schema for a detailed meal plan
const mealPlanSchema = z.object({
  title: z.string().describe("Title of the meal plan"),
  summary: z.string().describe("Brief summary of the plan"),
  dailyTargets: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  days: z.array(
    z.object({
      day: z.number(),
      dayName: z.string(),
      meals: z.object({
        breakfast: z.object({
          name: z.string(),
          foods: z.array(z.string()),
          preparation: z.string(),
          calories: z.number(),
          protein: z.number(),
          carbs: z.number(),
          fat: z.number(),
        }),
        lunch: z.object({
          name: z.string(),
          foods: z.array(z.string()),
          preparation: z.string(),
          calories: z.number(),
          protein: z.number(),
          carbs: z.number(),
          fat: z.number(),
        }),
        dinner: z.object({
          name: z.string(),
          foods: z.array(z.string()),
          preparation: z.string(),
          calories: z.number(),
          protein: z.number(),
          carbs: z.number(),
          fat: z.number(),
        }),
        snacks: z
          .array(
            z.object({
              name: z.string(),
              calories: z.number(),
              protein: z.number(),
            }),
          )
          .optional(),
      }),
      totals: z.object({
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
      }),
    }),
  ),
  shoppingList: z.array(
    z.object({
      category: z.string(),
      items: z.array(z.string()),
    }),
  ),
  tips: z.array(z.string()).describe("Helpful tips for following the plan"),
});

// Generate a detailed meal plan using AI
export const generateDetailedMealPlan = action({
  args: {
    days: v.number(),
    preferences: v.optional(
      v.object({
        avoidFoods: v.optional(v.array(v.string())),
        preferredFoods: v.optional(v.array(v.string())),
        cuisine: v.optional(v.string()),
        budget: v.optional(v.string()), // "low", "medium", "high"
        cookingTime: v.optional(v.string()), // "minimal", "moderate", "extensive"
      }),
    ),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get user profile
    const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
    if (!profile) {
      throw new Error("Please complete your profile setup first");
    }

    // Get recent meal history for context
    const recentMeals = await ctx.runQuery(api.foodLogs.searchMeals, {
      query: "",
      daysBack: 14,
      limit: 20,
    });

    // Create or continue thread
    let thread;
    let threadId = args.threadId;

    if (threadId) {
      const result = await bobAgent.continueThread(ctx, { threadId, userId });
      thread = result.thread;
    } else {
      const result = await bobAgent.createThread(ctx, {
        userId,
        metadata: {
          title: "Meal Plan Generation",
          type: "structured_generation",
        },
      });
      thread = result.thread;
      threadId = result.threadId;
    }

    // Build context for the meal plan
    const context = `
    User Profile:
    - Goal: ${profile.goal}
    - Daily Calorie Target: ${profile.dailyCalorieTarget}
    - Daily Protein Target: ${profile.proteinTarget}g
    - Carbs Target: ${profile.carbsTarget || Math.round((profile.dailyCalorieTarget * 0.4) / 4)}g
    - Fat Target: ${profile.fatTarget || Math.round((profile.dailyCalorieTarget * 0.3) / 9)}g
    
    Preferences:
    - Foods to avoid: ${args.preferences?.avoidFoods?.join(", ") || "None specified"}
    - Preferred foods: ${args.preferences?.preferredFoods?.join(", ") || "None specified"}
    - Cuisine preference: ${args.preferences?.cuisine || "Any"}
    - Budget: ${args.preferences?.budget || "Medium"}
    - Cooking time: ${args.preferences?.cookingTime || "Moderate"}
    
    Recent meals for inspiration:
    ${recentMeals
      .slice(0, 5)
      .map(
        (meal: any) =>
          `- ${meal.description} (${meal.totalCalories} cal, ${meal.totalProtein}g protein)`,
      )
      .join("\n")}
    `;

    try {
      // Generate structured meal plan
      const result = await thread.generateObject({
        prompt: `Create a detailed ${args.days}-day meal plan for this user. ${context}
        
        Important guidelines:
        1. Each day's total should match the user's targets closely
        2. Include variety in meals - don't repeat the same meals
        3. Make meals practical and easy to prepare
        4. Include a comprehensive shopping list organized by category
        5. Provide helpful tips for meal prep and adherence
        6. Consider the user's preferences and budget
        7. Balance macros appropriately throughout the day`,
        schema: mealPlanSchema,
        system:
          "You are Bob, an expert diet coach creating personalized meal plans.",
      });

      return {
        mealPlan: result.object,
        threadId,
      };
    } catch (error) {
      console.error("Error generating meal plan:", error);
      throw new Error("Failed to generate meal plan. Please try again.");
    }
  },
});

// Schema for a calibration report
const calibrationReportSchema = z.object({
  summary: z.string().describe("Executive summary of the analysis"),
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
    daysAnalyzed: z.number(),
  }),
  dataQuality: z.object({
    weightLogsCount: z.number(),
    foodLogsCount: z.number(),
    completeness: z.number().describe("Percentage of days with complete data"),
    reliability: z.enum(["high", "medium", "low"]),
  }),
  metabolismAnalysis: z.object({
    expectedTDEE: z
      .number()
      .describe("Expected Total Daily Energy Expenditure"),
    actualTDEE: z.number().describe("Actual TDEE based on results"),
    metabolicRate: z.enum(["slow", "normal", "fast"]),
    confidence: z.enum(["high", "medium", "low"]),
    explanation: z.string(),
  }),
  weightTrend: z.object({
    startWeight: z.number(),
    endWeight: z.number(),
    actualChange: z.number(),
    expectedChange: z.number(),
    weeklyAverage: z.number(),
    trend: z.enum(["losing", "maintaining", "gaining"]),
  }),
  calorieAnalysis: z.object({
    averageDailyIntake: z.number(),
    averageDailyDeficit: z.number(),
    consistency: z.number().describe("0-100 score"),
    adherence: z.number().describe("0-100 score"),
  }),
  recommendations: z.object({
    newCalorieTarget: z.number(),
    reasoning: z.string(),
    adjustmentSize: z.enum(["none", "small", "moderate", "large"]),
    otherSuggestions: z.array(z.string()),
  }),
  nextSteps: z.array(z.string()).describe("Actionable next steps for the user"),
});

// Generate a calibration report
export const generateCalibrationReport = action({
  args: {
    periodDays: v.number(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Get user profile
    const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
    if (!profile) {
      throw new Error("Please complete your profile setup first");
    }

    // Get weight history
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - args.periodDays * 24 * 60 * 60 * 1000,
    );

    const weightLogs = await ctx.runQuery(api.weightLogs.getWeightHistory, {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });

    // Get food logs
    const foodLogs = await ctx.runQuery(api.foodLogs.searchMeals, {
      query: "",
      daysBack: args.periodDays,
      limit: 1000, // Get all logs for the period
    });

    // Create or continue thread
    let thread;
    let threadId = args.threadId;

    if (threadId) {
      const result = await bobAgent.continueThread(ctx, { threadId, userId });
      thread = result.thread;
    } else {
      const result = await bobAgent.createThread(ctx, {
        userId,
        metadata: {
          title: "Calibration Report",
          type: "structured_generation",
        },
      });
      thread = result.thread;
      threadId = result.threadId;
    }

    // Calculate basic stats for context
    const avgDailyCalories =
      foodLogs.length > 0
        ? foodLogs.reduce(
            (sum: number, log: any) => sum + (log.totalCalories || 0),
            0,
          ) / args.periodDays
        : 0;

    const weightChange =
      weightLogs.length >= 2
        ? weightLogs[weightLogs.length - 1].weight - weightLogs[0].weight
        : 0;

    const context = `
    User Profile:
    - Current Goal: ${profile.goal}
    - Current Daily Target: ${profile.dailyCalorieTarget} calories
    - Height: ${profile.height}cm
    - Age: ${profile.age}
    - Gender: ${profile.gender}
    - Activity Level: ${profile.activityLevel}
    
    Period Analyzed: ${args.periodDays} days
    
    Weight Data:
    - Logs collected: ${weightLogs.length}
    - Starting weight: ${weightLogs[0]?.weight || "No data"}
    - Ending weight: ${weightLogs[weightLogs.length - 1]?.weight || "No data"}
    - Total change: ${weightChange}kg
    
    Food Data:
    - Meals logged: ${foodLogs.length}
    - Average daily calories: ${Math.round(avgDailyCalories)}
    - Days with complete logging: ${Math.round(foodLogs.length / 3)} (estimate)
    `;

    try {
      // Generate calibration report
      const result = await thread.generateObject({
        prompt: `Analyze this user's diet and weight data to create a comprehensive calibration report. ${context}
        
        Important analysis points:
        1. Calculate their actual TDEE based on weight change and calorie intake
        2. Determine if their metabolism is slower/faster than expected
        3. Recommend specific calorie target adjustments if needed
        4. Assess data quality and reliability
        5. Provide actionable recommendations
        6. Consider adherence and consistency patterns
        7. Account for water weight fluctuations in short periods`,
        schema: calibrationReportSchema,
        system:
          "You are Bob, an expert diet coach performing a detailed metabolic calibration analysis.",
      });

      // Save calibration to history if significant adjustment recommended
      if (result.object.recommendations.adjustmentSize !== "none") {
        await ctx.runMutation(api.calibrationHistory.saveCalibration, {
          oldCalorieTarget: profile.dailyCalorieTarget,
          newCalorieTarget: result.object.recommendations.newCalorieTarget,
          reason: result.object.recommendations.reasoning,
          dataPointsAnalyzed: weightLogs.length + foodLogs.length,
          confidence: result.object.metabolismAnalysis.confidence,
        });
      }

      return {
        report: result.object,
        threadId,
      };
    } catch (error) {
      console.error("Error generating calibration report:", error);
      throw new Error(
        "Failed to generate calibration report. Please try again.",
      );
    }
  },
});
