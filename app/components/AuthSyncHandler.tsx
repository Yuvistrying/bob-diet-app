"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent } from "./ui/card";
import { api } from "~/convex/_generated/api";

interface AuthSyncHandlerProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function AuthSyncHandler({ children, redirectTo }: AuthSyncHandlerProps) {
  const { isSignedIn, userId, isLoaded } = useAuth();
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  const upsertUser = useMutation(api.users.upsertUser);
  const convexUser = useQuery(api.users.findUserByToken, {
    tokenIdentifier: userId || "",
  });

  // Check if user exists in Convex
  const userExistsInConvex = isSignedIn && convexUser !== null;

  useEffect(() => {
    const syncUserToConvex = async () => {
      if (!isLoaded || !isSignedIn || !userId) {
        console.log("[AuthSync] Not ready to sync:", { isLoaded, isSignedIn, userId });
        return;
      }

      // If user already exists in Convex, we're done
      if (userExistsInConvex) {
        console.log("[AuthSync] User already exists in Convex");
        setSyncState("success");
        return;
      }

      // User is signed in but not in Convex - need to sync
      setSyncState("syncing");
      console.log("[AuthSync] Starting user sync...", { userId, retryCount });
      
      // Report sync attempt to server
      fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Starting user sync",
          userId,
          retryCount,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          type: "auth_sync_started"
        })
      }).catch(() => {});

      try {
        const result = await upsertUser();
        console.log("[AuthSync] User sync successful:", result);
        setSyncState("success");
        setRetryCount(0);
        
        // Redirect if needed
        if (redirectTo) {
          window.location.href = redirectTo;
        }
      } catch (error) {
        console.error("[AuthSync] User sync failed:", error);
        setSyncState("error");
        
        const message = error instanceof Error ? error.message : "Unknown error";
        setErrorMessage(message);
        
        // Report error to server for debugging
        fetch("/api/report-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: message,
            userId,
            retryCount,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            type: "auth_sync_failed"
          })
        }).catch(() => {}); // Ignore reporting errors

        // Auto-retry with exponential backoff
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`[AuthSync] Retrying in ${delay}ms...`);
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setSyncState("idle");
          }, delay);
        }
      }
    };

    if (syncState === "idle" && isLoaded) {
      syncUserToConvex();
    }
  }, [isLoaded, isSignedIn, userId, userExistsInConvex, syncState, retryCount, upsertUser, redirectTo]);

  // Loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in - show children (likely sign-in prompt)
  if (!isSignedIn) {
    return <>{children}</>;
  }

  // Syncing state
  if (syncState === "syncing") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <h2 className="text-lg font-semibold">Setting up your account...</h2>
          <p className="text-muted-foreground">
            We're preparing your personalized diet coaching experience. This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  // Error state with manual retry
  if (syncState === "error" && retryCount >= 3) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md w-full space-y-4">
          <Alert className="border-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              We're having trouble setting up your account. This might be due to:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Browser extensions blocking connections</li>
                <li>Network or firewall restrictions</li>
                <li>Third-party cookies being disabled</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-mono break-all">
              Error: {errorMessage}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              User ID: {userId}
            </p>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
            <Button 
              onClick={() => {
                setRetryCount(0);
                setSyncState("idle");
              }}
              className="flex-1"
            >
              Try Again
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            If this problem persists, please contact support at{" "}
            <a href="mailto:support@bobdietcoach.ai" className="underline">
              support@bobdietcoach.ai
            </a>{" "}
            with your User ID.
          </p>
        </div>
      </div>
    );
  }

  // Success or still checking - show children
  return <>{children}</>;
}