import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Simple thread management without Convex Agent

// Create or get daily thread
export const getOrCreateDailyThread = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check for existing thread today
    const existing = await ctx.db
      .query("dailyThreads")
      .withIndex("by_user_date", q => 
        q.eq("userId", identity.subject).eq("date", today)
      )
      .first();
    
    if (existing) {
      return { 
        threadId: existing.threadId, 
        isNew: false,
        messageCount: existing.messageCount 
      };
    }
    
    // Create new thread
    const threadId = `thread_${identity.subject}_${Date.now()}`;
    await ctx.db.insert("dailyThreads", {
      userId: identity.subject,
      date: today,
      threadId,
      messageCount: 0,
      firstMessageAt: Date.now(),
      lastMessageAt: Date.now(),
    });
    
    return { threadId, isNew: true, messageCount: 0 };
  },
});

// Save a message to the thread
export const saveMessage = mutation({
  args: {
    threadId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    toolCalls: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Save to chat history
    const messageId = await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata ? {
        ...args.metadata,
        threadId: args.threadId,
        toolCalls: args.toolCalls,
      } : {
        threadId: args.threadId,
        toolCalls: args.toolCalls,
      },
    });
    
    // Generate embedding asynchronously
    ctx.scheduler.runAfter(0, api.embeddings.embedNewChatMessage, {
      chatId: messageId,
      content: args.content,
    });
    
    // Update thread stats
    const thread = await ctx.db
      .query("dailyThreads")
      .withIndex("by_thread", q => q.eq("threadId", args.threadId))
      .first();
    
    if (thread) {
      await ctx.db.patch(thread._id, {
        messageCount: thread.messageCount + 1,
        lastMessageAt: Date.now(),
      });
    }
    
    // No cache invalidation needed - we're using direct queries now
    
    return messageId;
  },
});

// Get thread messages
export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const limit = args.limit || 20;
    
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", q => 
        q.eq("userId", identity.subject)
      )
      .order("desc")
      .filter(q => 
        q.eq(q.field("metadata.threadId"), args.threadId)
      )
      .take(limit);
    
    return messages.reverse(); // Return in chronological order
  },
});

// Get thread summary
export const getThreadSummary = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const thread = await ctx.db
      .query("dailyThreads")
      .withIndex("by_thread", q => q.eq("threadId", args.threadId))
      .first();
    
    if (!thread || thread.userId !== identity.subject) {
      return null;
    }
    
    // Get food logs for the day
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", q => 
        q.eq("userId", identity.subject).eq("date", thread.date)
      )
      .collect();
    
    const totalCalories = foodLogs.reduce((sum, log) => sum + log.totalCalories, 0);
    const foodsLogged = foodLogs.length;
    
    // Check if weight was logged
    const weightLog = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", q => 
        q.eq("userId", identity.subject).eq("date", thread.date)
      )
      .first();
    
    return {
      ...thread,
      summary: {
        foodsLogged,
        totalCalories,
        weightLogged: !!weightLog,
        keyTopics: [], // Could extract from messages if needed
      },
    };
  },
});

// Clean up old threads (optional)
export const cleanupOldThreads = mutation({
  args: {
    daysToKeep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const daysToKeep = args.daysToKeep || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    const oldThreads = await ctx.db
      .query("dailyThreads")
      .withIndex("by_user_date", q => 
        q.eq("userId", identity.subject)
      )
      .filter(q => q.lt(q.field("date"), cutoffStr))
      .collect();
    
    let deleted = 0;
    for (const thread of oldThreads) {
      await ctx.db.delete(thread._id);
      deleted++;
    }
    
    return { deleted };
  },
});