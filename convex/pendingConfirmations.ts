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
    
    const pending = await ctx.db
      .query("pendingConfirmations")
      .withIndex("by_user_thread", q => 
        q.eq("userId", identity.subject).eq("threadId", args.threadId)
      )
      .filter(q => q.eq(q.field("status"), "pending"))
      .order("desc")
      .first();
    
    // Check if expired
    if (pending && pending.expiresAt < Date.now()) {
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
    
    const confirmation = await ctx.db.get(args.confirmationId);
    if (!confirmation || confirmation.userId !== identity.subject) {
      throw new Error("Confirmation not found");
    }
    
    await ctx.db.patch(args.confirmationId, { status: "confirmed" });
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