import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a calibration event
export const saveCalibration = mutation({
  args: {
    oldCalorieTarget: v.number(),
    newCalorieTarget: v.number(),
    reason: v.string(),
    dataPointsAnalyzed: v.number(),
    confidence: v.string(), // "high", "medium", "low"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const date = new Date().toISOString().split('T')[0];
    
    await ctx.db.insert("calibrationHistory", {
      userId: identity.subject,
      date,
      oldCalorieTarget: args.oldCalorieTarget,
      newCalorieTarget: args.newCalorieTarget,
      reason: args.reason,
      dataPointsAnalyzed: args.dataPointsAnalyzed,
      confidence: args.confidence,
      createdAt: Date.now(),
    });
    
    // Also update the user's profile with the new target
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();
    
    if (profile) {
      await ctx.db.patch(profile._id, {
        dailyCalorieTarget: args.newCalorieTarget,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get calibration history
export const getCalibrationHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const calibrations = await ctx.db
      .query("calibrationHistory")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .order("desc")
      .take(args.limit || 10);
    
    return calibrations;
  },
});

// Get latest calibration
export const getLatestCalibration = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    return await ctx.db
      .query("calibrationHistory")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .order("desc")
      .first();
  },
});

// Check if calibration is needed
export const shouldCalibrate = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { needed: false, reason: "" };
    
    // Get profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();
    
    if (!profile) return { needed: false, reason: "Profile not complete" };
    
    // Get latest calibration
    const latestCalibration = await ctx.db
      .query("calibrationHistory")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    
    // Check if it's been more than 2 weeks since last calibration
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
    if (!latestCalibration || latestCalibration.createdAt < twoWeeksAgo) {
      // Check if we have enough data
      const twoWeeksAgoDate = new Date(twoWeeksAgo).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      // Count weight logs
      const weightLogs = await ctx.db
        .query("weightLogs")
        .withIndex("by_user_date")
        .filter(q => 
          q.and(
            q.eq(q.field("userId"), identity.subject),
            q.gte(q.field("date"), twoWeeksAgoDate),
            q.lte(q.field("date"), today)
          )
        )
        .collect();
      
      // Count food logs
      const foodLogs = await ctx.db
        .query("foodLogs")
        .withIndex("by_user_date")
        .filter(q => 
          q.and(
            q.eq(q.field("userId"), identity.subject),
            q.gte(q.field("date"), twoWeeksAgoDate),
            q.lte(q.field("date"), today)
          )
        )
        .collect();
      
      // Need at least 7 weight logs and 20 food logs for reliable calibration
      if (weightLogs.length >= 7 && foodLogs.length >= 20) {
        return {
          needed: true,
          reason: "It's been over 2 weeks since your last calibration, and you have enough data for an accurate analysis.",
          dataPoints: {
            weightLogs: weightLogs.length,
            foodLogs: foodLogs.length,
          }
        };
      }
    }
    
    // Check for plateau (less than 0.5kg change in 10 days despite deficit)
    const tenDaysAgo = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const recentWeights = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.gte(q.field("date"), tenDaysAgo)
        )
      )
      .collect();
    
    if (recentWeights.length >= 5) {
      const weightChange = Math.abs(
        recentWeights[recentWeights.length - 1].weight - recentWeights[0].weight
      );
      
      if (weightChange < 0.5 && profile.goal !== "maintain") {
        return {
          needed: true,
          reason: "You seem to have hit a plateau. A calibration could help break through it.",
          dataPoints: {
            daysOnPlateau: 10,
            weightChange: weightChange,
          }
        };
      }
    }
    
    return { needed: false, reason: "" };
  },
});