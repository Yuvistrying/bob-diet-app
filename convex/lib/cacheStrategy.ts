// Cache strategy constants
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const CACHE_STRATEGY = {
  // Always included (tiny, critical)
  coreStats: {
    ttl: 5 * MINUTE,
    description: "calories consumed/remaining, protein, last meal",
    size: "~100 tokens",
    invalidateOn: ["food_logged", "meal_updated", "food_deleted"] as string[],
  },
  
  // Rarely changes  
  profile: {
    ttl: 7 * DAY,
    description: "name, height, goals, targets",
    size: "~50 tokens",
    invalidateOn: ["profile_updated", "goal_changed"] as string[],
  },
  
  // Daily updates
  weightTrend: {
    ttl: 1 * DAY,
    description: "7-day average, trend direction",
    size: "~20 tokens",
    invalidateOn: ["weight_logged"] as string[],
  },
  
  // Almost never changes
  preferences: {
    ttl: 30 * DAY,
    description: "units (kg/lbs), timezone, display mode",
    size: "~10 tokens",
    invalidateOn: ["preferences_updated"] as string[],
  },
  
  // Today's food summary
  todayFoodLog: {
    ttl: 10 * MINUTE,
    description: "list of foods logged today with times",
    size: "~200 tokens",
    invalidateOn: ["food_logged", "meal_updated", "food_deleted"] as string[],
  },
  
  // Thread context
  threadContext: {
    ttl: 2 * MINUTE,
    description: "recent messages, patterns, topics",
    size: "~300 tokens",
    invalidateOn: ["message_sent"] as string[],
  },
};

export type CacheKey = keyof typeof CACHE_STRATEGY;

// Helper to get cache config
export function getCacheConfig(key: CacheKey) {
  return CACHE_STRATEGY[key];
}

// Helper to check if event should invalidate cache
export function shouldInvalidateCache(cacheKey: CacheKey, event: string): boolean {
  const config = CACHE_STRATEGY[cacheKey];
  return config.invalidateOn.includes(event);
}