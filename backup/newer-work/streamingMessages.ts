import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Store streaming message chunks
export const saveStreamChunk = mutation({
  args: {
    threadId: v.string(),
    chunk: v.string(),
    isComplete: v.boolean(),
    toolCalls: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Find existing stream or create new one
    const existing = await ctx.db
      .query("streamingMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    if (existing) {
      // Append chunk to existing message
      await ctx.db.patch(existing._id, {
        content: existing.content + args.chunk,
        isComplete: args.isComplete,
        toolCalls: args.toolCalls || existing.toolCalls,
        updatedAt: Date.now(),
      });
    } else {
      // Create new streaming message
      await ctx.db.insert("streamingMessages", {
        userId: identity.subject,
        threadId: args.threadId,
        content: args.chunk,
        isComplete: args.isComplete,
        toolCalls: args.toolCalls,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get current streaming message
export const getStreamingMessage = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("streamingMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
  },
});

// Clear completed stream
export const clearStream = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const stream = await ctx.db
      .query("streamingMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();

    if (stream && stream.userId === identity.subject) {
      await ctx.db.delete(stream._id);
    }
  },
});
