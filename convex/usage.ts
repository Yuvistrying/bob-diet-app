import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Get photo usage for today
export const getPhotoUsageToday = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId).eq("date", today)
      )
      .first();
    
    return usage?.photoAnalysisCount || 0;
  },
});

// Increment photo usage
export const incrementPhotoUsage = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const existingUsage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId).eq("date", today)
      )
      .first();
    
    if (existingUsage) {
      await ctx.db.patch(existingUsage._id, {
        photoAnalysisCount: (existingUsage.photoAnalysisCount || 0) + 1,
      });
    } else {
      await ctx.db.insert("usageTracking", {
        userId,
        date: today,
        chatCount: 0,
        photoAnalysisCount: 1,
        opusCallsCount: 0,
        sonnetCallsCount: 0,
        lastResetAt: Date.now(),
      });
    }
  },
});

// Get user's subscription status
export const getUserSubscriptionStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { isPro: false };
    
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    return {
      isPro: !!subscription,
      subscription,
    };
  },
});

// Get comprehensive usage stats
export const getUsageStats = query({
  args: {
    timeframe: v.optional(v.string()), // "today", "week", "month"
  },
  handler: async (ctx, { timeframe = "today" }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const now = new Date();
    let startDate: string;
    
    switch (timeframe) {
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      default:
        startDate = now.toISOString().split('T')[0];
    }
    
    const usageRecords = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.gte(q.field("date"), startDate)
        )
      )
      .collect();
    
    const totals = usageRecords.reduce((acc, record) => ({
      chats: acc.chats + (record.chatCount || 0),
      photos: acc.photos + (record.photoAnalysisCount || 0),
      opusCalls: acc.opusCalls + (record.opusCallsCount || 0),
      sonnetCalls: acc.sonnetCalls + (record.sonnetCallsCount || 0),
    }), { chats: 0, photos: 0, opusCalls: 0, sonnetCalls: 0 });
    
    // Get subscription status
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    const isPro = !!subscription;
    
    return {
      timeframe,
      totals,
      limits: {
        photos: isPro ? "unlimited" : { used: totals.photos, limit: 2 },
        chats: "unlimited",
      },
      isPro,
      records: usageRecords,
    };
  },
});

// Reset daily usage (to be called by a cron job)
export const resetDailyUsage = internalMutation({
  handler: async (ctx) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Archive yesterday's usage records
    const oldRecords = await ctx.db
      .query("usageTracking")
      .filter((q) => q.lte(q.field("date"), yesterdayStr))
      .collect();
    
    // Delete old records (keeping 30 days of history)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    for (const record of oldRecords) {
      if (record.date < cutoffDate) {
        await ctx.db.delete(record._id);
      }
    }
  },
});