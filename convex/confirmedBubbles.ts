import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a confirmed/rejected bubble state
export const saveConfirmedBubble = mutation({
  args: {
    threadId: v.string(),
    messageIndex: v.number(),
    confirmationId: v.string(),
    toolCallId: v.optional(v.string()),
    foodDescription: v.string(),
    status: v.string(), // "confirmed" or "rejected"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    // Check if already exists
    const existing = await ctx.db
      .query("confirmedBubbles")
      .withIndex("by_confirmation_id", q => q.eq("confirmationId", args.confirmationId))
      .first();

    if (existing) {
      console.log(`[saveConfirmedBubble] Updating existing bubble state:`, args.confirmationId);
      await ctx.db.patch(existing._id, {
        status: args.status,
        confirmedAt: now,
      });
      return existing._id;
    }

    console.log(`[saveConfirmedBubble] Saving new bubble state:`, {
      confirmationId: args.confirmationId,
      status: args.status,
      foodDescription: args.foodDescription,
    });

    const bubbleId = await ctx.db.insert("confirmedBubbles", {
      userId: identity.subject,
      threadId: args.threadId,
      messageIndex: args.messageIndex,
      confirmationId: args.confirmationId,
      toolCallId: args.toolCallId,
      foodDescription: args.foodDescription,
      status: args.status,
      confirmedAt: now,
      expiresAt: now + sevenDays,
    });

    return bubbleId;
  },
});

// Get all confirmed bubbles for a thread
export const getConfirmedBubbles = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    console.log(`[getConfirmedBubbles] Fetching bubble states for thread:`, args.threadId);

    const bubbles = await ctx.db
      .query("confirmedBubbles")
      .withIndex("by_user_thread", q => 
        q.eq("userId", identity.subject).eq("threadId", args.threadId)
      )
      .collect();

    console.log(`[getConfirmedBubbles] Found ${bubbles.length} bubble states`);

    return bubbles.map(bubble => ({
      confirmationId: bubble.confirmationId,
      messageIndex: bubble.messageIndex,
      status: bubble.status,
      foodDescription: bubble.foodDescription,
      confirmedAt: bubble.confirmedAt,
    }));
  },
});

// Cleanup old bubble states (called by cron)
export const cleanupOldBubbles = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expired = await ctx.db
      .query("confirmedBubbles")
      .withIndex("by_expires", q => q.lt("expiresAt", now))
      .collect();

    console.log(`[cleanupOldBubbles] Cleaning up ${expired.length} expired bubble states`);

    for (const bubble of expired) {
      await ctx.db.delete(bubble._id);
    }

    return { deleted: expired.length };
  },
});