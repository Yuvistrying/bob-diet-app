import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Get chat history for user
export const getChatHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const limit = args.limit || 50;
    
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);
    
    // Return in chronological order
    return messages.reverse();
  },
});

// Get today's chat messages
export const getTodayChats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q: any) => q.eq("userId", identity.subject))
      .filter((q: any) => q.gte(q.field("timestamp"), todayStart.getTime()))
      .collect();
    
    return messages;
  },
});

// Save user message
export const saveUserMessage = mutation({
  args: {
    content: v.string(),
    metadata: v.optional(v.object({
      actionType: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    return await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: "user",
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

// Save Bob's response
export const saveBobMessage = mutation({
  args: {
    content: v.string(),
    metadata: v.optional(v.object({
      foodLogId: v.optional(v.id("foodLogs")),
      weightLogId: v.optional(v.id("weightLogs")),
      actionType: v.optional(v.string()),
      toolCalls: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    return await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: "assistant",
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

// Clear chat history (optional feature)
export const clearChatHistory = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    return { deleted: messages.length };
  },
});

// Get chat context for Bob (last few messages + user data)
export const getChatContext = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    // Get user preferences
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    // Get meal status
    const mealStatus = await ctx.runQuery(api.reminders.getTodayMealStatus);
    
    // Get today's macros
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject).eq("date", today)
      )
      .collect();
    
    const todayMacros = todayLogs.reduce((acc, log) => ({
      calories: acc.calories + log.totalCalories,
      protein: acc.protein + log.totalProtein,
      carbs: acc.carbs + log.totalCarbs,
      fat: acc.fat + log.totalFat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    // Get latest weight
    const latestWeight = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", q => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    
    // Get recent messages for context
    const recentMessages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .take(10);
    
    return {
      user: {
        name: profile?.name || "there",
        goal: profile?.goal || "maintain",
        currentWeight: latestWeight?.weight || profile?.currentWeight,
        targetWeight: profile?.targetWeight,
        displayMode: preferences?.displayMode || "standard",
      },
      todayProgress: {
        calories: {
          consumed: todayMacros.calories,
          target: profile?.dailyCalorieTarget || 2000,
          remaining: (profile?.dailyCalorieTarget || 2000) - todayMacros.calories,
        },
        protein: {
          consumed: todayMacros.protein,
          target: profile?.proteinTarget || 150,
          remaining: (profile?.proteinTarget || 150) - todayMacros.protein,
        },
        meals: todayLogs.length,
      },
      mealStatus: mealStatus,
      recentMessages: recentMessages.reverse(),
    };
  },
});