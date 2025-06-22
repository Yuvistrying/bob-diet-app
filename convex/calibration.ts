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
      .filter(q => q.eq(q.field("onboardingCompleted"), true))
      .collect();
    
    for (const user of users) {
      try {
        // Run calibration for this user
        await ctx.runMutation(internal.calibration.calibrateUserTargets, {
          userId: user.userId
        });
      } catch (error) {
        console.error(`Calibration failed for user ${user.userId}:`, error);
      }
    }
  },
});

// Main calibration function
export const calibrateUserTargets = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
    
    if (!profile) return;
    
    // Get last 2 weeks of data
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];
    
    // Get weight logs
    const weightLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", q => 
        q.eq("userId", userId)
         .gte("createdAt", twoWeeksAgo.getTime())
      )
      .collect();
    
    // Need at least 3 weight entries for calibration
    if (weightLogs.length < 3) {
      return { 
        status: "insufficient_data",
        message: "Need at least 3 weight entries in the last 2 weeks"
      };
    }
    
    // Get food logs for calorie tracking
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", q => 
        q.eq("userId", userId)
         .gte("date", twoWeeksAgoStr)
      )
      .collect();
    
    // Calculate daily averages
    const dailyCalories: Record<string, number> = {};
    foodLogs.forEach(log => {
      if (!dailyCalories[log.date]) {
        dailyCalories[log.date] = 0;
      }
      dailyCalories[log.date] += log.totalCalories;
    });
    
    const loggedDays = Object.keys(dailyCalories).length;
    if (loggedDays < 7) {
      return {
        status: "insufficient_data",
        message: "Need at least 7 days of food logs in the last 2 weeks"
      };
    }
    
    // Calculate average daily calories
    const totalCalories = Object.values(dailyCalories).reduce((sum, cal) => sum + cal, 0);
    const avgDailyCalories = Math.round(totalCalories / loggedDays);
    
    // Calculate weight change
    const sortedWeights = weightLogs.sort((a, b) => a.createdAt - b.createdAt);
    const startWeight = convertToKg(sortedWeights[0].weight, sortedWeights[0].unit);
    const endWeight = convertToKg(sortedWeights[sortedWeights.length - 1].weight, sortedWeights[sortedWeights.length - 1].unit);
    const actualWeightChange = endWeight - startWeight; // kg
    
    // Calculate expected weight change based on calories
    const dailyDeficit = profile.dailyCalorieTarget - avgDailyCalories;
    const expectedWeightChange = (dailyDeficit * loggedDays) / 7700; // 7700 cal = 1kg
    
    // Calculate the difference
    const weightDifference = actualWeightChange - expectedWeightChange;
    
    // Determine adjustment needed
    let adjustment = 0;
    let confidence = "high";
    let reason = "";
    
    if (Math.abs(weightDifference) < 0.2) {
      // Within 200g - no adjustment needed
      reason = "Weight change matches expected. No adjustment needed.";
    } else if (weightDifference > 0) {
      // Lost less weight than expected or gained weight
      // Need to reduce calorie target
      const adjustmentCalories = Math.round((weightDifference * 7700) / loggedDays);
      adjustment = -Math.min(adjustmentCalories, 200); // Max 200 cal reduction
      reason = `Lost ${Math.abs(weightDifference).toFixed(1)}kg less than expected. Reducing target.`;
      confidence = weightDifference > 0.5 ? "high" : "medium";
    } else {
      // Lost more weight than expected
      // Can increase calorie target
      const adjustmentCalories = Math.round((Math.abs(weightDifference) * 7700) / loggedDays);
      adjustment = Math.min(adjustmentCalories, 150); // Max 150 cal increase
      reason = `Lost ${Math.abs(weightDifference).toFixed(1)}kg more than expected. Increasing target.`;
      confidence = Math.abs(weightDifference) > 0.5 ? "high" : "medium";
    }
    
    // Apply adjustment if needed
    if (adjustment !== 0) {
      const newTarget = profile.dailyCalorieTarget + adjustment;
      
      // Save calibration history
      await ctx.db.insert("calibrationHistory", {
        userId,
        date: new Date().toISOString().split('T')[0],
        oldCalorieTarget: profile.dailyCalorieTarget,
        newCalorieTarget: newTarget,
        reason,
        dataPointsAnalyzed: loggedDays,
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
          loggedDays,
        }
      };
    }
    
    return {
      status: "no_adjustment_needed",
      reason,
      metrics: {
        avgDailyCalories,
        actualWeightChange,
        expectedWeightChange,
        loggedDays,
      }
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
      .withIndex("by_user", q => q.eq("userId", identity.subject))
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
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    
    if (!latest) return null;
    
    // Check if calibration is recent (within 2 weeks)
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const isRecent = latest.createdAt > twoWeeksAgo;
    
    return {
      ...latest,
      isRecent,
      weeksSince: Math.floor((Date.now() - latest.createdAt) / (7 * 24 * 60 * 60 * 1000))
    };
  },
});

// Helper to convert weight to kg
function convertToKg(weight: number, unit: string): number {
  return unit === "lbs" ? weight * 0.453592 : weight;
}

// Manual calibration trigger (for testing or on-demand)
export const triggerCalibration = mutation({
  args: {},
  handler: async (ctx): Promise<{
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
      loggedDays: number;
    };
    message?: string;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const result = await ctx.runMutation(internal.calibration.calibrateUserTargets, {
      userId: identity.subject
    });
    
    return result;
  },
});