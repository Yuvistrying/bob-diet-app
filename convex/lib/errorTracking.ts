import { api } from "../_generated/api";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type ConvexContext = QueryCtx | MutationCtx | ActionCtx;

/**
 * Track errors in Convex functions and send to Sentry
 * Only sends in production or when SENTRY_DSN is set
 */
export async function trackConvexError(
  ctx: ConvexContext,
  error: Error,
  context?: Record<string, any>
) {
  // Log locally always
  console.error("[Convex Error]", error.message, {
    stack: error.stack,
    context,
  });

  // Only send to Sentry if we have an action context (can make external requests)
  // and we have a DSN configured
  if ("runAction" in ctx && process.env.SENTRY_DSN) {
    try {
      await ctx.runAction(api.sentry.captureException, {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context,
        level: "error",
      });
    } catch (sentryError) {
      // Don't let Sentry errors break the app
      console.error("[Sentry] Failed to report error:", sentryError);
    }
  }
}

/**
 * Wrap a Convex handler with error tracking
 */
export function withErrorTracking<Args extends Record<string, any>, Return>(
  handler: (ctx: ConvexContext, args: Args) => Promise<Return>,
  functionName: string
) {
  return async (ctx: ConvexContext, args: Args): Promise<Return> => {
    try {
      return await handler(ctx, args);
    } catch (error) {
      await trackConvexError(ctx, error as Error, {
        functionName,
        args: JSON.stringify(args).slice(0, 1000), // Limit size
      });
      throw error; // Re-throw to maintain normal error flow
    }
  };
}