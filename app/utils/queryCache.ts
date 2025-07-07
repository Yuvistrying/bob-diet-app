interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Create singleton instance
const queryCache = new QueryCache();

// Cache helper functions
export function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 300000, // 5 minutes default
): Promise<T> {
  const cached = queryCache.get<T>(key);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  return fetcher().then((data) => {
    queryCache.set(key, data, ttlMs);
    return data;
  });
}

export function invalidateCache(key: string): void {
  queryCache.invalidate(key);
}

export function invalidateCachePattern(pattern: string): void {
  queryCache.invalidatePattern(pattern);
}

// Specific cache keys
export const CACHE_KEYS = {
  todayStats: (userId: string) => `todayStats:${userId}`,
  userProfile: (userId: string) => `userProfile:${userId}`,
  dailySummary: (userId: string) => `dailySummary:${userId}`,
  preferences: (userId: string) => `preferences:${userId}`,
};

// Cache TTLs in milliseconds
export const CACHE_TTL = {
  todayStats: 5 * 60 * 1000, // 5 minutes
  userProfile: 10 * 60 * 1000, // 10 minutes
  dailySummary: 5 * 60 * 1000, // 5 minutes
  preferences: 15 * 60 * 1000, // 15 minutes
};
