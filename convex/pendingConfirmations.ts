import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save a pending confirmation when confirmFood is called
export const savePendingConfirmation = mutation({
  args: {
    threadId: v.string(),
    toolCallId: v.string(),
    confirmationData: v.object({
      description: v.string(),
      items: v.array(v.object({
        name: v.string(),
        quantity: v.string(),
        calories: v.number(),
        protein: v.number(),
        carbs: v.number(),
        fat: v.number(),
      })),
      totalCalories: v.number(),
      totalProtein: v.number(),
      totalCarbs: v.number(),
      totalFat: v.number(),
      mealType: v.string(),
      confidence: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Mark any existing pending confirmations as expired
    const existing = await ctx.db
      .query("pendingConfirmations")
      .withIndex("by_user_thread", q => 
        q.eq("userId", identity.subject).eq("threadId", args.threadId)
      )
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();
    
    for (const confirmation of existing) {
      await ctx.db.patch(confirmation._id, { status: "expired" });
    }
    
    // Save new pending confirmation
    const confirmationId = await ctx.db.insert("pendingConfirmations", {
      userId: identity.subject,
      threadId: args.threadId,
      toolCallId: args.toolCallId,
      confirmationData: args.confirmationData,
      createdAt: now,
      expiresAt: now + fiveMinutes,
      status: "pending",
    });
    
    console.log(`[savePendingConfirmation] Created new pending confirmation:`, {
      id: confirmationId,
      threadId: args.threadId,
      toolCallId: args.toolCallId,
      foodDescription: args.confirmationData.description,
      expiresAt: new Date(now + fiveMinutes).toISOString()
    });
    
    return confirmationId;
  },
});

// Get the latest pending confirmation for a thread
export const getLatestPendingConfirmation = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    console.log(`[getLatestPendingConfirmation] Querying for thread: ${args.threadId}`);
    
    const pending = await ctx.db
      .query("pendingConfirmations")
      .withIndex("by_user_thread", q => 
        q.eq("userId", identity.subject).eq("threadId", args.threadId)
      )
      .filter(q => q.eq(q.field("status"), "pending"))
      .order("desc")
      .first();
    
    if (pending) {
      console.log(`[getLatestPendingConfirmation] Found pending confirmation:`, {
        id: pending._id,
        status: pending.status,
        createdAt: pending.createdAt,
        expiresAt: pending.expiresAt,
        isExpired: pending.expiresAt < Date.now()
      });
    } else {
      console.log(`[getLatestPendingConfirmation] No pending confirmation found`);
    }
    
    // Check if expired
    if (pending && pending.expiresAt < Date.now()) {
      console.log(`[getLatestPendingConfirmation] Confirmation expired, returning null`);
      return null;
    }
    
    return pending;
  },
});

// Mark a confirmation as confirmed
export const confirmPendingConfirmation = mutation({
  args: {
    confirmationId: v.id("pendingConfirmations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    console.log(`[confirmPendingConfirmation] Marking confirmation as confirmed:`, args.confirmationId);
    
    const confirmation = await ctx.db.get(args.confirmationId);
    if (!confirmation || confirmation.userId !== identity.subject) {
      console.log(`[confirmPendingConfirmation] Confirmation not found or wrong user`);
      throw new Error("Confirmation not found");
    }
    
    console.log(`[confirmPendingConfirmation] Current status:`, confirmation.status);
    await ctx.db.patch(args.confirmationId, { status: "confirmed" });
    console.log(`[confirmPendingConfirmation] Successfully marked as confirmed`);
    
    return confirmation;
  },
});

// Expire a pending confirmation
export const expirePendingConfirmation = mutation({
  args: {
    confirmationId: v.id("pendingConfirmations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const confirmation = await ctx.db.get(args.confirmationId);
    if (!confirmation || confirmation.userId !== identity.subject) {
      throw new Error("Confirmation not found");
    }
    
    await ctx.db.patch(args.confirmationId, { status: "expired" });
    return confirmation;
  },
});

// Clean up expired confirmations
export const cleanupExpiredConfirmations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expired = await ctx.db
      .query("pendingConfirmations")
      .withIndex("by_expires")
      .filter(q => q.lt(q.field("expiresAt"), now))
      .collect();
    
    for (const confirmation of expired) {
      if (confirmation.status === "pending") {
        await ctx.db.patch(confirmation._id, { status: "expired" });
      }
    }
    
    return expired.length;
  },
});

// Clear all pending confirmations for a user (used when starting new chat)
export const clearUserPendingConfirmations = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const pendingConfirmations = await ctx.db
      .query("pendingConfirmations")
      .withIndex("by_user_thread", q => q.eq("userId", identity.subject))
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();
    
    for (const confirmation of pendingConfirmations) {
      await ctx.db.patch(confirmation._id, { status: "expired" });
    }
    
    return pendingConfirmations.length;
  },
});