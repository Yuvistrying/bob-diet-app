import { v } from "convex/values";
import { action } from "./_generated/server";

// Simple Sentry error reporting for Convex functions
export const captureException = action({
  args: {
    error: v.object({
      message: v.string(),
      stack: v.optional(v.string()),
      name: v.optional(v.string()),
    }),
    context: v.optional(v.any()),
    level: v.optional(v.union(v.literal("error"), v.literal("warning"), v.literal("info"))),
  },
  handler: async (ctx, { error, context, level = "error" }) => {
    const sentryDSN = process.env.SENTRY_DSN;
    
    if (!sentryDSN) {
      console.error("[Sentry] No DSN configured, logging locally:", error);
      return { success: false, reason: "No Sentry DSN configured" };
    }

    // Parse the DSN
    const dsnMatch = sentryDSN.match(/https:\/\/([^@]+)@([^\/]+)\/(\d+)/);
    if (!dsnMatch) {
      console.error("[Sentry] Invalid DSN format");
      return { success: false, reason: "Invalid DSN format" };
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const endpoint = `https://${host}/api/${projectId}/store/`;

    // Get user info if available
    const identity = await ctx.auth.getUserIdentity();

    // Build Sentry event
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "javascript",
      logger: "convex",
      level,
      exception: {
        values: [{
          type: error.name || "Error",
          value: error.message,
          stacktrace: error.stack ? {
            frames: error.stack.split("\n").map(line => ({
              filename: "convex-function",
              function: line.trim(),
              in_app: true,
            })),
          } : undefined,
        }],
      },
      user: identity ? {
        id: identity.subject,
        email: identity.email,
        username: identity.name,
      } : undefined,
      tags: {
        source: "convex",
        environment: process.env.CONVEX_ENVIRONMENT || "development",
      },
      extra: {
        context,
        convex_deployment: process.env.CONVEX_DEPLOYMENT,
      },
      server_name: "convex-backend",
      environment: process.env.CONVEX_ENVIRONMENT || "development",
    };

    try {
      // Send to Sentry
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}`,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Sentry returned ${response.status}: ${await response.text()}`);
      }

      return { success: true, eventId: event.event_id };
    } catch (err) {
      console.error("[Sentry] Failed to send error:", err);
      return { success: false, reason: String(err) };
    }
  },
});