import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Log AI usage for a user
export const logUsage = mutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    agentName: v.string(),
    model: v.string(),
    provider: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentUsageTracking", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Get usage stats for a user
export const getUserUsageStats = query({
  args: {
    userId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const userId = args.userId || identity.subject;
    
    let query = ctx.db
      .query("agentUsageTracking")
      .withIndex("by_user", (q: any) => q.eq("userId", userId));
    
    // Apply date filters if provided
    if (args.startDate || args.endDate) {
      const startTime = args.startDate ? new Date(args.startDate).getTime() : 0;
      const endTime = args.endDate ? new Date(args.endDate).getTime() : Date.now();
      
      query = query.filter((q: any) => 
        q.and(
          q.gte(q.field("timestamp"), startTime),
          q.lte(q.field("timestamp"), endTime)
        )
      );
    }
    
    const usage = await query.collect();
    
    // Calculate totals
    const totals = usage.reduce((acc, log) => ({
      totalTokens: acc.totalTokens + log.totalTokens,
      promptTokens: acc.promptTokens + log.promptTokens,
      completionTokens: acc.completionTokens + log.completionTokens,
      totalCost: acc.totalCost + log.cost,
      callCount: acc.callCount + 1,
    }), {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      callCount: 0,
    });
    
    // Group by model
    const byModel = usage.reduce((acc, log) => {
      if (!acc[log.model]) {
        acc[log.model] = {
          totalTokens: 0,
          totalCost: 0,
          callCount: 0,
        };
      }
      acc[log.model].totalTokens += log.totalTokens;
      acc[log.model].totalCost += log.cost;
      acc[log.model].callCount += 1;
      return acc;
    }, {} as Record<string, any>);
    
    return {
      totals,
      byModel,
      recentUsage: usage.slice(-10), // Last 10 calls
    };
  },
});

// Get daily usage summary for charts
export const getDailyUsageSummary = query({
  args: {
    userId: v.optional(v.string()),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const userId = args.userId || identity.subject;
    const startTime = Date.now() - (args.days * 24 * 60 * 60 * 1000);
    
    const usage = await ctx.db
      .query("agentUsageTracking")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .filter((q: any) => q.gte(q.field("timestamp"), startTime))
      .collect();
    
    // Group by day
    const dailyUsage = usage.reduce((acc, log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          totalTokens: 0,
          totalCost: 0,
          callCount: 0,
        };
      }
      acc[date].totalTokens += log.totalTokens;
      acc[date].totalCost += log.cost;
      acc[date].callCount += 1;
      return acc;
    }, {} as Record<string, any>);
    
    // Convert to array and sort by date
    return Object.values(dailyUsage).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    );
  },
});

// Get recent usage for current user
export const getRecentUsage = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const usage = await ctx.db
      .query("agentUsageTracking")
      .withIndex("by_user_timestamp", q => q.eq("userId", identity.subject))
      .order("desc")
      .take(args.limit || 10);
    
    return usage;
  },
});