"use client";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";

export default function WelcomePage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const userProfile = useQuery(
    api.users.getUserProfile,
    isSignedIn ? {} : "skip"
  );
  const subscriptionStatus = useQuery(
    api.subscriptions.checkSubscriptionStatus,
    isSignedIn ? {} : "skip"
  );

  useEffect(() => {
    if (!isLoaded) return;

    // Not signed in - redirect to home
    if (!isSignedIn) {
      router.push("/");
      return;
    }

    // Still loading data
    if (userProfile === undefined || subscriptionStatus === undefined) {
      return;
    }

    // Check subscription status
    const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription;

    // If no subscription, redirect to subscription-required
    if (!hasActiveSubscription) {
      router.push("/subscription-required");
      return;
    }

    // If no profile (new user), redirect to onboarding
    if (!userProfile) {
      router.push("/onboarding");
      return;
    }

    // Has subscription and profile - go to chat
    router.push("/chat");
  }, [isLoaded, isSignedIn, userProfile, subscriptionStatus, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Setting up your account...</p>
      </div>
    </div>
  );
}