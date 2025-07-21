"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function SSOCallbackContent() {
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
          afterSignInUrl="/chat"
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Completing sign-in with Google...
        </p>
      </div>
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    }>
      <SSOCallbackContent />
    </Suspense>
  );
}