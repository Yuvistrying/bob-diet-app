# Testing Plan: Vercel-Only vs Current System

## Setup for Side-by-Side Testing

### 1. Create Test Toggle in Chat UI

```typescript
// In app/(app)/chat/page.tsx
const USE_NEW_STREAMING = localStorage.getItem("useNewStreaming") === "true";

const endpoint = USE_NEW_STREAMING ? "/api/chat/stream-v2" : "/api/chat/stream";
```

### 2. Test Cases with Expected Results

## Test 1: Basic Food Logging

```
User: "I had a chicken salad for lunch"
Expected:
- ✅ Shows confirmation bubble
- ✅ Saves pending confirmation in DB
- ✅ Generates embedding for the food
- ✅ Food appears in vector search later
```

## Test 2: Confirmation Memory

```
User: "I had a banana"
Bob: [Shows confirmation]
User: "yes"
Expected:
- ✅ Bob logs the food immediately
- ✅ Marks pending confirmation as complete
- ✅ Shows "Logged! X calories left"
```

## Test 3: Photo Analysis with Embeddings

```
User: [uploads pizza photo]
Expected:
- ✅ Analyzes photo
- ✅ Shows confirmation
- ✅ Saves photo analysis with embedding
- ✅ Photo searchable later
```

## Test 4: Vector Search

```
User: "what similar meals have I had before?"
Expected:
- ✅ Uses vector search
- ✅ Returns semantically similar meals
- ✅ Not just keyword matching
```

## Test 5: Weight Tracking

```
User: "I weigh 180 lbs today"
Expected:
- ✅ Logs weight
- ✅ Updates cache
- ✅ Shows in progress
```

## Test 6: Context Persistence

```
Conversation 1:
User: "I don't like mushrooms"
Bob: "Got it..."

Conversation 2:
User: "what don't I like?"
Expected:
- ✅ Bob remembers mushrooms
- ✅ Thread context preserved
```

## Test 7: Caching Performance

```
User: "how am I doing?"
Expected:
- ✅ First call: ~2s (cache miss)
- ✅ Second call: <500ms (cache hit)
- ✅ Stats accurate
```

## Test 8: Similar Photo Search

```
After logging pizza photo:
User: [uploads another pizza photo]
Expected:
- ✅ "Based on 3 similar meals, likely ~X calories"
- ✅ Confidence boosted by history
```

## Verification Queries

### Check Embeddings Are Saved:

```javascript
// In Convex dashboard
db.foodLogs.filter((log) => log.embedding !== undefined).count();
// Should increase with each food log
```

### Check Vector Search Works:

```javascript
// Test in Convex functions
const results = await vectorSearch.searchSimilarMeals({
  searchText: "pizza",
  limit: 5,
});
// Should return pizza-related meals
```

### Check Pending Confirmations:

```javascript
db.pendingConfirmations.filter((c) => c.status === "pending");
// Should show current confirmations
```

### Check Cache Performance:

```javascript
db.contextCache.filter((c) => c.userId === "user_xxx");
// Should show cached entries with TTL
```

## Performance Comparison

| Metric               | Current (Agent) | New (Vercel-Only) |
| -------------------- | --------------- | ----------------- |
| Initial Response     | ~2s             | ~1.5s             |
| Tool Execution       | Same            | Same              |
| Embedding Generation | ✅              | ✅                |
| Vector Search        | ✅              | ✅                |
| Cache Hit Rate       | 85%             | 85%               |
| Memory Usage         | Higher          | Lower             |

## Migration Validation

1. **Before Migration**: Run all tests on current system
2. **Enable New System**: Toggle to stream-v2
3. **Run Same Tests**: Verify identical behavior
4. **Check Database**: Ensure all data saved correctly
5. **Monitor Performance**: Should be same or better

## Rollback Plan

If any test fails:

1. Toggle back to original endpoint
2. No data loss (same database)
3. Investigate specific failure
4. Fix and retry

## Success Criteria

- ✅ All 8 test cases pass identically
- ✅ Embeddings generated for all logs
- ✅ Vector search returns same results
- ✅ Performance same or better
- ✅ No errors in console
- ✅ Database integrity maintained
