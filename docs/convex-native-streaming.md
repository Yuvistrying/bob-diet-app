# Native Convex Agent Streaming Implementation

This implementation uses the official Convex Agent streaming features from `@convex-dev/agent`, providing a more integrated and efficient streaming experience.

## Architecture

### 1. Server-side Query with `syncStreams`

**File: `/convex/streaming.ts`**

```typescript
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, { threadId, paginationOpts, streamArgs }) => {
    const paginated = await bobAgent.listMessages(ctx, {
      threadId,
      paginationOpts,
    });
    const streams = await bobAgent.syncStreams(ctx, { threadId, streamArgs });
    return { ...paginated, streams };
  },
});
```

Key features:

- `syncStreams` syncs real-time streaming deltas with the thread
- `vStreamArgs` validator handles streaming configuration
- Returns both paginated messages and streaming data

### 2. Asynchronous Message Generation

```typescript
export const streamStoryAsynchronously = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { prompt, threadId, storageId }) => {
    // Save user message
    const { messageId } = await bobAgent.saveMessage(ctx, {
      threadId,
      userId,
      message: { role: "user", content: messageContent },
    });

    // Schedule async generation
    await ctx.scheduler.runAfter(
      0,
      internal.streaming.generateStreamingResponse,
      {
        threadId,
        promptMessageId: messageId,
        userId,
        storageId,
      },
    );
  },
});
```

This pattern:

- Saves the user message immediately for optimistic UI updates
- Schedules asynchronous generation in the background
- Supports image uploads via `storageId`

### 3. React Hook with Native Streaming

**File: `/app/hooks/useConvexStreamingChat.tsx`**

```typescript
import {
  useThreadMessages,
  toUIMessages,
  optimisticallySendMessage,
} from "@convex-dev/agent/react";

export function useConvexStreamingChat(options) {
  const threadMessages = useThreadMessages(
    api.streaming.listThreadMessages,
    threadId ? { threadId } : null,
    { initialNumItems: 10, stream: true },
  );

  const messages = threadMessages?.results
    ? toUIMessages(threadMessages.results)
    : [];

  const sendMessageMutation = useMutation(
    api.streaming.streamStoryAsynchronously,
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.streaming.listThreadMessages),
  );
}
```

Key features:

- `useThreadMessages` - Native hook for streaming messages
- `toUIMessages` - Converts messages to UI-friendly format
- `optimisticallySendMessage` - Immediate UI feedback
- `stream: true` - Enables real-time streaming

### 4. Smooth Text Rendering

```typescript
import { useSmoothText } from "@convex-dev/agent/react";

function StreamingMessage({ content, isStreaming }) {
  const [visibleText] = useSmoothText(content);

  return (
    <div className="relative">
      <MarkdownMessage content={visibleText} />
      {isStreaming && content !== visibleText && (
        <span className="inline-block w-1 h-4 bg-gray-400 animate-pulse ml-1" />
      )}
    </div>
  );
}
```

## Benefits Over Custom SSE Implementation

1. **Integrated with Convex Agent**: Direct support for agent features like tools, context, and history
2. **Optimistic Updates**: Built-in support for immediate UI feedback
3. **Smooth Text Animation**: Native hook for progressive text display
4. **Simplified State Management**: Handles streaming state automatically
5. **Better Error Handling**: Integrated error recovery and retry logic
6. **Real-time Sync**: Uses Convex's real-time sync infrastructure

## Usage

### Basic Chat Implementation

```typescript
const { messages, isStreaming, threadId, sendMessage, stopStreaming } =
  useConvexStreamingChat({
    onComplete: (threadId) => {
      console.log("Message complete", threadId);
    },
  });

// Send a message
await sendMessage("I had a banana for breakfast", threadId);
```

### With Tool Calls

The streaming implementation maintains full support for Bob's tools:

```typescript
{messages.map((message) => {
  if (message.toolCalls?.find(tc => tc.toolName === "confirmFood")) {
    return <FoodConfirmationCard {...message} />;
  }
  return <StreamingMessage {...message} />;
})}
```

## Demo

Access the native streaming demo at: `/chat/native-streaming`

## Migration from Custom SSE

To migrate from the custom SSE implementation:

1. Replace `useStreamingChat` with `useConvexStreamingChat`
2. Update message rendering to use `toUIMessages`
3. Use `optimisticallySendMessage` for mutations
4. Replace custom streaming logic with native hooks

## Future Enhancements

When Convex Agent fully supports token-by-token streaming:

- The `generateText` call will stream tokens progressively
- `syncStreams` will provide real-time token deltas
- No changes needed to the React implementation

## Performance

- **Lower latency**: Direct Convex real-time sync vs HTTP SSE
- **Better reliability**: Automatic reconnection and state sync
- **Reduced complexity**: Less custom code to maintain
- **Efficient updates**: Only syncs deltas, not full messages
