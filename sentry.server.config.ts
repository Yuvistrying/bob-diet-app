import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adds request headers and IP for users
  sendDefaultPii: true,
  
  // Performance Monitoring - adjust sample rate by environment
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Environment detection
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
               process.env.VERCEL_ENV || 
               process.env.NODE_ENV || 
               'development',
    
    // Enable logging
    enableLogs: true,
    
    // Server-specific error filtering
    ignoreErrors: [
      // Network errors
      'ECONNRESET',
      'EPIPE',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EAI_AGAIN',
      // Convex temporary issues
      'ConvexError: Rate limited',
      'ConvexError: Too many requests',
      // Clerk issues
      'Clerk: Network error',
      // Anthropic API issues
      'AnthropicError: Rate limit',
      'AnthropicError: Network error',
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
    
    integrations: [
      // HTTP instrumentation
      Sentry.httpIntegration({
        tracing: true,
        breadcrumbs: true,
      }),
      // Capture console logs
      Sentry.consoleIntegration({
        levels: ['error', 'warn'],
      }),
    ],
    
    beforeSend(event, hint) {
      // Add environment context
      event.environment = event.environment || 
                         process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
                         process.env.VERCEL_ENV || 
                         process.env.NODE_ENV || 
                         'development';
      
      const error = hint.originalException;
      const errorMessage = error?.message || event.exception?.values?.[0]?.value || '';
      
      // Group all Convex rate limit errors together
      if (errorMessage.includes('Rate limited') || 
          errorMessage.includes('Too many requests')) {
        event.fingerprint = ['convex-rate-limit'];
      }
      
      // Group Anthropic API errors
      if (errorMessage.includes('AnthropicError')) {
        event.fingerprint = ['anthropic-api-error', errorMessage.split(':')[0]];
      }
      
      // Group database connection errors
      if (errorMessage.match(/E(CONN|TIMEOUT|NOTFOUND)/)) {
        event.fingerprint = ['network-error'];
      }
      
      // Add context for API errors
      if (event.request?.url?.includes('/api/')) {
        event.contexts = {
          ...event.contexts,
          api: {
            endpoint: event.request.url,
            method: event.request.method,
          },
        };
      }
      
      return event;
    },
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb, hint) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.level === 'debug') {
        return null;
      }
      
      // Enhance HTTP breadcrumbs
      if (breadcrumb.category === 'http') {
        // Don't log requests to monitoring endpoints
        if (breadcrumb.data?.url?.includes('/monitoring') ||
            breadcrumb.data?.url?.includes('sentry.io')) {
          return null;
        }
      }
      
      return breadcrumb;
    },
  });

// Log Sentry initialization
console.log('[Sentry] Server initialized for environment:', 
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 
  process.env.VERCEL_ENV || 
  process.env.NODE_ENV || 
  'development'
);