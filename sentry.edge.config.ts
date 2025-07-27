import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring - adjust sample rate by environment
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Environment detection
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
               process.env.VERCEL_ENV || 
               process.env.NODE_ENV || 
               'development',
  
  // Edge-specific configuration
  ignoreErrors: [
    // Network errors common in edge
    'NetworkError',
    'Failed to fetch',
    // Convex temporary issues
    'ConvexError: Rate limited',
  ],
  
  beforeSend(event, hint) {
    // Add environment context
    event.environment = event.environment || 
                       process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
                       process.env.VERCEL_ENV || 
                       process.env.NODE_ENV || 
                       'development';
    
    return event;
  },
});

// Log Sentry initialization
console.log('[Sentry] Edge initialized for environment:', 
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
  process.env.VERCEL_ENV || 
  process.env.NODE_ENV || 
  'development'
);