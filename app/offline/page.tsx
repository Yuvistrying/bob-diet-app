"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <WifiOff className="w-16 h-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-semibold mb-2">You're offline</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Bob Diet Coach requires an internet connection to sync your data and
        provide personalized coaching.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
