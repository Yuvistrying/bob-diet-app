import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  // Simple error that will be captured by Sentry
  const error = new Error("Simple API test error - should appear in Sentry");
  
  // Capture to Sentry
  Sentry.captureException(error, {
    tags: {
      test: true,
      endpoint: "sentry-simple-test",
    },
  });
  
  // Also throw it to see if unhandled errors are captured
  throw error;
}