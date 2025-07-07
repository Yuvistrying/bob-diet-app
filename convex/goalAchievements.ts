import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Check if user has achieved their goal based on weekly average
export function checkGoalAchievement(
  goalType: string,
  weeklyAverage: number,
  targetWeight: number,
  previousWeekAverage?: number,
): boolean {
  switch (goalType) {
    case "cut":
      // For cutting, achieved when weekly average is at or below target
      return weeklyAverage <= targetWeight;

    case "gain":
      // For gaining, achieved when weekly average is at or above target
      return weeklyAverage >= targetWeight;

    case "maintain":
      // For maintaining, need to be within 1kg of target
      // And if we have previous week data, check consistency
      const withinRange = Math.abs(weeklyAverage - targetWeight) <= 1;
      if (previousWeekAverage) {
        const previousWithinRange =
          Math.abs(previousWeekAverage - targetWeight) <= 1;
        return withinRange && previousWithinRange;
      }
      return withinRange;

    default:
      return false;
  }
}

// Get latest unhandled achievement
export const getLatestAchievement = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("goalAchievements")
      .withIndex("by_user_triggered", (q: any) =>
        q.eq("userId", identity.subject).eq("bobSuggested", false),
      )
      .order("desc")
      .first();
  },
});

// Mark achievement as handled by Bob
export const markAchievementHandled = mutation({
  args: {
    achievementId: v.id("goalAchievements"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.achievementId, {
      bobSuggested: true,
    });
  },
});

// Create achievement record
export const createAchievement = mutation({
  args: {
    goalType: v.string(),
    targetWeight: v.number(),
    achievedWeight: v.number(),
    weeklyAverage: v.number(),
    daysAtGoal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if achievement already exists for this goal
    const existing = await ctx.db
      .query("goalAchievements")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .first();

    // Don't create duplicate if goal hasn't changed
    if (
      existing &&
      existing.goalType === args.goalType &&
      existing.targetWeight === args.targetWeight &&
      !existing.bobSuggested
    ) {
      return existing._id;
    }

    return await ctx.db.insert("goalAchievements", {
      userId: identity.subject,
      goalType: args.goalType,
      targetWeight: args.targetWeight,
      achievedWeight: args.achievedWeight,
      weeklyAverage: args.weeklyAverage,
      achievedAt: Date.now(),
      bobSuggested: false,
      daysAtGoal: args.daysAtGoal,
    });
  },
});

// Get user's achievement history
export const getAchievementHistory = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("goalAchievements")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});
