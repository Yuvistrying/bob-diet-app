"use client";

import { useEffect } from "react";

export function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[SW] Registration successful:", registration.scope);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 1000); // Check every minute

          // Handle updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  // New service worker available
                  console.log("[SW] New version available");
                  
                  // On mobile, auto-update
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  if (isMobile) {
                    console.log("[SW] Auto-updating on mobile");
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }
                } else {
                  // First install
                  console.log("[SW] Service worker installed for the first time");
                }
              }
            });
          });
        })
        .catch((error) => {
          console.error("[SW] Registration failed:", error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "CHUNK_LOAD_ERROR") {
          console.error("[SW] Chunk load error detected:", event.data.url);
          
          // Clear cache and reload on mobile
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_CACHE" });
            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
        }
      });

      // Handle controller change (new service worker activated)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("[SW] Controller changed, reloading...");
        window.location.reload();
      });
    }
  }, []);

  return null;
}