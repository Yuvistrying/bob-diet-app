// Client-side instrumentation
// Sentry is already initialized in sentry.client.config.ts
// This file is just for Next.js instrumentation hooks if needed

export function register() {
  // Client-side instrumentation runs automatically via sentry.client.config.ts
  console.log("[Instrumentation] Client-side instrumentation registered");
}