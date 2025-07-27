import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@clerk/nextjs/server";
import { trackAIError, addBreadcrumb, logger } from "../../../lib/monitoring";

export async function POST(request: Request) {
  try {
    // Add breadcrumb for tracking
    addBreadcrumb("Sentry test API called", "api.test", {
      method: "POST",
      endpoint: "/api/sentry-test",
    });

    // Get user context
    const { userId } = await auth();
    
    // Log the test
    logger.info("Sentry test API endpoint called", {
      userId,
      timestamp: new Date().toISOString(),
    });

    // Simulate different types of errors
    const errorType = request.headers.get("X-Error-Type") || "default";

    switch (errorType) {
      case "ai-error":
        // Simulate an AI/LLM error
        const aiError = new Error("Simulated AI model error: Rate limit exceeded");
        trackAIError(aiError, {
          model: "claude-sonnet-4",
          operation: "test_generation",
          userId: userId || "anonymous",
          threadId: "test-thread-123",
        });
        throw aiError;

      case "network-error":
        // Simulate a network error
        const networkError = new Error("ECONNREFUSED: Connection refused to external service");
        networkError.name = "NetworkError";
        throw networkError;

      case "convex-error":
        // Simulate a Convex error
        const convexError = new Error("ConvexError: Rate limited - too many requests");
        throw convexError;

      default:
        // Default test error
        throw new Error("Test API error - This is a test error from the Sentry test endpoint");
    }
  } catch (error) {
    // Log the error
    logger.error("Sentry test API error", error as Error, {
      endpoint: "/api/sentry-test",
      method: "POST",
    });

    // Manually capture the exception to Sentry in all environments
    Sentry.captureException(error, {
      tags: {
        api_endpoint: "sentry-test",
        test: true,
        environment: process.env.NODE_ENV,
      },
      level: "error",
      extra: {
        message: "This is a test error from the Sentry test API",
        errorType: request.headers.get("X-Error-Type") || "default",
      },
    });

    // Return error response
    return NextResponse.json(
      { 
        error: (error as Error).message,
        message: "This error was intentionally thrown for testing Sentry",
        environment: process.env.NODE_ENV,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Simple health check for the test endpoint
  return NextResponse.json({
    status: "ok",
    message: "Sentry test endpoint is working",
    environment: process.env.NODE_ENV,
    sentryEnabled: process.env.NODE_ENV === 'production',
  });
}