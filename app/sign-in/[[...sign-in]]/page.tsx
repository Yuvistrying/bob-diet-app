"use client";

import { SignIn } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already signed in, redirect them to chat
    if (isLoaded && isSignedIn) {
      router.push("/chat");
    }
  }, [isLoaded, isSignedIn, router]);

  // Don't render SignIn component if user is already signed in
  if (!isLoaded || isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn
        fallbackRedirectUrl="/chat"
        signUpFallbackRedirectUrl="/pricing"
      />
    </div>
  );
}