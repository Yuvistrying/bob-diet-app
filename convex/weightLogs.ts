import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get latest weight entry
export const getLatestWeight = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const latest = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    
    if (!latest) return null;
    
    // Calculate 7-day trend
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const weekLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => q.gte(q.field("date"), weekAgoStr))
      .collect();
    
    let trend = 0;
    if (weekLogs.length > 1) {
      const oldest = weekLogs.reduce((prev, curr) => 
        prev.date < curr.date ? prev : curr
      );
      trend = latest.weight - oldest.weight;
    }
    
    return {
      ...latest,
      trend
    };
  },
});

// Get weight logs by date range
export const getWeightLogs = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    let query = ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q: any) => q.eq("userId", identity.subject))
      .order("desc");
    
    const logs = await query.take(30); // Last 30 entries
    
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  },
});

// Log weight
export const logWeight = mutation({
  args: {
    weight: v.number(),
    unit: v.string(), // "kg" or "lbs"
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    
    // Check if already logged today
    const existing = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject).eq("date", date)
      )
      .first();
    
    if (existing) {
      // Update existing log
      await ctx.db.patch(existing._id, {
        weight: args.weight,
        unit: args.unit,
        time,
        notes: args.notes,
      });
      return existing._id;
    } else {
      // Create new log
      return await ctx.db.insert("weightLogs", {
        userId: identity.subject,
        weight: args.weight,
        unit: args.unit,
        date,
        time,
        notes: args.notes,
        createdAt: Date.now(),
      });
    }
  },
});

// Delete weight log
export const deleteWeightLog = mutation({
  args: { logId: v.id("weightLogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== identity.subject) {
      throw new Error("Weight log not found or unauthorized");
    }
    
    await ctx.db.delete(args.logId);
  },
});

// Get weight statistics
export const getWeightStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    
    if (!profile) return null;
    
    const allLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q: any) => q.eq("userId", identity.subject))
      .collect();
    
    if (allLogs.length === 0) return null;
    
    const latest = allLogs[0];
    const oldest = allLogs[allLogs.length - 1];
    
    return {
      current: latest.weight,
      starting: oldest.weight,
      target: profile.targetWeight,
      totalChange: latest.weight - oldest.weight,
      toGoal: profile.targetWeight - latest.weight,
      daysTracked: allLogs.length,
    };
  },
});