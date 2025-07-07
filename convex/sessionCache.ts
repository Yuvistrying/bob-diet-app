import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Get cached data for a user
export const getSessionCache = query({
  args: {
    cacheKey: v.string(),
  },
  handler: async (ctx, { cacheKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;
    const now = Date.now();

    // Find cache entry
    const cached = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("cacheKey", cacheKey),
      )
      .first();

    // Return null if not found or expired
    if (!cached || cached.expiresAt < now) {
      return null;
    }

    // Parse and return the cached data
    try {
      return JSON.parse(cached.data);
    } catch (e) {
      console.error("Failed to parse cached data:", e);
      return null;
    }
  },
});

// Set cached data for a user
export const setSessionCache = mutation({
  args: {
    cacheKey: v.string(),
    data: v.any(),
    ttlSeconds: v.optional(v.number()),
  },
  handler: async (ctx, { cacheKey, data, ttlSeconds = 300 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const userId = identity.subject;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    // Check if entry already exists
    const existing = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("cacheKey", cacheKey),
      )
      .first();

    const dataStr = JSON.stringify(data);

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        data: dataStr,
        expiresAt,
      });
    } else {
      // Create new entry
      await ctx.db.insert("sessionCache", {
        userId,
        cacheKey,
        data: dataStr,
        expiresAt,
      });
    }
  },
});

// Clear all cache for a user
export const clearSessionCache = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const userId = identity.subject;

    // Find all cache entries for this user
    const entries = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_key", (q) => q.eq("userId", userId))
      .collect();

    // Delete them all
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
  },
});

// Clear specific cache key for a user
export const clearSessionCacheKey = mutation({
  args: {
    cacheKey: v.string(),
  },
  handler: async (ctx, { cacheKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const userId = identity.subject;

    // Find the specific cache entry
    const entry = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("cacheKey", cacheKey),
      )
      .first();

    if (entry) {
      await ctx.db.delete(entry._id);
    }
  },
});

// Cleanup expired cache entries (called by cron job)
export const cleanupExpiredCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired entries using filter since we can't use comparison operators with withIndex
    const allEntries = await ctx.db.query("sessionCache").collect();

    const expired = allEntries.filter((entry) => entry.expiresAt < now);

    // Delete them
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }

    console.log(`Cleaned up ${expired.length} expired cache entries`);
    return { deleted: expired.length };
  },
});
