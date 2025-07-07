# Prompt Consolidation Documentation

**Date**: January 2025  
**Change**: Removed minimal/full prompt system in favor of single consolidated prompt  
**Impact**: Simplified codebase but increased token usage for queries

## What Was Removed

### The Old System

The codebase had two prompt builders:

1. **`buildMinimalPrompt`** - Used for queries ("what did I eat?", "show progress")
   - Only included basic stats
   - No meal history, no pending confirmations
   - ~500-800 tokens

2. **`buildFullPrompt`** - Used for food logging and complex interactions
   - Full context including today's meals
   - Pending confirmations
   - Calibration insights
   - ~1500-2000 tokens

### Query Optimization Logic

```typescript
// OLD: In stream-v2/route.ts
const isQuery = intents.includes("query");
const promptBuilder =
  isQuery && !isConfirmingFood ? buildMinimalPrompt : buildFullPrompt;
```

## What We Have Now

### Single Consolidated Prompt

- Always uses `getBobSystemPrompt` with full context
- No switching based on intent
- Consistent behavior across all interactions
- ~1500-2000 tokens for ALL messages

### Removed Code

- `buildMinimalPrompt` function deleted
- `buildFullPrompt` function deleted
- Prompt selection logic removed
- Intent-based optimization removed

## Trade-offs Analysis

### Benefits of Consolidation

1. **Simpler codebase** - One prompt to maintain
2. **Consistent context** - Bob always has full information
3. **Fewer edge cases** - No prompt switching bugs
4. **Better responses** - Bob can reference meal history even in queries

### Costs of Consolidation

1. **Higher token usage** - 2-3x more tokens for simple queries
2. **Increased API costs** - Every message is now "expensive"
3. **Potential latency** - More tokens to process
4. **Lost optimization** - No smart routing based on intent

## Cost Impact

Assuming typical usage patterns:

- **Before**: Mixed usage averaged ~1000 tokens/message
- **Now**: Flat ~1700 tokens/message
- **Increase**: ~70% more tokens overall

For a user with 50 messages/day:

- **Before**: ~50,000 tokens/day
- **Now**: ~85,000 tokens/day
- **Cost increase**: ~$0.70/day with Claude Sonnet pricing

## Alternative Approaches (Not Implemented)

1. **Smart caching** - Cache the prompt template, only update dynamic parts
2. **Graduated context** - Start minimal, add context if needed
3. **Tool-based routing** - Let tools fetch their own context
4. **Prompt compression** - Use shorter variable names, remove examples

## Recommendation

The consolidation was the right choice for now because:

- Code simplicity > minor cost savings
- Consistent UX > token optimization
- Easy to maintain > complex routing logic

However, if costs become significant, consider implementing smart caching or graduated context as a middle ground.
