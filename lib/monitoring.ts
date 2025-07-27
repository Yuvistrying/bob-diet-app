import * as Sentry from "@sentry/nextjs";

/**
 * Track a general error with optional context
 */
export function trackError(error: Error | unknown, context?: Record<string, any>) {
  // Always log to console for debugging
  console.error('[Sentry] Error tracked:', error, context);
  
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('error_context', context);
    }
    scope.setTag('environment', process.env.NODE_ENV || 'development');
    Sentry.captureException(error);
  });
}

/**
 * Track a critical error that requires immediate attention
 */
export function trackCriticalError(
  message: string, 
  error: Error | unknown, 
  context?: Record<string, any>
) {
  // Always log critical errors
  console.error('[Sentry] Critical error:', message, error, context);
  
  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('critical', true);
    scope.setTag('environment', process.env.NODE_ENV || 'development');
    if (context) {
      scope.setContext('critical_context', context);
    }
    Sentry.captureException(error, {
      tags: { critical: true },
      extra: { message },
    });
  });
}

/**
 * Track AI/LLM specific errors with model context
 */
export function trackAIError(
  error: Error | unknown,
  {
    model,
    operation,
    userId,
    threadId,
    prompt,
    ...additionalContext
  }: {
    model: string;
    operation: string;
    userId?: string;
    threadId?: string;
    prompt?: string;
    [key: string]: any;
  }
) {
  console.error('[Sentry] AI Error:', { error, model, operation, userId, threadId });

  Sentry.withScope((scope) => {
    scope.setTag('ai_error', true);
    scope.setTag('model', model);
    scope.setTag('operation', operation);
    scope.setTag('environment', process.env.NODE_ENV || 'development');
    scope.setContext('ai_context', {
      model,
      operation,
      userId,
      threadId,
      // Log prompt length, not content for privacy
      promptLength: prompt?.length,
      ...additionalContext,
    });
    Sentry.captureException(error);
  });
}

/**
 * Track Convex-specific errors
 */
export function trackConvexError(
  error: Error | unknown,
  {
    functionName,
    userId,
    ...additionalContext
  }: {
    functionName: string;
    userId?: string;
    [key: string]: any;
  }
) {
  console.error('[Sentry] Convex Error:', { error, functionName, userId });

  // Check if it's a rate limit error
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('Rate limited')) {
    // These are grouped together in Sentry config
    Sentry.captureException(error, {
      fingerprint: ['convex-rate-limit'],
      tags: { convex: true, rate_limited: true },
      extra: { functionName },
    });
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag('convex_error', true);
    scope.setTag('function', functionName);
    scope.setContext('convex_context', {
      functionName,
      userId,
      ...additionalContext,
    });
    Sentry.captureException(error);
  });
}

/**
 * Track payment-related errors
 */
export function trackPaymentError(
  error: Error | unknown,
  {
    provider = 'polar',
    operation,
    userId,
    amount,
    currency,
    ...additionalContext
  }: {
    provider?: string;
    operation: string;
    userId?: string;
    amount?: number;
    currency?: string;
    [key: string]: any;
  }
) {
  console.error('[Sentry] Payment Error:', { error, provider, operation, userId });

  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('payment_error', true);
    scope.setTag('provider', provider);
    scope.setTag('operation', operation);
    scope.setContext('payment_context', {
      provider,
      operation,
      userId,
      // Don't log sensitive payment details
      hasAmount: !!amount,
      currency,
      ...additionalContext,
    });
    Sentry.captureException(error);
  });
}

/**
 * Log a message to Sentry (not an error)
 */
export function logMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  console.log(`[Sentry][${level.toUpperCase()}]`, message, context);
  
  Sentry.captureMessage(message, level);
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  console.log(`[Sentry][Breadcrumb] ${category}: ${message}`, data);

  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for all subsequent errors
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
} | null) {
  console.log('[Sentry] User context set:', user);

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Track performance of an operation
 */
export async function trackPerformance<T>(
  operation: string,
  category: string,
  fn: () => Promise<T>
): Promise<T> {

  const transaction = Sentry.startInactiveSpan({
    op: category,
    name: operation,
  });

  try {
    const result = await fn();
    transaction.setStatus({ code: 1 }); // OK status
    return result;
  } catch (error) {
    transaction.setStatus({ code: 2 }); // Internal error status
    throw error;
  } finally {
    transaction.end();
  }
}

/**
 * Create a custom performance span
 */
export function startSpan(name: string, op: string) {

  return Sentry.startInactiveSpan({ name, op });
}

/**
 * Logger that integrates with Sentry
 */
export const logger = {
  trace: (message: string, data?: Record<string, any>) => {
    console.trace(`[Sentry] ${message}`, data);
    Sentry.addBreadcrumb({ message, level: 'debug', data });
  },
  
  debug: (message: string, data?: Record<string, any>) => {
    console.debug(`[Sentry] ${message}`, data);
    Sentry.addBreadcrumb({ message, level: 'debug', data });
  },
  
  info: (message: string, data?: Record<string, any>) => {
    console.info(`[Sentry] ${message}`, data);
    logMessage(message, 'info', data);
  },
  
  warn: (message: string, data?: Record<string, any>) => {
    console.warn(`[Sentry] ${message}`, data);
    logMessage(message, 'warning', data);
  },
  
  error: (message: string, error?: Error | unknown, data?: Record<string, any>) => {
    console.error(`[Sentry] ${message}`, error, data);
    if (error) {
      trackError(error, { message, ...data });
    } else {
      logMessage(message, 'error', data);
    }
  },
  
  fatal: (message: string, error: Error | unknown, data?: Record<string, any>) => {
    console.error(`[Sentry] FATAL: ${message}`, error, data);
    trackCriticalError(message, error, data);
  },
};