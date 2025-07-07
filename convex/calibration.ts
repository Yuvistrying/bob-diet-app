import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Weekly calibration task - will be called by cron
export const runWeeklyCalibration = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all active users
    const users = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("onboardingCompleted"), true))
      .collect();

    for (const user of users) {
      try {
        // Run calibration for this user
        await ctx.runMutation(internal.calibration.calibrateUserTargets, {
          userId: user.userId,
        });
      } catch (error) {
        console.error(`Calibration failed for user ${user.userId}:`, error);
      }
    }
  },
});

// Main calibration function - uses 7-day moving averages
export const calibrateUserTargets = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return;

    // Get last 2 weeks of data
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split("T")[0];

    // Get weight logs
    const weightLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q) =>
        q.eq("userId", userId).gte("createdAt", twoWeeksAgo.getTime()),
      )
      .collect();

    // For first week, we need at least 1 weight entry
    // For subsequent weeks, need at least 7 days of data
    const isFirstWeek = weightLogs.length < 7;
    if (weightLogs.length < 1) {
      return {
        status: "insufficient_data",
        message: "Need at least 1 weight entry to start calibration",
      };
    }

    // Get food logs for calorie tracking
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", twoWeeksAgoStr),
      )
      .collect();

    // Build daily data map
    const dailyData: Record<string, { calories: number; weight?: number }> = {};

    // Add calorie data
    foodLogs.forEach((log) => {
      if (!dailyData[log.date]) {
        dailyData[log.date] = { calories: 0 };
      }
      dailyData[log.date].calories += log.totalCalories;
    });

    // Add weight data (use most recent weight for each day)
    const weightsByDate: Record<string, number> = {};
    weightLogs.forEach((log) => {
      const date = new Date(log.createdAt).toISOString().split("T")[0];
      const weightInKg = convertToKg(log.weight, log.unit);
      // Keep the most recent weight for each day
      if (!weightsByDate[date] || log.createdAt > (weightsByDate[date] || 0)) {
        weightsByDate[date] = weightInKg;
      }
    });

    // Fill in daily data with weights
    Object.entries(weightsByDate).forEach(([date, weight]) => {
      if (!dailyData[date]) {
        dailyData[date] = { calories: 0 };
      }
      dailyData[date].weight = weight;
    });

    // Sort dates
    const sortedDates = Object.keys(dailyData).sort();

    if (sortedDates.length < 7) {
      return {
        status: "insufficient_data",
        message: "Need at least 7 days of data for calibration",
      };
    }

    // Calculate 7-day moving averages
    const movingAverages = calculateMovingAverages(
      dailyData,
      sortedDates,
      weightsByDate,
    );

    if (movingAverages.length < 2) {
      return {
        status: "insufficient_data",
        message: "Need more data to calculate trend",
      };
    }

    // For first week, use first weight as baseline
    // Otherwise, compare first and last 7-day averages
    let startWeight: number;
    let endWeight: number;
    let avgDailyCalories: number;

    if (isFirstWeek) {
      // Use first weight entry as baseline
      startWeight = convertToKg(weightLogs[0].weight, weightLogs[0].unit);
      endWeight = movingAverages[movingAverages.length - 1].avgWeight;
      avgDailyCalories = movingAverages[movingAverages.length - 1].avgCalories;
    } else {
      // Compare week 1 average to week 2 average
      const week1Average = movingAverages[6]; // 7th day (0-indexed)
      const week2Average = movingAverages[movingAverages.length - 1]; // Last day

      startWeight = week1Average.avgWeight;
      endWeight = week2Average.avgWeight;
      avgDailyCalories = week2Average.avgCalories;
    }

    const actualWeightChange = endWeight - startWeight; // kg
    const periodDays = isFirstWeek ? 7 : movingAverages.length;

    // Calculate expected weight change based on average calorie deficit/surplus
    const dailyDeficit = profile.dailyCalorieTarget - avgDailyCalories;
    const expectedWeightChange = (dailyDeficit * periodDays) / 7700; // 7700 cal = 1kg

    // Calculate the difference
    const weightDifference = actualWeightChange - expectedWeightChange;

    // Determine adjustment needed
    let adjustment = 0;
    let confidence = "high";
    let reason = "";

    if (Math.abs(weightDifference) < 0.2) {
      // Within 200g - no adjustment needed
      reason = isFirstWeek
        ? "Weight trend matches expected. No adjustment needed."
        : "7-day average weight change matches expected. No adjustment needed.";
    } else if (weightDifference > 0) {
      // Lost less weight than expected or gained weight
      // Need to reduce calorie target
      const adjustmentCalories = Math.round(
        (weightDifference * 7700) / periodDays,
      );
      adjustment = -Math.min(adjustmentCalories, 200); // Max 200 cal reduction
      reason = isFirstWeek
        ? `Weight trending ${Math.abs(weightDifference).toFixed(1)}kg higher than expected. Reducing calorie target.`
        : `7-day average shows ${Math.abs(weightDifference).toFixed(1)}kg less loss than expected. Reducing calorie target.`;
      confidence = weightDifference > 0.5 ? "high" : "medium";
    } else {
      // Lost more weight than expected
      // Can increase calorie target
      const adjustmentCalories = Math.round(
        (Math.abs(weightDifference) * 7700) / periodDays,
      );
      adjustment = Math.min(adjustmentCalories, 150); // Max 150 cal increase
      reason = isFirstWeek
        ? `Weight trending ${Math.abs(weightDifference).toFixed(1)}kg lower than expected. Increasing calorie target.`
        : `7-day average shows ${Math.abs(weightDifference).toFixed(1)}kg more loss than expected. Increasing calorie target.`;
      confidence = Math.abs(weightDifference) > 0.5 ? "high" : "medium";
    }

    // Apply adjustment if needed
    if (adjustment !== 0) {
      const newTarget = profile.dailyCalorieTarget + adjustment;

      // Save calibration history
      await ctx.db.insert("calibrationHistory", {
        userId,
        date: new Date().toISOString().split("T")[0],
        oldCalorieTarget: profile.dailyCalorieTarget,
        newCalorieTarget: newTarget,
        reason,
        dataPointsAnalyzed: periodDays,
        confidence,
        createdAt: Date.now(),
      });

      // Update user profile
      await ctx.db.patch(profile._id, {
        dailyCalorieTarget: newTarget,
        updatedAt: Date.now(),
      });

      return {
        status: "calibrated",
        oldTarget: profile.dailyCalorieTarget,
        newTarget,
        adjustment,
        reason,
        confidence,
        metrics: {
          avgDailyCalories,
          actualWeightChange,
          expectedWeightChange,
          periodDays,
          startWeight,
          endWeight,
          isFirstWeek,
          movingAverageCount: movingAverages.length,
        },
      };
    }

    return {
      status: "no_adjustment_needed",
      reason,
      metrics: {
        avgDailyCalories,
        actualWeightChange,
        expectedWeightChange,
        periodDays,
        startWeight,
        endWeight,
        isFirstWeek,
        movingAverageCount: movingAverages.length,
      },
    };
  },
});

// Get calibration history for a user
export const getCalibrationHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("calibrationHistory")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(10);
  },
});

// Get latest calibration insights
export const getLatestCalibration = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const latest = await ctx.db
      .query("calibrationHistory")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .first();

    if (!latest) return null;

    // Check if calibration is recent (within 2 weeks)
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const isRecent = latest.createdAt > twoWeeksAgo;

    return {
      ...latest,
      isRecent,
      weeksSince: Math.floor(
        (Date.now() - latest.createdAt) / (7 * 24 * 60 * 60 * 1000),
      ),
      adjustment:
        latest.newCalorieTarget && latest.oldCalorieTarget
          ? {
              oldTarget: latest.oldCalorieTarget,
              newTarget: latest.newCalorieTarget,
              reason: latest.reason,
            }
          : null,
    };
  },
});

// Helper to convert weight to kg
function convertToKg(weight: number, unit: string): number {
  return unit === "lbs" ? weight * 0.453592 : weight;
}

// Calculate 7-day moving averages for weight and calories
function calculateMovingAverages(
  dailyData: Record<string, { calories: number; weight?: number }>,
  sortedDates: string[],
  weightsByDate: Record<string, number>,
): Array<{ date: string; avgWeight: number; avgCalories: number }> {
  const movingAverages: Array<{
    date: string;
    avgWeight: number;
    avgCalories: number;
  }> = [];

  // Need at least 7 days for first average
  if (sortedDates.length < 7) return movingAverages;

  // Calculate moving average for each day (starting from day 7)
  for (let i = 6; i < sortedDates.length; i++) {
    const endDate = sortedDates[i];
    let weightSum = 0;
    let weightCount = 0;
    let calorieSum = 0;
    let calorieCount = 0;

    // Look back 7 days
    for (let j = i - 6; j <= i; j++) {
      const date = sortedDates[j];
      const data = dailyData[date];

      // For calories, use actual data or 0 if no logs
      calorieSum += data.calories || 0;
      calorieCount++;

      // For weight, carry forward the last known weight
      let weightForDay = data.weight;
      if (!weightForDay) {
        // Find the most recent weight before this date
        for (let k = j - 1; k >= 0; k--) {
          const prevDate = sortedDates[k];
          if (dailyData[prevDate]?.weight) {
            weightForDay = dailyData[prevDate].weight;
            break;
          }
        }
      }

      if (weightForDay) {
        weightSum += weightForDay;
        weightCount++;
      }
    }

    // Only add if we have weight data
    if (weightCount > 0) {
      movingAverages.push({
        date: endDate,
        avgWeight: weightSum / weightCount,
        avgCalories: calorieSum / calorieCount,
      });
    }
  }

  return movingAverages;
}

// Manual calibration trigger (for testing or on-demand)
export const triggerCalibration = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    status: string;
    oldTarget?: number;
    newTarget?: number;
    adjustment?: number;
    reason?: string;
    confidence?: string;
    metrics?: {
      avgDailyCalories: number;
      actualWeightChange: number;
      expectedWeightChange: number;
      periodDays: number;
      startWeight: number;
      endWeight: number;
      isFirstWeek: boolean;
      movingAverageCount: number;
    };
    message?: string;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const result = await ctx.runMutation(
      internal.calibration.calibrateUserTargets,
      {
        userId: identity.subject,
      },
    );

    return result;
  },
});
