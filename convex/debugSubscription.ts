import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Debug function to manually create a subscription for testing
export const createTestSubscription = mutation({
  args: {
    clerkUserId: v.string(), // The Clerk user ID (e.g., "user_xxx")
  },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.clerkUserId))
      .first();

    if (!user) {
      throw new Error(`User not found with Clerk ID: ${args.clerkUserId}`);
    }

    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", user.tokenIdentifier))
      .first();

    if (existing) {
      // Update existing to active
      await ctx.db.patch(existing._id, {
        status: "active",
        currentPeriodStart: Date.now(),
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
        cancelAtPeriodEnd: false,
      });
      return { message: "Updated existing subscription to active", id: existing._id };
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: user.tokenIdentifier,
      polarId: `test_sub_${Date.now()}`,
      polarPriceId: "test_price",
      status: "active",
      interval: "month",
      currency: "usd",
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      cancelAtPeriodEnd: false,
      amount: 999, // $9.99
      startedAt: Date.now(),
      metadata: { test: true },
      customFieldData: {},
      customerId: `test_customer_${Date.now()}`,
    });

    return { message: "Created test subscription", id: subscriptionId };
  },
});

// Debug query to check all subscriptions
export const listAllSubscriptions = query({
  handler: async (ctx) => {
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const users = await ctx.db.query("users").collect();
    
    return {
      subscriptions: subscriptions.map(sub => ({
        ...sub,
        user: users.find(u => u.tokenIdentifier === sub.userId),
      })),
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.status === "active").length,
    };
  },
});

// Debug query to check current user's subscription
export const checkMySubscription = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { error: "Not authenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    const subscription = user ? await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", user.tokenIdentifier))
      .first() : null;

    return {
      clerkUserId: identity.subject,
      user,
      subscription,
      hasActiveSubscription: subscription?.status === "active",
    };
  },
});