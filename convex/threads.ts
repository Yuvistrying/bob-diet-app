import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { shouldSummarizeMessages, extractProtectedContext } from "./summarizer";

// Build morning greeting content
const buildMorningGreeting = async (
  ctx: any,
  profile: any,
  dailySummary: any,
  hasLoggedWeightToday: boolean,
): Promise<string> => {
  let greeting = `Good morning ${profile?.name || "there"}! 🌅`;

  // Add yesterday's summary if available
  if (dailySummary?.yesterday?.stats?.calories > 0 && profile) {
    const yesterday = dailySummary.yesterday.stats;
    const calorieDiff = yesterday.calories - profile.dailyCalorieTarget;
    const proteinDiff = yesterday.protein - profile.proteinTarget;

    greeting += ` Yesterday: ${Math.round(yesterday.calories)}cal (${Math.round(yesterday.protein)}p/${Math.round(yesterday.carbs)}c/${Math.round(yesterday.fat)}f). `;

    // Add insight based on goals
    if (profile.goal === "cut") {
      if (calorieDiff > 200) {
        greeting += `You were ${Math.round(calorieDiff)} calories over target - let's tighten up today! 💪`;
      } else if (calorieDiff >= -200 && calorieDiff <= 0) {
        greeting += `Great job staying in your deficit! 🎯`;
      }
    } else if (profile.goal === "gain") {
      if (calorieDiff < -200) {
        greeting += `You were ${Math.abs(Math.round(calorieDiff))} calories under - need to eat more to gain! 🍽️`;
      } else if (calorieDiff >= 0 && calorieDiff <= 300) {
        greeting += `Perfect surplus for lean gains! 💪`;
      }
    } else {
      // maintain
      if (Math.abs(calorieDiff) <= 200) {
        greeting += `Excellent maintenance! Right on target! ✨`;
      }
    }
  } else {
    greeting += ` Starting fresh for today.`;
  }

  if (hasLoggedWeightToday === false) {
    greeting += `\n\nDon't forget to log your weight! ⚖️`;
  }

  greeting += `\n\nWhat can I help you with?`;

  return greeting;
};

// Build new thread greeting content
const buildNewThreadGreeting = (
  profile: any,
  foodLogsCount: number,
): string => {
  let greeting = `Hey ${profile?.name || "there"}! Fresh chat started! `;
  if (foodLogsCount > 0) {
    greeting += `I can see you've logged ${foodLogsCount} items today. `;
  }
  greeting += `What can I help you with?`;
  return greeting;
};

// Simple thread management without Convex Agent

// Create or get daily thread
export const getOrCreateDailyThread = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const today = new Date().toISOString().split("T")[0];

    // Check for existing thread today
    const existing = await ctx.db
      .query("dailyThreads")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .first();

    if (existing) {
      return {
        threadId: existing.threadId,
        isNew: false,
        messageCount: existing.messageCount,
      };
    }

    // Get user profile first to determine message count
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    console.log(
      `[getOrCreateDailyThread] Profile check for ${identity.subject}:`,
      {
        exists: !!profile,
        onboardingCompleted: profile?.onboardingCompleted,
        name: profile?.name,
        allFields: profile,
      },
    );

    // Create new thread
    const threadId = `thread_${identity.subject}_${Date.now()}`;
    await ctx.db.insert("dailyThreads", {
      userId: identity.subject,
      date: today,
      threadId,
      messageCount: 1, // Always create a message
      firstMessageAt: Date.now(),
      lastMessageAt: Date.now(),
    });

    // Check if onboarding is needed
    const needsOnboarding = !profile || profile.onboardingCompleted !== true;

    console.log(`[getOrCreateDailyThread] Onboarding check:`, {
      needsOnboarding,
      profileExists: !!profile,
      onboardingCompleted: profile?.onboardingCompleted,
      condition: "!profile || profile.onboardingCompleted !== true",
    });

    // If onboarding is needed, create welcome message
    if (needsOnboarding) {
      console.log(
        `[getOrCreateDailyThread] Creating onboarding welcome message`,
      );
      await ctx.db.insert("chatHistory", {
        userId: identity.subject,
        role: "assistant" as const,
        content:
          "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
        timestamp: Date.now(),
        metadata: {
          threadId,
        },
      });

      return { threadId, isNew: true, messageCount: 1 };
    }

    // Otherwise create morning greeting
    console.log(`[getOrCreateDailyThread] Creating morning greeting`);

    // Get daily summary info
    const dailySummary = await ctx.runQuery(api.dailySummary.getDailySummary);

    // Check if user has logged weight today
    const todayWeightLog = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .first();
    const hasLoggedWeightToday = !!todayWeightLog;

    // Build and save morning greeting as a chat message
    if (profile) {
      const greetingContent = await buildMorningGreeting(
        ctx,
        profile,
        dailySummary,
        hasLoggedWeightToday,
      );

      // Save greeting as a chat message
      await ctx.db.insert("chatHistory", {
        userId: identity.subject,
        role: "assistant" as const,
        content: greetingContent,
        timestamp: Date.now(),
        metadata: {
          threadId,
        },
      });
    }

    return { threadId, isNew: true, messageCount: 1 };
  },
});

// Create a new thread for "New Chat" functionality
export const createNewThread = mutation({
  args: {
    previousThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    // Create new thread ID
    const newThreadId = `thread_${identity.subject}_${now}`;

    // If there's a previous thread, trigger summarization
    if (args.previousThreadId) {
      // Schedule the summarization to run asynchronously
      await ctx.scheduler.runAfter(0, api.threads.checkAndSummarize, {
        threadId: args.previousThreadId,
      });
    }

    // Get user profile first
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    // Create new daily thread entry
    await ctx.db.insert("dailyThreads", {
      userId: identity.subject,
      date: today,
      threadId: newThreadId,
      messageCount: 1, // Always create a message
      firstMessageAt: now,
      lastMessageAt: now,
    });

    // Get today's food logs to provide context
    const todayFoodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .collect();

    // Check if onboarding is needed
    const needsOnboarding = !profile || profile.onboardingCompleted !== true;

    console.log(`[createNewThread] Onboarding check:`, {
      needsOnboarding,
      profileExists: !!profile,
      onboardingCompleted: profile?.onboardingCompleted,
    });

    // If onboarding is needed, create welcome message
    if (needsOnboarding) {
      console.log(`[createNewThread] Creating onboarding welcome message`);
      await ctx.db.insert("chatHistory", {
        userId: identity.subject,
        role: "assistant" as const,
        content:
          "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
        timestamp: Date.now(),
        metadata: {
          threadId: newThreadId,
        },
      });
    } else if (profile) {
      // Build and save new thread greeting
      const greetingContent = buildNewThreadGreeting(
        profile,
        todayFoodLogs.length,
      );

      // Save greeting as a chat message
      await ctx.db.insert("chatHistory", {
        userId: identity.subject,
        role: "assistant" as const,
        content: greetingContent,
        timestamp: Date.now(),
        metadata: {
          threadId: newThreadId,
        },
      });
    }

    return {
      threadId: newThreadId,
      isNew: true,
      messageCount: 1,
      foodLogsCount: todayFoodLogs.length,
      previousThreadSummarized: !!args.previousThreadId,
    };
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
    const messageMetadata = args.metadata
      ? {
          ...args.metadata,
          threadId: args.threadId,
        }
      : {
          threadId: args.threadId,
        };

    // Add toolCalls to metadata only if they exist
    if (args.toolCalls && args.toolCalls.length > 0) {
      messageMetadata.toolCalls = args.toolCalls;
    }

    console.log(
      `[saveMessage] Saving ${args.role} message to thread ${args.threadId}: "${args.content.substring(0, 50)}..."`,
    );

    // Log if we have toolCalls
    if (args.toolCalls && args.toolCalls.length > 0) {
      console.log(
        `[saveMessage] Message has ${args.toolCalls.length} tool calls:`,
        args.toolCalls.map((tc) => tc.toolName),
      );
      console.log(
        `[saveMessage] Full toolCalls data:`,
        JSON.stringify(args.toolCalls, null, 2),
      );
    }

    // Log the final metadata object
    console.log(
      `[saveMessage] Final metadata object keys:`,
      Object.keys(messageMetadata),
    );
    if (messageMetadata.toolCalls) {
      console.log(
        `[saveMessage] Metadata contains toolCalls:`,
        messageMetadata.toolCalls.length,
      );
    }

    const messageId = await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      metadata: messageMetadata,
    });

    // Generate embedding asynchronously (skip for simple messages)
    const simpleMessages = [
      "hi",
      "hello",
      "hey",
      "yes",
      "no",
      "thanks",
      "ok",
      "bye",
    ];
    const contentLower = args.content.toLowerCase().trim();
    const isSimple =
      simpleMessages.includes(contentLower) || contentLower.length < 10;

    if (!isSimple) {
      ctx.scheduler.runAfter(0, api.embeddings.embedNewChatMessage, {
        chatId: messageId,
        content: args.content,
      });
    }

    // Update thread stats
    const thread = await ctx.db
      .query("dailyThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
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

    const limit = args.limit || 1000; // Much higher default limit

    // Get the daily thread info to find the timestamp range
    const thread = await ctx.db
      .query("dailyThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!thread) {
      console.log(`[getThreadMessages] No thread found for ${args.threadId}`);
      return [];
    }

    // Get messages for this specific thread only
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_thread", (q) =>
        q.eq("userId", identity.subject).eq("metadata.threadId", args.threadId),
      )
      .order("desc")
      .take(limit);

    console.log(
      `[getThreadMessages] Found ${messages.length} total messages for thread ${args.threadId}`,
    );

    // Debug: Show what types of messages we have
    const conversationMessages = messages.filter(
      (m) => m.metadata?.threadId === args.threadId,
    );
    const foodLogMessages = messages.filter((m) => m.metadata?.foodLogId);
    console.log(
      `[getThreadMessages] Breakdown: ${conversationMessages.length} conversation, ${foodLogMessages.length} food logs`,
    );

    if (messages.length > 0) {
      const last = messages[0];
      console.log(
        `[getThreadMessages] Most recent: [${last.role}] "${last.content.substring(0, 50)}..."`,
      );

      // Debug: Check for messages with toolCalls
      const messagesWithToolCalls = messages.filter(
        (m) => m.metadata?.toolCalls && m.metadata.toolCalls.length > 0,
      );
      if (messagesWithToolCalls.length > 0) {
        console.log(
          `[getThreadMessages] Found ${messagesWithToolCalls.length} messages with tool calls`,
        );
        messagesWithToolCalls.forEach((msg, idx) => {
          console.log(`[getThreadMessages] Message ${idx} toolCalls:`, {
            role: msg.role,
            content: msg.content.substring(0, 50),
            toolCallCount: msg.metadata?.toolCalls?.length,
            toolNames: msg.metadata?.toolCalls?.map((tc: any) => tc.toolName),
          });
        });
      } else {
        console.log(
          `[getThreadMessages] No messages found with toolCalls in metadata`,
        );
      }
    }

    // Return messages with toolCalls properly extracted
    return messages.reverse().map((msg) => ({
      ...msg,
      toolCalls: msg.metadata?.toolCalls || undefined,
    }));
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
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!thread || thread.userId !== identity.subject) {
      return null;
    }

    // Get food logs for the day
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", thread.date),
      )
      .collect();

    const totalCalories = foodLogs.reduce(
      (sum, log) => sum + log.totalCalories,
      0,
    );
    const foodsLogged = foodLogs.length;

    // Check if weight was logged
    const weightLog = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", thread.date),
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
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    const oldThreads = await ctx.db
      .query("dailyThreads")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.lt(q.field("date"), cutoffStr))
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
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Mark yesterday's threads as complete
    const yesterdayThreads = await ctx.db
      .query("dailyThreads")
      .filter((q) => q.eq(q.field("date"), yesterdayStr))
      .collect();

    for (const thread of yesterdayThreads) {
      await ctx.db.patch(thread._id, {
        isComplete: true,
        completedAt: Date.now(),
      });
    }

    // Clear any stale pending confirmations from yesterday
    const stalePendingConfirmations = await ctx.db
      .query("pendingConfirmations")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.lt(q.field("_creationTime"), Date.now() - 24 * 60 * 60 * 1000),
        ),
      )
      .collect();

    for (const confirmation of stalePendingConfirmations) {
      await ctx.db.delete(confirmation._id);
    }

    return {
      threadsCompleted: yesterdayThreads.length,
      confirmationsCleared: stalePendingConfirmations.length,
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

    // Need at least 10 messages total (5 to summarize + 5 to keep recent)
    if (messages.length < 10) {
      console.log(
        `[checkAndSummarize] Not enough messages: ${messages.length} < 10`,
      );
      return null;
    }

    // Get existing summaries for this thread
    const summaries = await ctx.runQuery(api.threads.getThreadSummaries, {
      threadId: args.threadId,
    });

    // Find the total messages already summarized
    let totalMessagesSummarized = 0;
    if (summaries.length > 0) {
      const lastSummary = summaries[summaries.length - 1];
      totalMessagesSummarized = lastSummary.messageRange.endIndex;
    }

    // Calculate how many new messages we have since last summary
    const newMessageCount = messages.length - totalMessagesSummarized;

    console.log(
      `[checkAndSummarize] Status: ${messages.length} total messages, ${totalMessagesSummarized} already summarized, ${newMessageCount} new messages`,
    );

    // Only summarize if we have at least 5 new messages
    if (newMessageCount < 5) {
      console.log(
        `[checkAndSummarize] Not enough new messages: ${newMessageCount} < 5`,
      );
      return null;
    }

    // Check if we should summarize
    const messagesToCheck = messages.map((m: any, idx: number) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));

    if (!shouldSummarizeMessages(messagesToCheck, totalMessagesSummarized)) {
      console.log(
        `[checkAndSummarize] Should not summarize - conditions not met`,
      );
      return null;
    }

    // Get messages to summarize (from last summary to 5 messages ago)
    const endIndex = messages.length - 5;
    const messagesToSummarize = messages.slice(
      totalMessagesSummarized,
      endIndex,
    );

    if (messagesToSummarize.length === 0) {
      console.log(`[checkAndSummarize] No messages to summarize`);
      return null;
    }

    console.log(
      `[checkAndSummarize] Will summarize ${messagesToSummarize.length} messages (indexes ${totalMessagesSummarized} to ${endIndex})`,
    );

    // Get previous summary for context
    const previousSummary =
      summaries.length > 0
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
        startIndex: totalMessagesSummarized,
        endIndex: endIndex,
        startTimestamp: messagesToSummarize[0].timestamp,
        endTimestamp:
          messagesToSummarize[messagesToSummarize.length - 1].timestamp,
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
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});
