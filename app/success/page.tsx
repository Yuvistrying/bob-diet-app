"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "~/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/app/components/ui/card";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";

export default function Success() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const subscription = useQuery(api.subscriptions.fetchUserSubscription);
  const upsertUser = useMutation(api.users.upsertUser);

  // Ensure user is created/updated when they land on success page
  useEffect(() => {
    if (isSignedIn) {
      upsertUser();
    }
  }, [isSignedIn, upsertUser]);


  return (
    <section className="flex flex-col items-center justify-center min-h-screen px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-6">
          <div className="mx-auto mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-3xl font-bold">
            Payment Successful!
          </CardTitle>
          <CardDescription className="text-lg">
            Your subscription is now active. Get ready to start your journey with Bob!
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">

          <Button asChild className="w-full" size="lg">
            <Link href="/chat">
              Continue to Chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}