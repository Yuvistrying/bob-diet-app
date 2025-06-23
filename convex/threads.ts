import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { shouldSummarizeMessages, extractProtectedContext } from "./summarizer";

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
    const messageMetadata = args.metadata ? {
      ...args.metadata,
      threadId: args.threadId,
      toolCalls: args.toolCalls,
    } : {
      threadId: args.threadId,
      toolCalls: args.toolCalls,
    };
    
    console.log(`[saveMessage] Saving ${args.role} message to thread ${args.threadId}: "${args.content.substring(0, 50)}..."`);
    
    const messageId = await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      metadata: messageMetadata,
    });
    
    // Generate embedding asynchronously (skip for simple messages)
    const simpleMessages = ['hi', 'hello', 'hey', 'yes', 'no', 'thanks', 'ok', 'bye'];
    const contentLower = args.content.toLowerCase().trim();
    const isSimple = simpleMessages.includes(contentLower) || contentLower.length < 10;
    
    if (!isSimple) {
      ctx.scheduler.runAfter(0, api.embeddings.embedNewChatMessage, {
        chatId: messageId,
        content: args.content,
      });
    }
    
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
    
    const limit = args.limit || 100;
    
    // Get the daily thread info to find the timestamp range
    const thread = await ctx.db
      .query("dailyThreads")
      .withIndex("by_thread", q => q.eq("threadId", args.threadId))
      .first();
    
    if (!thread) {
      console.log(`[getThreadMessages] No thread found for ${args.threadId}`);
      return [];
    }
    
    // Get ALL messages from today - both food logs AND conversation
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", q => 
        q.eq("userId", identity.subject)
      )
      .order("desc")
      .filter(q => 
        q.gte(q.field("timestamp"), thread.firstMessageAt)
      )
      .take(limit);
    
    console.log(`[getThreadMessages] Found ${messages.length} total messages for thread ${args.threadId}`);
    
    // Debug: Show what types of messages we have
    const conversationMessages = messages.filter(m => m.metadata?.threadId === args.threadId);
    const foodLogMessages = messages.filter(m => m.metadata?.foodLogId);
    console.log(`[getThreadMessages] Breakdown: ${conversationMessages.length} conversation, ${foodLogMessages.length} food logs`);
    
    if (messages.length > 0) {
      const last = messages[0];
      console.log(`[getThreadMessages] Most recent: [${last.role}] "${last.content.substring(0, 50)}..."`);
    }
    
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

// Daily thread reset - called by cron job
export const resetDailyThreads = internalMutation({
  args: {},
  handler: async (ctx) => {
    // This runs at 5 AM to prepare for the new day
    // We don't actually delete threads, just mark yesterday as complete
    // The getOrCreateDailyThread will handle creating new threads
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Mark yesterday's threads as complete
    const yesterdayThreads = await ctx.db
      .query("dailyThreads")
      .filter(q => q.eq(q.field("date"), yesterdayStr))
      .collect();
    
    for (const thread of yesterdayThreads) {
      await ctx.db.patch(thread._id, {
        isComplete: true,
        completedAt: Date.now()
      });
    }
    
    // Clear any stale pending confirmations from yesterday
    const stalePendingConfirmations = await ctx.db
      .query("pendingConfirmations")
      .filter(q => 
        q.and(
          q.eq(q.field("status"), "pending"),
          q.lt(q.field("_creationTime"), Date.now() - 24 * 60 * 60 * 1000)
        )
      )
      .collect();
    
    for (const confirmation of stalePendingConfirmations) {
      await ctx.db.delete(confirmation._id);
    }
    
    return {
      threadsCompleted: yesterdayThreads.length,
      confirmationsCleared: stalePendingConfirmations.length
    };
  },
});

// Store message summaries
export const storeSummary = internalMutation({
  args: {
    threadId: v.string(),
    summary: v.object({
      summary: v.string(),
      keyPoints: v.array(v.string()),
      foodsLogged: v.number(),
      caloriesTotal: v.number(),
    }),
    messageRange: v.object({
      startIndex: v.number(),
      endIndex: v.number(),
      startTimestamp: v.number(),
      endTimestamp: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messageSummaries", {
      threadId: args.threadId,
      summary: args.summary.summary,
      keyPoints: args.summary.keyPoints,
      foodsLogged: args.summary.foodsLogged,
      caloriesTotal: args.summary.caloriesTotal,
      messageRange: args.messageRange,
      createdAt: Date.now(),
    });
  },
});

// Trigger summarization when appropriate
export const checkAndSummarize = action({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get thread messages
    const messages = await ctx.runQuery(api.threads.getThreadMessages, {
      threadId: args.threadId,
      limit: 50,
    });
    
    if (messages.length < 5) return null;
    
    // Get existing summaries for this thread
    const summaries = await ctx.runQuery(api.threads.getThreadSummaries, {
      threadId: args.threadId,
    });
    
    // Find the last summarized message index
    const lastSummaryIndex = summaries.length > 0 
      ? summaries[summaries.length - 1].messageRange.endIndex 
      : 0;
    
    // Check if we should summarize
    const messagesToCheck = messages.map((m: any, idx: number) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
    
    if (!shouldSummarizeMessages(messagesToCheck, lastSummaryIndex)) {
      return null;
    }
    
    // Get messages to summarize (from last summary to 5 messages ago)
    const endIndex = messages.length - 5;
    const messagesToSummarize = messages.slice(lastSummaryIndex, endIndex);
    
    if (messagesToSummarize.length === 0) return null;
    
    // Get previous summary for context
    const previousSummary = summaries.length > 0 
      ? summaries[summaries.length - 1].summary 
      : undefined;
    
    // Summarize the messages
    const summary = await ctx.runAction(internal.summarizer.summarizeMessages, {
      messages: messagesToSummarize.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: m.timestamp,
      })),
      previousSummary,
    });
    
    // Store the summary
    await ctx.runMutation(internal.threads.storeSummary, {
      threadId: args.threadId,
      summary,
      messageRange: {
        startIndex: lastSummaryIndex,
        endIndex: endIndex,
        startTimestamp: messagesToSummarize[0].timestamp,
        endTimestamp: messagesToSummarize[messagesToSummarize.length - 1].timestamp,
      },
    });
    
    return summary;
  },
});

// Get thread summaries
export const getThreadSummaries = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    return await ctx.db
      .query("messageSummaries")
      .withIndex("by_thread", q => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});