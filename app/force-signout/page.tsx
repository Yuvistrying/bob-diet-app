"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ForceSignOutPage() {
  const { signOut } = useClerk();
  const router = useRouter();

  useEffect(() => {
    const clearAll = async () => {
      try {
        // Clear all localStorage items that might be Clerk-related
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("clerk") || key.includes("__clerk"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear sessionStorage as well
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes("clerk") || key.includes("__clerk"))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

        // Sign out using Clerk
        await signOut();
        
        // Redirect to home
        router.push("/");
      } catch (error) {
        console.error("Error signing out:", error);
        // Even if sign out fails, still redirect
        router.push("/");
      }
    };

    clearAll();
  }, [signOut, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Clearing session...</h1>
        <p className="text-muted-foreground">Please wait while we sign you out.</p>
      </div>
    </div>
  );
}