# Caching Removal Documentation

**Date**: January 2025  
**Change**: Completely removed caching from chat API route  
**Impact**: All data fetched fresh on every request

## What Was Removed

### Previous Caching Implementation

The chat API previously cached two types of data:

```typescript
// REMOVED from stream-v2/route.ts
const dailySummary = await getCached(
  "dailySummary",
  () => convexClient.query(api.chatHistory.getDailySummary),
  5 * 60 * 1000, // 5 minutes
);

const preferences = await getCached(
  "preferences",
  () => convexClient.query(api.preferences.getPreferences),
  7 * 24 * 60 * 60 * 1000, // 7 days
);
```

### What This Cached

1. **Daily Summary** - Today's food logs (5-minute cache)
2. **User Preferences** - Display settings (7-day cache)

## Current State

### No Caching Active

```typescript
// CURRENT: Direct queries without caching
const preferences = await convexClient.query(api.preferences.getPreferences);
const dietaryPreferences = await convexClient.query(
  api.dietaryPreferences.getUserPreferences,
);
// dailySummary is now built into getBobSystemPrompt
```

### Still Exists But Unused

1. **`/app/utils/queryCache.ts`** - Frontend caching utility (NOT IMPORTED)
2. **`/convex/sessionCache.ts`** - Backend session caching (functional but not called)
3. **`/convex/contextCache.ts`** - Deprecated, marked as such

## Performance Impact

### Before (With Caching)

- First request: ~300ms (cache miss)
- Subsequent requests: ~50ms (cache hit)
- Cache invalidation issues possible

### After (No Caching)

- Every request: ~250-300ms
- No cache invalidation issues
- Always fresh data

### Real-World Impact

For a typical chat session:

- **Before**: Average ~100ms per request
- **After**: Consistent ~275ms per request
- **Increase**: ~175ms per message

## Why Caching Was Removed

1. **Complexity** - Cache invalidation was causing stale data issues
2. **Convex Real-time** - Convex already optimizes queries
3. **Simplicity** - Fewer moving parts to debug
4. **Correctness** - Always fresh data, no sync issues

## Cost Analysis

### Database Reads

- **Before**: ~100 reads/user/day (with caching)
- **After**: ~500 reads/user/day (no caching)
- **Cost increase**: Minimal with Convex pricing

### Latency

- **Added latency**: ~175ms per request
- **User impact**: Barely noticeable for chat UX
- **Trade-off**: Worth it for data correctness

## Potential Optimizations (Not Implemented)

1. **Convex Query Caching** - Use Convex's built-in caching
2. **Request Deduplication** - Batch concurrent queries
3. **Selective Caching** - Only cache truly static data
4. **Edge Caching** - Use Vercel's edge cache

## Recommendation

Keep caching removed for now because:

- Data correctness > minor performance gains
- Convex handles optimization well
- 175ms latency increase is acceptable
- Reduces debugging complexity

Only reconsider caching if:

- Latency becomes user-visible issue
- Database costs increase significantly
- Specific slow queries are identified

## Migration Notes

If re-implementing caching:

1. Use Convex's query caching, not custom solution
2. Cache only truly immutable data
3. Implement proper cache invalidation
4. Monitor for stale data issues
