"use client";

import { SignUp } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already signed in, redirect them to chat
    if (isLoaded && isSignedIn) {
      router.push("/chat");
    }
  }, [isLoaded, isSignedIn, router]);

  // Don't render SignUp component if user is already signed in
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
      <SignUp
        fallbackRedirectUrl="/pricing"
        signInFallbackRedirectUrl="/chat"
      />
    </div>
  );
}