interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Retry on network errors or 5xx status codes
    if (error.name === "NetworkError" || error.message?.includes("fetch")) {
      return true;
    }
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    // Don't retry on client errors (4xx)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
    return true;
  },
  onRetry: () => {},
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!opts.shouldRetry(error)) {
        throw error;
      }

      // Check if we've exhausted attempts
      if (attempt === opts.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const baseDelay =
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
      const delay = Math.min(baseDelay, opts.maxDelayMs);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = delay + jitter;

      // Notify about retry
      opts.onRetry(attempt, error);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError;
}

// Specific retry configurations for different use cases
export const RETRY_CONFIGS = {
  // For API calls that might have temporary failures
  api: {
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
  },

  // For file uploads which might take longer
  upload: {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 15000,
  },

  // For real-time operations that need quick retries
  realtime: {
    maxAttempts: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
  },
};
