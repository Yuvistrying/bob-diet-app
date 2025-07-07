import { v } from "convex/values";
import { query } from "./_generated/server";

// Enhanced context builder for Bob's agent
export const buildEnhancedContext = query({
  args: {
    contextType: v.optional(
      v.union(
        v.literal("meal_planning"),
        v.literal("calibration"),
        v.literal("progress_check"),
        v.literal("general"),
      ),
    ),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const contextType = args.contextType || "general";
    const daysBack = args.daysBack || 7;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(
      endDate.getTime() - daysBack * 24 * 60 * 60 * 1000,
    );
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Base context that's always included
    const baseContext = {
      profile: profile
        ? {
            name: profile.name,
            goal: profile.goal,
            currentWeight: profile.currentWeight,
            targetWeight: profile.targetWeight,
            dailyCalorieTarget: profile.dailyCalorieTarget,
            proteinTarget: profile.proteinTarget,
            preferredUnits: profile.preferredUnits,
          }
        : null,
      preferences: await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
    };

    // Build specific context based on type
    let specificContext: any = {};

    switch (contextType) {
      case "meal_planning":
        // Get successful meals (high protein, within calorie targets)
        const successfulMeals = await ctx.db
          .query("foodLogs")
          .withIndex("by_user_date")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), userId),
              q.gte(q.field("date"), startDateStr),
              q.lte(q.field("date"), endDateStr),
            ),
          )
          .filter((q) =>
            q.and(
              q.gte(q.field("totalProtein"), 20), // High protein meals
              q.lte(q.field("totalCalories"), 700), // Reasonable calories
            ),
          )
          .take(20);

        // Get meal patterns (what times they usually eat)
        const mealPatterns = await ctx.db
          .query("foodLogs")
          .withIndex("by_user_date")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), userId),
              q.gte(q.field("date"), startDateStr),
            ),
          )
          .collect();

        const mealTimes = mealPatterns.reduce((acc: any, log) => {
          if (!acc[log.meal]) acc[log.meal] = [];
          acc[log.meal].push(log.time);
          return acc;
        }, {});

        specificContext = {
          successfulMeals: successfulMeals.map((meal) => ({
            description: meal.description,
            calories: meal.totalCalories,
            protein: meal.totalProtein,
            meal: meal.meal,
            foods: meal.foods,
          })),
          mealPatterns: {
            averageMealTimes: Object.entries(mealTimes).reduce(
              (acc: any, [meal, times]: [string, any]) => {
                const avgHour = Math.round(
                  times.reduce((sum: number, time: string) => {
                    const [hour] = time.split(":");
                    return sum + parseInt(hour);
                  }, 0) / times.length,
                );
                acc[meal] = `${avgHour}:00`;
                return acc;
              },
              {},
            ),
            mealsPerDay: Math.round(mealPatterns.length / daysBack),
          },
          favoritesFoods: extractFrequentFoods(successfulMeals),
        };
        break;

      case "calibration":
        // Get detailed weight history
        const weightHistory = await ctx.db
          .query("weightLogs")
          .withIndex("by_user_date")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), userId),
              q.gte(q.field("date"), startDateStr),
              q.lte(q.field("date"), endDateStr),
            ),
          )
          .collect();

        // Get detailed food logs with adherence analysis
        const foodLogs = await ctx.db
          .query("foodLogs")
          .withIndex("by_user_date")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), userId),
              q.gte(q.field("date"), startDateStr),
              q.lte(q.field("date"), endDateStr),
            ),
          )
          .collect();

        // Calculate daily totals
        const dailyTotals = foodLogs.reduce((acc: any, log) => {
          if (!acc[log.date]) {
            acc[log.date] = {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              meals: 0,
            };
          }
          acc[log.date].calories += log.totalCalories;
          acc[log.date].protein += log.totalProtein;
          acc[log.date].carbs += log.totalCarbs;
          acc[log.date].fat += log.totalFat;
          acc[log.date].meals += 1;
          return acc;
        }, {});

        // Calculate adherence and consistency
        const daysWithData = Object.keys(dailyTotals).length;
        const perfectDays = Object.values(dailyTotals).filter(
          (day: any) =>
            profile &&
            Math.abs(day.calories - profile.dailyCalorieTarget) < 100,
        ).length;

        specificContext = {
          weightData: {
            entries: weightHistory.length,
            startWeight: weightHistory[0]?.weight,
            currentWeight: weightHistory[weightHistory.length - 1]?.weight,
            totalChange:
              weightHistory.length >= 2
                ? weightHistory[weightHistory.length - 1].weight -
                  weightHistory[0].weight
                : 0,
            consistency: Math.round((weightHistory.length / daysBack) * 100),
          },
          nutritionData: {
            daysTracked: daysWithData,
            completeDays: Object.values(dailyTotals).filter(
              (day: any) => day.meals >= 3,
            ).length,
            averageDailyCalories:
              daysWithData > 0
                ? Math.round(
                    Object.values(dailyTotals).reduce(
                      (sum: number, day: any) => sum + day.calories,
                      0,
                    ) / daysWithData,
                  )
                : 0,
            adherenceScore: Math.round((perfectDays / daysWithData) * 100),
            dailyBreakdown: dailyTotals,
          },
          previousCalibrations: await ctx.db
            .query("calibrationHistory")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(3),
        };
        break;

      case "progress_check":
        // Get recent achievements and milestones
        const recentWeights = await ctx.db
          .query("weightLogs")
          .withIndex("by_user_created", (q) => q.eq("userId", userId))
          .order("desc")
          .take(7);

        const recentStats = await ctx.db
          .query("weeklyAnalytics")
          .withIndex("by_user_week")
          .filter((q) => q.eq(q.field("userId"), userId))
          .order("desc")
          .take(4);

        specificContext = {
          recentProgress: {
            lastWeekWeight:
              recentWeights.length >= 7 ? recentWeights[6].weight : null,
            currentWeight: recentWeights[0]?.weight,
            weeklyChange:
              recentWeights.length >= 7
                ? recentWeights[0].weight - recentWeights[6].weight
                : null,
            trend: calculateTrend(recentWeights),
          },
          weeklyStats: recentStats,
          milestones: calculateMilestones(profile, recentWeights),
        };
        break;

      default:
        // General context - balanced mix of recent data
        const recentMeals = await ctx.db
          .query("foodLogs")
          .withIndex("by_user_date")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), userId),
              q.gte(q.field("date"), startDateStr),
            ),
          )
          .order("desc")
          .take(10);

        const latestWeight = await ctx.db
          .query("weightLogs")
          .withIndex("by_user_created", (q) => q.eq("userId", userId))
          .order("desc")
          .first();

        specificContext = {
          recentActivity: {
            lastMeal: recentMeals[0],
            mealsToday: recentMeals.filter((m) => m.date === endDateStr).length,
            lastWeight: latestWeight,
          },
        };
    }

    return {
      ...baseContext,
      contextType,
      dateRange: { start: startDateStr, end: endDateStr },
      ...specificContext,
    };
  },
});

// Helper functions
function extractFrequentFoods(meals: any[]): string[] {
  const foodCounts: Record<string, number> = {};

  meals.forEach((meal) => {
    meal.foods.forEach((food: any) => {
      const foodName = food.name.toLowerCase();
      foodCounts[foodName] = (foodCounts[foodName] || 0) + 1;
    });
  });

  return Object.entries(foodCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([food]) => food);
}

function calculateTrend(weights: any[]): string {
  if (weights.length < 3) return "insufficient_data";

  const recent = weights.slice(0, 3);
  const older = weights.slice(3, 6);

  if (older.length === 0) return "insufficient_data";

  const recentAvg =
    recent.reduce((sum, w) => sum + w.weight, 0) / recent.length;
  const olderAvg = older.reduce((sum, w) => sum + w.weight, 0) / older.length;

  const change = recentAvg - olderAvg;

  if (Math.abs(change) < 0.2) return "maintaining";
  if (change < 0) return "losing";
  return "gaining";
}

function calculateMilestones(profile: any, weights: any[]): any[] {
  if (!profile || weights.length === 0) return [];

  const milestones = [];
  const currentWeight = weights[0].weight;
  const startWeight = profile.currentWeight;
  const targetWeight = profile.targetWeight;

  const totalToLose = startWeight - targetWeight;
  const lost = startWeight - currentWeight;
  const percentComplete = (lost / totalToLose) * 100;

  if (percentComplete >= 10 && percentComplete < 25) {
    milestones.push({ type: "10_percent", achieved: true });
  }
  if (percentComplete >= 25 && percentComplete < 50) {
    milestones.push({ type: "quarter_way", achieved: true });
  }
  if (percentComplete >= 50 && percentComplete < 75) {
    milestones.push({ type: "halfway", achieved: true });
  }
  if (percentComplete >= 75) {
    milestones.push({ type: "three_quarters", achieved: true });
  }

  // Weight milestones (every 5kg)
  const fiveKgMilestones = Math.floor(lost / 5);
  if (fiveKgMilestones > 0) {
    milestones.push({
      type: "weight_milestone",
      value: `${fiveKgMilestones * 5}kg lost`,
      achieved: true,
    });
  }

  return milestones;
}
