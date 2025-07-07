# Streaming Chat Implementation for Bob Diet Coach

## Overview

This implementation adds Server-Sent Events (SSE) streaming to Bob Diet Coach, providing real-time chat responses with a better user experience.

## Architecture

### 1. Next.js 15 App Router Streaming API

**File: `/app/api/chat/stream/route.ts`**

- Uses Edge Runtime for better streaming performance
- Implements SSE with proper headers
- Forwards requests to Convex HTTP action
- Handles authentication via Clerk

### 2. Convex HTTP Action with Streaming Support

**File: `/convex/http.ts`**

- Added `/api/agent/stream` endpoint
- Uses Convex Agent for message generation
- Currently returns complete responses (streaming support pending from Convex Agent)
- Maintains all existing functionality (onboarding, food logging, etc.)

### 3. React Hook for Streaming

**File: `/app/hooks/useStreamingChat.tsx`**

- Manages streaming state and messages
- Handles SSE parsing and message updates
- Supports abort/cancel functionality
- Provides callbacks for tool calls and completion

### 4. Updated Chat UI

**File: `/app/(app)/chat/page.tsx`**

- Integrated `useStreamingChat` hook
- Shows real-time typing indicator
- Displays streaming text with cursor animation
- Stop button during streaming

## Key Features

### Real-time Response Streaming

```typescript
// Typing indicator while waiting
<div className="flex space-x-1 p-3">
  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
</div>

// Animated cursor during text streaming
<span className="inline-block w-1 h-4 bg-gray-400 animate-pulse ml-0.5" />
```

### Stop Button

Users can stop streaming at any time:

```typescript
{isStreaming ? (
  <button onClick={stopStreaming}>
    <Square className="h-4 w-4" />
  </button>
) : (
  <button type="submit">
    <ArrowUp className="h-4 w-4" />
  </button>
)}
```

### Tool Call Support

The streaming implementation maintains full support for Bob's tools:

- `confirmFood` - Shows food confirmation cards
- `logFood` - Logs confirmed food
- `analyzePhoto` - Analyzes uploaded photos
- `showProgress` - Shows daily progress

## Usage Example

```typescript
const { messages, isStreaming, sendMessage, stopStreaming } = useStreamingChat({
  onToolCall: (toolCall) => {
    console.log("Tool called:", toolCall);
  },
  onComplete: (threadId) => {
    console.log("Message complete, thread:", threadId);
  },
});

// Send a message
await sendMessage("I had a banana for breakfast");

// Stop streaming if needed
if (isStreaming) {
  stopStreaming();
}
```

## Future Enhancements

1. **True Token Streaming**: When Convex Agent supports streaming, update the HTTP action to stream tokens as they're generated
2. **Partial Tool Calls**: Show tool calls as they're being constructed
3. **Progress Indicators**: Show progress for long-running operations like photo analysis
4. **Retry Logic**: Add automatic retry for failed streams

## Testing

1. Start the development server: `npm run dev`
2. Navigate to the chat interface
3. Send a message and observe:
   - Typing indicator appears immediately
   - Response streams in (currently as complete message)
   - Tool calls work as expected
   - Stop button appears during streaming

## Performance Considerations

- Edge Runtime reduces latency
- SSE keeps connection alive for real-time updates
- AbortController prevents memory leaks
- Minimal re-renders with optimized state updates
