import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Get or create a daily chat session
export const getOrCreateDailySession = mutation({
  args: {
    forceKeepThread: v.optional(v.boolean()), // Keep thread for active confirmations
  },
  handler: async (ctx, { forceKeepThread = false }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // First check if there's an active session (regardless of date)
    const activeSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true),
      )
      .first();

    // If forcing to keep thread (active confirmation), return active session
    if (forceKeepThread && activeSession) {
      return activeSession;
    }

    // Check if we have a session for today
    const existingSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("startDate", today),
      )
      .first();

    if (existingSession) {
      // Update last message time
      await ctx.db.patch(existingSession._id, {
        lastMessageAt: Date.now(),
      });
      return existingSession;
    }

    // Deactivate any other active sessions
    const activeSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true),
      )
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, { isActive: false });
    }

    // Create a new session for today
    const newSession = await ctx.db.insert("chatSessions", {
      userId,
      startDate: today,
      threadId: "", // Will be set when first message is sent
      messageCount: 0,
      isActive: true,
      createdAt: Date.now(),
      lastMessageAt: Date.now(),
    });

    // Clear the user's thread ID preference to force new thread
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (preferences) {
      await ctx.db.patch(preferences._id, {
        updatedAt: Date.now(),
      });
    }

    // Clear any pending confirmations when starting a new day to prevent auto-confirm bug
    await ctx.runMutation(
      api.pendingConfirmations.clearUserPendingConfirmations,
      {},
    );

    return await ctx.db.get(newSession);
  },
});

// Start a new chat session manually
export const startNewChatSession = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const now = Date.now();

    // Deactivate all active sessions
    const activeSessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true),
      )
      .collect();

    for (const session of activeSessions) {
      await ctx.db.patch(session._id, { isActive: false });
    }

    // Create new session
    const newSession = await ctx.db.insert("chatSessions", {
      userId,
      startDate: new Date().toISOString().split("T")[0],
      threadId: "", // Will be set when first message is sent
      messageCount: 0,
      isActive: true,
      createdAt: now,
      lastMessageAt: now,
    });

    // Clear the user's thread ID preference
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (preferences) {
      await ctx.db.patch(preferences._id, {
        updatedAt: now,
      });
    }

    // Clear session cache to ensure fresh context
    await ctx.runMutation(api.sessionCache.clearSessionCache, {});

    // Clear any pending confirmations to prevent auto-confirm bug
    await ctx.runMutation(
      api.pendingConfirmations.clearUserPendingConfirmations,
      {},
    );

    return await ctx.db.get(newSession);
  },
});

// Update session with thread ID
export const updateSessionThreadId = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    threadId: v.string(),
  },
  handler: async (ctx, { sessionId, threadId }) => {
    await ctx.db.patch(sessionId, { threadId });
  },
});

// Increment message count for a session
export const incrementMessageCount = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (session) {
      await ctx.db.patch(sessionId, {
        messageCount: session.messageCount + 1,
        lastMessageAt: Date.now(),
      });
    }
  },
});

// Get active session for user
export const getActiveSession = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;

    return await ctx.db
      .query("chatSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true),
      )
      .first();
  },
});

// Get session stats
export const getSessionStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;
    const activeSession = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true),
      )
      .first();

    if (!activeSession) return null;

    // Count messages for today
    const today = new Date().toISOString().split("T")[0];
    const todayMessages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("timestamp"), new Date(today).getTime()))
      .collect();

    return {
      sessionId: activeSession._id,
      startDate: activeSession.startDate,
      messageCount: todayMessages.length,
      isToday: activeSession.startDate === today,
    };
  },
});
