"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function SSOCallbackPage() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Log the callback parameters for debugging
    console.log("SSO Callback - Search params:", Object.fromEntries(searchParams.entries()));
    console.log("SSO Callback - Full URL:", window.location.href);
  }, [searchParams]);

  // This handles the redirect flow from OAuth providers
  // It will automatically complete the sign-up/sign-in process
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <AuthenticateWithRedirectCallback 
          afterSignUpUrl="/pricing"
          afterSignInUrl="/chat"
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Completing sign-in with Google...
        </p>
      </div>
    </div>
  );
}