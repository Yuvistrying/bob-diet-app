# Testing Embeddings in Bob Diet Coach

## Quick Test Steps:

1. **Test Food Log Embedding:**
   - In the chat, type: "I had a chicken salad for lunch"
   - Confirm the food when Bob asks
   - Check Convex logs for:
     ```
     [logFood] Generating embedding for food log: <ID>
     [logFood] Embedding generated and saved successfully
     ```

2. **Test Weight Log Embedding:**
   - Type: "I weigh 75kg today, feeling good after workout"
   - Check Convex scheduled functions for `embeddings:embedWeightLogNote`

3. **Test Chat Message Embedding:**
   - Any message you send should trigger `embeddings:embedNewChatMessage`
   - Check scheduled functions tab

## Verify in Convex Dashboard:

### Data Explorer:
1. Go to `foodLogs` table
2. Find your recent entry
3. Look for `embedding` field - should have 1536 numbers

### Function Logs:
1. Go to Functions → Logs
2. Filter by function name: `embeddings`
3. You should see executions of:
   - `generateEmbedding` (the OpenAI API call)
   - `updateFoodLogEmbedding`
   - `embedNewChatMessage`

### Debugging Tips:

If you don't see embeddings:
1. Check for errors in the scheduled functions tab
2. Make sure `OPENAI_API_KEY` is set in Convex environment variables
3. Look for any error logs containing "embedding"

## Sample Log Output:

When working correctly, you'll see:
```
[Chat Stream API] Request body: { prompt: "I had a banana", ... }
[logFood] Called with: { description: "Had a banana", ... }
[logFood] Generating embedding for food log: kg7d4...
[logFood] Embedding generated and saved successfully
```

And in scheduled functions:
```
embeddings:generateEmbedding - Success (243ms)
embeddings:updateFoodLogEmbedding - Success (52ms)
```