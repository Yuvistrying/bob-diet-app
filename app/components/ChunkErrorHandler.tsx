"use client";

import { useEffect } from "react";

export function ChunkErrorHandler() {
  useEffect(() => {
    // Handle chunk loading errors
    const handleError = (event: ErrorEvent) => {
      const chunkFailedMessage = /Loading chunk [\d]+ failed/;
      const chunkCSSFailedMessage = /Loading CSS chunk [\d]+ failed/;
      const missingChunkMessage =
        /missing: https:\/\/.*\/_next\/static\/chunks\//;

      if (
        chunkFailedMessage.test(event.message) ||
        chunkCSSFailedMessage.test(event.message) ||
        missingChunkMessage.test(event.message)
      ) {
        console.error(
          "[ChunkErrorHandler] Chunk loading failed:",
          event.message,
        );

        // Report to our error tracking
        fetch("/api/report-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: event.message,
            type: "chunk_load_error",
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            stack: event.error?.stack || event.message,
          }),
        }).catch(() => {});

        // Check if we've already tried to reload recently
        const lastReload = localStorage.getItem("lastChunkErrorReload");
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload) > 10000) {
          // 10 seconds
          localStorage.setItem("lastChunkErrorReload", now.toString());

          // Detect if mobile or in-app browser
          const isMobile = /iPhone|iPad|iPod|Android/i.test(
            navigator.userAgent,
          );
          const isInAppBrowser =
            /GSA|FBAN|FBAV|Instagram|TikTok|LinkedIn/i.test(
              navigator.userAgent,
            );

          if (isMobile || isInAppBrowser) {
            // Auto-reload on mobile without confirmation
            console.log("[ChunkErrorHandler] Auto-reloading on mobile...");
            window.location.reload();
          } else {
            // Show user-friendly message on desktop
            if (
              window.confirm(
                "We've updated the app! Please click OK to reload and get the latest version.",
              )
            ) {
              window.location.reload();
            }
          }
        } else {
          // If we've already tried reloading recently, show a different message
          console.error("[ChunkErrorHandler] Already tried reloading recently");

          // Log persistent error to server
          fetch("/api/report-error", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              error: `Persistent chunk loading error: ${event.message}`,
              type: "persistent_chunk_error",
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
