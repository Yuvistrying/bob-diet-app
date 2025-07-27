"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { setUserContext } from "../../lib/monitoring";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string,
);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Set user context for Sentry
    if (user) {
      setUserContext({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username || undefined,
      });
    } else {
      setUserContext(null);
    }
  }, [user]);

  useEffect(() => {
    // Log auth state changes
    console.log("[ConvexProvider] Auth state:", {
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn,
      userId: auth.userId,
      sessionId: auth.sessionId,
      timestamp: new Date().toISOString(),
    });

    // Report to server if there's an auth issue
    if (auth.isLoaded && auth.isSignedIn && !auth.userId) {
      fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Signed in but no userId",
          authState: {
            isLoaded: auth.isLoaded,
            isSignedIn: auth.isSignedIn,
            userId: auth.userId,
          },
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          type: "convex_provider_auth_issue",
        }),
      }).catch(() => {});
    }
  }, [auth.isLoaded, auth.isSignedIn, auth.userId]);

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
