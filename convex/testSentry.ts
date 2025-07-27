import { mutation } from "./_generated/server";
import { trackConvexError } from "./lib/errorTracking";

export const testError = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Create a test error
    const error = new Error("Test Convex Sentry Integration - This is a test error");
    
    // Track it with context
    await trackConvexError(ctx, error, {
      userId: identity?.subject,
      userEmail: identity?.email,
      testType: "manual",
      timestamp: new Date().toISOString(),
    });
    
    // Also throw it to see if unhandled errors are caught
    throw error;
  },
});