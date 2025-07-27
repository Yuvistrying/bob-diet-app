"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";

export default function Success() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const subscription = useQuery(api.subscriptions.fetchUserSubscription);
  const upsertUser = useMutation(api.users.upsertUser);
  const [isWaiting, setIsWaiting] = useState(true);
  const [waitTime, setWaitTime] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // Ensure user is created/updated when they land on success page
  useEffect(() => {
    if (isSignedIn) {
      upsertUser();
    }
  }, [isSignedIn, upsertUser]);

  // Track wait time and timeout
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime((prev) => {
        if (prev >= 30) {
          setTimedOut(true);
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check subscription status
  useEffect(() => {
    if (subscription?.status === "active") {
      setIsWaiting(false);
    }
  }, [subscription]);

  const handleContinue = () => {
    if (!isWaiting && subscription?.status === "active") {
      router.push("/chat");
    }
  };

  return (
    <section className="flex flex-col items-center justify-center min-h-screen px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-6">
          <div className="mx-auto mb-4">
            {timedOut ? (
              <AlertCircle className="h-16 w-16 text-yellow-500" />
            ) : (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold">
            {timedOut ? "Taking Longer Than Expected" : "Payment Successful!"}
          </CardTitle>
          <CardDescription className="text-lg">
            {timedOut ? (
              <>
                Your payment was successful, but we're still setting up your
                subscription. Please contact support if this continues.
              </>
            ) : isWaiting ? (
              "Setting up your subscription..."
            ) : (
              "Your subscription is now active. Get ready to start your journey with Bob!"
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {timedOut ? (
            <div className="space-y-4">
              <Button
                onClick={() =>
                  (window.location.href = "mailto:support@yourapp.com")
                }
                className="w-full"
                size="lg"
                variant="outline"
              >
                Contact Support
              </Button>
              <Button
                onClick={() => router.push("/chat")}
                className="w-full"
                size="lg"
              >
                Try Continuing Anyway
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleContinue}
              disabled={isWaiting}
              className="w-full"
              size="lg"
            >
              {isWaiting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your subscription... ({waitTime}s)
                </>
              ) : (
                <>
                  Continue to Chat
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
