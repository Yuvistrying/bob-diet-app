import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adds request headers and IP for users
  sendDefaultPii: true,
  
  // Performance Monitoring - adjust sample rate by environment
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay - more aggressive in dev/staging
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
  replaysOnErrorSampleRate: 1.0, // Always 100% for errors
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Environment detection
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
               process.env.NEXT_PUBLIC_VERCEL_ENV || 
               process.env.NODE_ENV || 
               'development',
    
    // Integrations
    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Session replay with privacy settings
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
        // Mask specific CSS classes for extra privacy
        mask: ['.sensitive', '.private'],
        // Unmask specific CSS classes if needed
        unmask: [],
      }),
      // User feedback widget
      Sentry.feedbackIntegration({
        colorScheme: "system",
        showBranding: false,
        autoInject: false, // We'll trigger it manually for specific errors
      }),
    ],
    
    // Enable logging
    enableLogs: true,
    
    // Filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      'fb_xd_fragment',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      'Load failed',
      'The operation was aborted',
      // Common false positives
      'Non-Error promise rejection captured',
      'Non-Error exception captured',
      // Convex temporary issues
      'ConvexError: Rate limited',
      'ConvexError: Too many requests',
      // ResizeObserver errors (common in Chrome)
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Safari specific
      'Non-Error promise rejection captured with value: null',
      // Next.js specific
      'NEXT_NOT_FOUND',
      'NEXT_REDIRECT',
      // Clerk auth errors that are expected
      'Clerk: ',
      // Mobile browser errors
      'Blocked a frame with origin',
      'The play() request was interrupted',
    ],
    
    // Transactions to ignore
    ignoreTransactions: [
      // Health checks
      '/api/health',
      '/api/ping',
      // Static assets
      '/_next/static',
      '/_next/image',
      // Sentry tunnel
      '/monitoring',
    ],
    
    beforeSend(event, hint) {
      // Add environment context
      event.environment = event.environment || 
                         process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
                         process.env.NEXT_PUBLIC_VERCEL_ENV || 
                         process.env.NODE_ENV || 
                         'development';
      
      // Filter out known non-issues
      const error = hint.originalException;
      const errorMessage = error?.message || event.exception?.values?.[0]?.value || '';
      
      // ResizeObserver errors
      if (errorMessage.includes('ResizeObserver loop')) {
        return null;
      }
      
      // Chunk loading errors (usually network issues)
      if (errorMessage.includes('Loading chunk') || 
          errorMessage.includes('Failed to import')) {
        return null;
      }
      
      // Group all Convex rate limit errors together
      if (errorMessage.includes('Rate limited') || 
          errorMessage.includes('Too many requests')) {
        event.fingerprint = ['convex-rate-limit'];
      }
      
      // Group chunk loading errors
      if (errorMessage.includes('ChunkLoadError') || 
          errorMessage.includes('Loading CSS chunk')) {
        event.fingerprint = ['chunk-load-error'];
      }
      
      // Add user feedback for critical errors
      if (event.level === 'error' || event.level === 'fatal') {
        event.contexts = {
          ...event.contexts,
          feedback: {
            contact_email: event.user?.email,
            message: 'Please describe what you were doing when this error occurred',
          },
        };
      }
      
      return event;
    },
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb, hint) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      
      // Filter out navigation to static assets
      if (breadcrumb.category === 'navigation' && 
          (breadcrumb.data?.to?.includes('/_next/') || 
           breadcrumb.data?.to?.includes('/static/'))) {
        return null;
      }
      
      return breadcrumb;
    },
  });

// Log Sentry initialization
console.log('[Sentry] Client initialized for environment:', 
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
  process.env.NEXT_PUBLIC_VERCEL_ENV || 
  process.env.NODE_ENV || 
  'development'
);