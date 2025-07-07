# Tool Calls Persistence Fix Documentation

## Problem Description

Confirmation bubbles for food logging were disappearing when users switched tabs. The bubbles would appear initially when a photo was analyzed, but would vanish upon returning to the chat tab.

## Root Cause Analysis

### Issue 1: Tool Calls Not Saved to Database

- Tool calls were being processed during streaming but not persisted to the database
- Messages were only saved if they had text content: `if (text && text.trim().length > 0)`
- Tool-only responses (like analyzeAndConfirmPhoto) were being ignored

### Issue 2: Vercel AI SDK Behavior

- The SDK's `onFinish` callback was receiving `toolCallsCount: 0` even when tools were executed
- Tool calls were being streamed as chunks (type: 'tool-call') instead of through the `onToolCall` callback
- This meant we couldn't rely on the SDK to provide tool calls in the final callback

### Issue 3: Frontend State Management

- The localStorage save effect was overwriting confirmations when messages were loaded without toolCalls
- This created a race condition where confirmed states would be cleared

## Solution Implementation

### 1. Backend: Collect Tool Calls During Streaming

```typescript
// In app/api/chat/stream-v2/route.ts
const collectedToolCalls: any[] = [];

// In onChunk callback
if (chunk.type === "tool-call") {
  const toolCallChunk = chunk as any;
  if (toolCallChunk.toolCallId && toolCallChunk.toolName) {
    collectedToolCalls.push({
      toolCallId: toolCallChunk.toolCallId,
      toolName: toolCallChunk.toolName,
      args: toolCallChunk.args || {},
    });
  }
}
```

### 2. Backend: Handle Tool Results

```typescript
// Merge tool results into args for analyzeAndConfirmPhoto
if (chunk.type === "tool-result") {
  const toolCallIndex = collectedToolCalls.findIndex(
    (tc) => tc.toolCallId === toolCallId,
  );
  if (toolCallIndex !== -1 && toolCall.toolName === "analyzeAndConfirmPhoto") {
    collectedToolCalls[toolCallIndex] = {
      ...toolCall,
      args: { ...toolCall.args, ...result },
    };
  }
}
```

### 3. Backend: Save Messages with Tool Calls

```typescript
// Use collected toolCalls if SDK doesn't provide them
const finalToolCalls =
  toolCalls && toolCalls.length > 0 ? toolCalls : collectedToolCalls;

// Save if there's text OR tool calls
if (
  (text && text.trim().length > 0) ||
  (finalToolCalls && finalToolCalls.length > 0)
) {
  await convexClient.mutation(api.threads.saveMessage, {
    threadId,
    role: "assistant",
    content: text || "",
    toolCalls: finalToolCalls || [],
    metadata: {
      /* ... */
    },
  });
}
```

### 4. Frontend: Prevent Confirmation State Overwrites

```typescript
// Only save confirmations if we have toolCalls or if preserving existing state
const hasToolCallsInMessages = messages.some(
  (msg) => msg.toolCalls && msg.toolCalls.length > 0,
);

if (
  currentConfirmations.length > 0 ||
  (confirmedFoodLogs.size > 0 && !hasToolCallsInMessages)
) {
  // Save to localStorage
} else if (
  hasToolCallsInMessages &&
  currentConfirmations.length === 0 &&
  confirmedFoodLogs.size === 0
) {
  // Only clear if we have toolCalls but no confirmations
  localStorage.removeItem("foodConfirmations");
}
```

## Debugging Tips

### Server-Side Logs to Monitor

```
[stream-v2] Tool call chunk received: { toolCallId: ..., toolName: 'analyzeAndConfirmPhoto' }
[stream-v2] Merging analyzeAndConfirmPhoto result into args
[stream-v2] Stream finished: { collectedDuringStream: 1, receivedInOnFinish: 0 }
[saveMessage] Metadata contains toolCalls: 1
```

### Client-Side Logs to Monitor

```
[useStreamingChat] Received tool call (type 9)
[useStreamingChat] Completing message with toolCalls: {toolCallCount: 1}
[getThreadMessages] Found X messages with tool calls
```

## Known Issues and Limitations

1. **Vercel AI SDK**: The `onToolCall` callback may not fire for all tool executions. Always collect from chunks as a fallback.

2. **Tool Result Merging**: Only implemented for `analyzeAndConfirmPhoto`. Other tools may need similar handling.

3. **Confirmation ID Stability**: IDs are based on food content hash, which may cause issues if identical meals are logged.

## Future Improvements

1. **Generic Tool Result Handler**: Implement a more generic way to handle tool results for all tools
2. **Better Confirmation ID Generation**: Use timestamp or unique identifiers instead of content hash
3. **Optimize Re-renders**: The confirmation bubble state changes cause multiple re-renders that could be optimized
