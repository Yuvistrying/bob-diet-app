"use client";

import { useState, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useUser } from "@clerk/nextjs";

export default function Page() {
  const { user } = useUser();
  const [buttonError, setButtonError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("[Sentry Test] Page loaded - Environment:", process.env.NODE_ENV);
    console.log("[Sentry Test] Sentry is now active in all environments!");
  }, []);

  const handleThrowError = () => {
    try {
      throw new Error("Test Sentry error capture - Frontend");
    } catch (error) {
      setButtonError(error as Error);
      // In production, this will be captured by the error boundary
      throw error;
    }
  };

  const handleAPIError = async () => {
    try {
      const response = await fetch("/api/sentry-test", {
        method: "POST",
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "API test error");
      }
    } catch (error) {
      console.error("API Error:", error);
      alert(`API Error: ${(error as Error).message}`);
    }
  };

  const handleManualCapture = () => {
    const testError = new Error("Manually captured test error");
    Sentry.captureException(testError, {
      tags: {
        test: true,
        source: "manual_button",
      },
      level: "warning",
      user: user ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      } : undefined,
    });
    alert("Error manually sent to Sentry (if in production)");
  };

  const handlePerformanceTest = async () => {
    const transaction = Sentry.startInactiveSpan({
      name: "test-performance-transaction",
      op: "test",
    });

    try {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      transaction.setAttribute("test", true);
      transaction.setAttribute("user_id", user?.id || "anonymous");
      transaction.setStatus({ code: 1 }); // OK
      
      alert("Performance transaction sent to Sentry (if in production)");
    } catch (error) {
      transaction.setStatus({ code: 2 }); // Error
      throw error;
    } finally {
      transaction.end();
    }
  };

  const handleBreadcrumbTest = () => {
    // Add some breadcrumbs
    Sentry.addBreadcrumb({
      message: "User clicked breadcrumb test button",
      category: "user-action",
      level: "info",
      data: {
        buttonId: "breadcrumb-test",
        timestamp: new Date().toISOString(),
      },
    });

    Sentry.addBreadcrumb({
      message: "Preparing to throw test error",
      category: "test",
      level: "warning",
    });

    // Now throw an error that will include these breadcrumbs
    throw new Error("Error with breadcrumb context");
  };

  if (buttonError) {
    throw buttonError;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold">Sentry Test Page</h1>
        
        <div className="mb-6 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Environment:</strong> {process.env.NODE_ENV}
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>User:</strong> {user ? user.primaryEmailAddress?.emailAddress : "Not signed in"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            ✅ Sentry is active in all environments - errors will be captured and sent to Sentry
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">Frontend Error</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Throws an unhandled error that will be caught by the error boundary
            </p>
            <button
              onClick={handleThrowError}
              className="rounded bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              Throw Test Error
            </button>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">API Error</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Calls an API endpoint that throws an error
            </p>
            <button
              onClick={handleAPIError}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Test API Error
            </button>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">Manual Capture</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Manually captures an error without throwing
            </p>
            <button
              onClick={handleManualCapture}
              className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90"
            >
              Capture Error Manually
            </button>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">Performance Test</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Creates a performance transaction
            </p>
            <button
              onClick={handlePerformanceTest}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
            >
              Test Performance Tracking
            </button>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-semibold">Breadcrumb Test</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Adds breadcrumbs then throws an error
            </p>
            <button
              onClick={handleBreadcrumbTest}
              className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/90"
            >
              Test with Breadcrumbs
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm">
            <strong>⚠️ Important:</strong> This page should be removed from production after testing.
            It's only meant to verify that Sentry is properly configured.
          </p>
        </div>
      </div>
    </div>
  );
}