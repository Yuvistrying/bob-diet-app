"use client";

import { useEffect } from "react";

export function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Skip service worker for iOS 16.2 and below
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const iOSVersion = navigator.userAgent.match(/OS (\d+)_/)?.[1];

      if (isIOS && iOSVersion && parseInt(iOSVersion) <= 16) {
        console.log(
          "[ServiceWorker] Skipping registration for iOS 16 or below",
        );

        // Unregister any existing service worker for iOS 16 users
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
            console.log("[ServiceWorker] Unregistered existing SW for iOS 16");
          });
        });

        return;
      }

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
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(
                    navigator.userAgent,
                  );
                  if (isMobile) {
                    console.log("[SW] Auto-updating on mobile");
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }
                } else {
                  // First install
                  console.log(
                    "[SW] Service worker installed for the first time",
                  );
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
          const isMobile = /iPhone|iPad|iPod|Android/i.test(
            navigator.userAgent,
          );
          if (isMobile) {
            navigator.serviceWorker.controller?.postMessage({
              type: "CLEAR_CACHE",
            });
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
