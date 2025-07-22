"use client";

import React from "react";
import { Button } from "@/app/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console with full details
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Log additional debugging info
    console.error("Error stack:", error.stack);
    console.error("Component stack:", errorInfo.componentStack);

    // You could also send this to an error reporting service here
    // Example: Sentry, LogRocket, etc.

    // Log to server if needed
    if (typeof window !== "undefined") {
      // Send error to your server endpoint
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      }).catch((fetchError) => {
        console.error("Failed to log error to server:", fetchError);
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground">
              We apologize for the inconvenience. The error has been logged and
              we'll look into it.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mt-4 p-4 bg-muted rounded-lg text-left">
                <p className="font-mono text-sm text-destructive">
                  {this.state.error.message}
                </p>
                <pre className="mt-2 text-xs overflow-auto max-h-40">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="flex gap-4 justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
              >
                Go Home
              </Button>
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
