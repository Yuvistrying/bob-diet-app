import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    integrations: [
      // Performance
      Sentry.browserTracingIntegration(),
      // Session Replay
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      // User Feedback
      Sentry.feedbackIntegration({
        colorScheme: "system",
        showBranding: false,
      }),
    ],

    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Performance Monitoring
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for tracing.
    // We recommend adjusting this value in production
    tracesSampleRate: 0.1, // 10% of transactions

    // Session Replay
    // Capture Replay for 10% of all sessions,
    // plus for 100% of sessions with an error
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Environment
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

    // Filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Facebook related
      'fb_xd_fragment',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // Common false positives
      'Non-Error promise rejection captured',
      // Convex temporary issues
      'ConvexError: Rate limited',
      // ResizeObserver errors (common in Chrome)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    beforeSend(event, hint) {
      // Filter out non-production errors
      if (window.location.hostname === 'localhost') {
        return null;
      }

      // Filter out known non-issues
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) {
        return null;
      }

      // Group all Convex rate limit errors together
      if (event.exception?.values?.[0]?.value?.includes('Rate limited')) {
        event.fingerprint = ['convex-rate-limit'];
      }

      return event;
    },
  });
}