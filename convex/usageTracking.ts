import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Check if user can perform action (chat/photo)
export const checkUsageLimit = query({
  args: {
    usageType: v.string(), // "chat" or "photoAnalysis"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { allowed: false, message: "Not authenticated" };

    const userId = identity.subject;
    const today = new Date().toISOString().split("T")[0];

    // Check if user has active subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .first();

    // Pro users have unlimited access
    if (subscription) {
      return {
        allowed: true,
        unlimited: true,
        message: "Pro user - unlimited access",
      };
    }

    // Free tier limits
    const limits = {
      chat: 5,
      photoAnalysis: 2,
    };

    // Get or create today's usage
    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", userId).eq("date", today),
      )
      .first();

    if (!usage) {
      // First action of the day - always allowed
      return {
        allowed: true,
        remaining: limits[args.usageType as keyof typeof limits] - 1,
        limit: limits[args.usageType as keyof typeof limits],
        message: `You have ${limits[args.usageType as keyof typeof limits] - 1} ${args.usageType}s remaining today`,
      };
    }

    const fieldName =
      args.usageType === "chat" ? "chatCount" : "photoAnalysisCount";
    const currentCount =
      (usage[fieldName as keyof typeof usage] as number) || 0;
    const limit = limits[args.usageType as keyof typeof limits];

    if (currentCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        limit,
        message: `You've reached your daily limit of ${limit} ${args.usageType}s. Upgrade to Pro for unlimited access!`,
        showUpgrade: true,
      };
    }

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      limit,
      message: `You have ${limit - currentCount - 1} ${args.usageType}s remaining today`,
    };
  },
});

// Track usage after action
export const trackUsage = mutation({
  args: {
    usageType: v.string(), // "chat" or "photoAnalysis"
    modelUsed: v.optional(v.string()), // "sonnet" or "opus"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const today = new Date().toISOString().split("T")[0];

    // Get or create today's usage record
    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", userId).eq("date", today),
      )
      .first();

    if (!usage) {
      // Create new usage record for today
      await ctx.db.insert("usageTracking", {
        userId,
        date: today,
        chatCount: args.usageType === "chat" ? 1 : 0,
        photoAnalysisCount: args.usageType === "photoAnalysis" ? 1 : 0,
        opusCallsCount: args.modelUsed === "opus" ? 1 : 0,
        sonnetCallsCount: args.modelUsed === "sonnet" ? 1 : 0,
        lastResetAt: Date.now(),
      });
    } else {
      // Update existing record
      const updates: any = {};

      if (args.usageType === "chat") {
        updates.chatCount = (usage.chatCount || 0) + 1;
      } else if (args.usageType === "photoAnalysis") {
        updates.photoAnalysisCount = (usage.photoAnalysisCount || 0) + 1;
      }

      if (args.modelUsed === "opus") {
        updates.opusCallsCount = (usage.opusCallsCount || 0) + 1;
      } else if (args.modelUsed === "sonnet") {
        updates.sonnetCallsCount = (usage.sonnetCallsCount || 0) + 1;
      }

      await ctx.db.patch(usage._id, updates);
    }
  },
});

// Get usage stats for user
export const getUsageStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const today = new Date().toISOString().split("T")[0];

    const usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", (q: any) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .first();

    // Check subscription status
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q: any) => q.eq("userId", identity.subject))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .first();

    const limits = {
      chat: 5,
      photoAnalysis: 2,
    };

    return {
      today: {
        chats: {
          used: usage?.chatCount || 0,
          limit: subscription ? null : limits.chat,
          remaining: subscription
            ? null
            : limits.chat - (usage?.chatCount || 0),
        },
        photos: {
          used: usage?.photoAnalysisCount || 0,
          limit: subscription ? null : limits.photoAnalysis,
          remaining: subscription
            ? null
            : limits.photoAnalysis - (usage?.photoAnalysisCount || 0),
        },
      },
      isPro: !!subscription,
      modelUsage: {
        opus: usage?.opusCallsCount || 0,
        sonnet: usage?.sonnetCallsCount || 0,
      },
    };
  },
});

// Reset daily usage (for cron job)
export const resetDailyUsage = mutation({
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Get all usage records from yesterday
    const yesterdayUsage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date")
      .filter((q: any) => q.eq(q.field("date"), yesterdayStr))
      .collect();

    // You could archive these or just leave them for analytics
    console.log(`Reset usage for ${yesterdayUsage.length} users`);
  },
});
