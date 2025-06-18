import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Get current active goal
export const getActiveGoal = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const activeGoal = await ctx.db
      .query("goalHistory")
      .withIndex("by_user_status", (q) => 
        q.eq("userId", identity.subject).eq("status", "active")
      )
      .first();
    
    return activeGoal;
  },
});

// Create new goal
export const createGoal = mutation({
  args: {
    goal: v.string(),
    startingWeight: v.number(),
    targetWeight: v.number(),
    startingUnit: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Mark any existing active goals as abandoned
    const existingActive = await ctx.db
      .query("goalHistory")
      .withIndex("by_user_status", (q) => 
        q.eq("userId", identity.subject).eq("status", "active")
      )
      .collect();
    
    for (const goal of existingActive) {
      await ctx.db.patch(goal._id, {
        status: "abandoned",
        completedAt: Date.now()
      });
    }
    
    // Create new goal
    const goalId = await ctx.db.insert("goalHistory", {
      userId: identity.subject,
      goal: args.goal,
      startingWeight: args.startingWeight,
      targetWeight: args.targetWeight,
      startingUnit: args.startingUnit,
      startedAt: Date.now(),
      status: "active",
      createdAt: Date.now()
    });
    
    return goalId;
  },
});

// Complete goal
export const completeGoal = mutation({
  args: {
    goalId: v.id("goalHistory"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== identity.subject) {
      throw new Error("Goal not found or unauthorized");
    }
    
    await ctx.db.patch(args.goalId, {
      status: "completed",
      completedAt: Date.now()
    });
  },
});

// Check if goal is achieved
export const checkGoalAchievement = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // Get active goal
    const activeGoal = await ctx.db
      .query("goalHistory")
      .withIndex("by_user_status", (q) => 
        q.eq("userId", identity.subject).eq("status", "active")
      )
      .first();
    
    if (!activeGoal) return null;
    
    // Get latest weight
    const latestWeight = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    
    if (!latestWeight) return null;
    
    // Check if goal is achieved
    let achieved = false;
    if (activeGoal.goal === "cut") {
      achieved = latestWeight.weight <= activeGoal.targetWeight;
    } else if (activeGoal.goal === "gain") {
      achieved = latestWeight.weight >= activeGoal.targetWeight;
    }
    
    return {
      achieved,
      currentWeight: latestWeight.weight,
      targetWeight: activeGoal.targetWeight,
      goal: activeGoal.goal
    };
  },
});

// Get goal history
export const getGoalHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const limit = args.limit || 10;
    
    const goals = await ctx.db
      .query("goalHistory")
      .withIndex("by_user_created", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);
    
    return goals;
  },
});