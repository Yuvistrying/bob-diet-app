# Migration Plan: Vercel AI SDK Only Architecture

## ⚠️ CRITICAL: Preserving All Functionality

This migration will preserve 100% of Bob's current capabilities while simplifying the architecture.

## Current Functionality to Preserve

### 1. **Bob's Brain & Intelligence**

- ✅ All prompts and personality
- ✅ Context awareness and memory
- ✅ Conversation patterns
- ✅ Food estimation logic
- ✅ Calibration system (schema exists)
- ✅ Weight tracking and averages

### 2. **Core Features**

- ✅ Food logging with confirmation flow
- ✅ Photo analysis with embeddings
- ✅ Weight tracking with trends
- ✅ Progress tracking
- ✅ Similar meal search
- ✅ Stealth mode
- ✅ Daily thread management
- ✅ Pending confirmations

### 3. **Data & Schema**

- ✅ ALL database tables remain unchanged
- ✅ Context caching strategy
- ✅ Embeddings for semantic search
- ✅ Usage tracking
- ✅ Conversation summaries
- ✅ Calibration history

### 4. **Advanced Features**

- ✅ 5-minute cache for core stats
- ✅ 30-day cache for preferences
- ✅ Thread-based conversations
- ✅ Vector search for similar meals
- ✅ Photo analysis with confidence scoring

## What Changes (Architecture Only)

### Before:

```
User → Streaming Route → Vercel AI SDK
  ↓         ↓              ↓
  └→ Convex Agent ←────────┘
        (backup)
```

### After:

```
User → Streaming Route → Vercel AI SDK
             ↓
      Direct Convex DB
```

## Migration Steps (Preserving Everything)

### Phase 1: Create Parallel System

1. Keep ALL existing code running
2. Create new simplified endpoints alongside
3. Test extensively to ensure feature parity

### Phase 2: Migrate Components

1. **Thread Management** - Use new threads.ts (already created)
2. **Message Storage** - Direct to chatHistory table
3. **Context Building** - Keep exact same logic
4. **Tools** - Keep all 6 tools identical
5. **Caching** - Keep all cache strategies

### Phase 3: Testing Checklist

- [ ] Food logging with confirmations
- [ ] Photo analysis with embeddings
- [ ] Weight tracking and trends
- [ ] Progress summaries
- [ ] Similar meal search
- [ ] Stealth mode switching
- [ ] Context persistence
- [ ] Calibration (when implemented)
- [ ] All prompts work correctly

## Code to Keep Unchanged

1. **Schema** - `/convex/schema.ts` - NO CHANGES
2. **Food Logs** - `/convex/foodLogs.ts` - NO CHANGES
3. **Weight Logs** - `/convex/weightLogs.ts` - NO CHANGES
4. **Embeddings** - `/convex/embeddings.ts` - NO CHANGES
5. **Vector Search** - `/convex/vectorSearch.ts` - NO CHANGES
6. **Photo Analysis** - `/convex/vision.ts` - NO CHANGES
7. **Context Cache** - `/convex/contextCache.ts` - NO CHANGES
8. **Calibration** - Keep for future use

## New Simplified Flow

```typescript
// Single entry point for all chat
export async function handleChat(prompt: string, threadId?: string) {
  // 1. Get/create thread (same as before)
  const thread = await getOrCreateDailyThread();

  // 2. Build context (exact same queries)
  const context = await buildContext(thread.threadId);

  // 3. Get Bob's prompt (centralized)
  const systemPrompt = getBobSystemPrompt(context);

  // 4. Stream response with tools
  const response = await streamText({
    model: anthropic('claude-sonnet-4'),
    system: systemPrompt,
    messages: [...],
    tools: {
      confirmFood,  // Same tool
      logFood,      // Same tool
      analyzePhoto, // Same tool
      logWeight,    // Same tool
      showProgress, // Same tool
      findSimilarMeals // Same tool
    }
  });

  // 5. Save to database (same tables)
  await saveMessage({ threadId, ... });
}
```

## Benefits of Migration

1. **Simpler to Debug** - One code path instead of two
2. **Easier Maintenance** - Single prompt location
3. **Better Performance** - No duplicate operations
4. **Same Features** - 100% functionality preserved
5. **Future Ready** - Easier to add calibration, etc.

## Risk Mitigation

1. **Keep old code** - Don't delete anything until fully tested
2. **Feature flags** - Can switch between old/new
3. **Gradual rollout** - Test with your account first
4. **Rollback plan** - Can revert instantly

## Timeline

- Phase 1: 2 hours (parallel system)
- Phase 2: 3 hours (migration)
- Phase 3: 2 hours (testing)
- Buffer: 3 hours (fixes)

Total: ~1 day of careful work

## Summary

This migration is purely architectural cleanup. Bob's brain, features, and data remain 100% intact. We're just removing the redundant Convex Agent layer that's barely used, while keeping all the smart features you've built.
