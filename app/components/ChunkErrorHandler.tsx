"use client";

import { useEffect } from "react";

export function ChunkErrorHandler() {
  useEffect(() => {
    // Handle chunk loading errors
    const handleError = (event: ErrorEvent) => {
      const chunkFailedMessage = /Loading chunk [\d]+ failed/;
      const chunkCSSFailedMessage = /Loading CSS chunk [\d]+ failed/;

      if (
        chunkFailedMessage.test(event.message) ||
        chunkCSSFailedMessage.test(event.message)
      ) {
        console.error(
          "[ChunkErrorHandler] Chunk loading failed:",
          event.message,
        );

        // Check if we've already tried to reload recently
        const lastReload = localStorage.getItem("lastChunkErrorReload");
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload) > 10000) {
          // 10 seconds
          localStorage.setItem("lastChunkErrorReload", now.toString());

          // Show user-friendly message
          if (
            window.confirm(
              "We've updated the app! Please click OK to reload and get the latest version.",
            )
          ) {
            window.location.reload();
          }
        } else {
          // If we've already tried reloading recently, show a different message
          console.error("[ChunkErrorHandler] Already tried reloading recently");

          // Log to server
          fetch("/api/log-error", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Persistent chunk loading error: ${event.message}`,
              stack: event.error?.stack || "No stack trace",
              url: window.location.href,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString(),
            }),
          }).catch(console.error);
        }
      }
    };

    // Listen for errors
    window.addEventListener("error", handleError);

    // Also handle unhandled promise rejections (for dynamic imports)
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === "ChunkLoadError") {
        handleError(
          new ErrorEvent("error", {
            message: event.reason.message,
            error: event.reason,
          }),
        );
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
