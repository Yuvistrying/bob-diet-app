import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a weekly summary
export const saveWeeklySummary = mutation({
  args: {
    weekStartDate: v.string(),
    weekEndDate: v.string(),
    startWeight: v.number(),
    endWeight: v.number(),
    weightChange: v.number(),
    averageDailyCalories: v.number(),
    targetDailyCalories: v.number(),
    mealsLogged: v.number(),
    totalMealsPossible: v.number(),
    loggingConsistency: v.number(),
    weightTrackingDays: v.number(),
    expectedWeightChange: v.number(),
    actualWeightChange: v.number(),
    calibrationAdjustment: v.optional(
      v.object({
        oldTarget: v.number(),
        newTarget: v.number(),
        reason: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if summary already exists for this week
    const existing = await ctx.db
      .query("weeklySummaries")
      .withIndex("by_user_week", (q: any) =>
        q
          .eq("userId", identity.subject)
          .eq("weekStartDate", args.weekStartDate),
      )
      .first();

    // Generate insights text
    const insights = generateWeeklyInsights(args);

    if (existing) {
      // Update existing summary
      await ctx.db.patch(existing._id, {
        ...args,
        insights,
        createdAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new summary
      return await ctx.db.insert("weeklySummaries", {
        userId: identity.subject,
        ...args,
        insights,
        createdAt: Date.now(),
      });
    }
  },
});

// Get weekly summaries for a user
export const getWeeklySummaries = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const limit = args.limit || 10;

    return await ctx.db
      .query("weeklySummaries")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);
  },
});

// Get the latest weekly summary
export const getLatestWeeklySummary = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("weeklySummaries")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .first();
  },
});

// Helper function to generate insights text
function generateWeeklyInsights(data: any): string {
  const {
    startWeight,
    endWeight,
    weightChange,
    averageDailyCalories,
    targetDailyCalories,
    loggingConsistency,
    weightTrackingDays,
    expectedWeightChange,
    actualWeightChange,
    calibrationAdjustment,
  } = data;

  // Determine progress status
  const isOnTrack = Math.abs(actualWeightChange - expectedWeightChange) < 0.2;
  const isAheadOfSchedule = actualWeightChange > expectedWeightChange + 0.2;
  const isBehindSchedule = actualWeightChange < expectedWeightChange - 0.2;

  let progressMessage = "";
  if (isOnTrack) {
    progressMessage =
      "You're right on track! Your progress matches expectations perfectly.";
  } else if (isAheadOfSchedule) {
    progressMessage =
      "You're ahead of schedule! Great job, but let's ensure it's sustainable.";
  } else {
    progressMessage =
      "Progress is slower than expected, but that's okay! Let's fine-tune your approach.";
  }

  // Build calibration message if applicable
  let calibrationMessage = "";
  if (calibrationAdjustment) {
    const { oldTarget, newTarget, reason } = calibrationAdjustment;
    const adjustment = newTarget - oldTarget;
    calibrationMessage = `\n\n🔧 Calibration Update:\nI'm adjusting your daily target from ${oldTarget} → ${newTarget} calories (${adjustment > 0 ? "+" : ""}${adjustment}). ${reason}`;
  }

  // Build consistency message
  let consistencyMessage = "";
  if (loggingConsistency >= 90) {
    consistencyMessage = "Amazing consistency with logging!";
  } else if (loggingConsistency >= 70) {
    consistencyMessage = "Good logging consistency!";
  } else {
    consistencyMessage = "Let's work on more consistent logging.";
  }

  return `📊 Your Progress:
- Weight: ${startWeight}kg → ${endWeight}kg (${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)}kg)
- Average daily calories: ${Math.round(averageDailyCalories)} (target: ${targetDailyCalories})
- Logged meals: ${data.mealsLogged}/21 (${loggingConsistency}% consistency!)
- Weight tracked: ${weightTrackingDays}/7 days

💡 Insights:
${progressMessage} ${consistencyMessage}${calibrationMessage}

Keep up the great work! 💪`;
}
