import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { useThreadMessages, toUIMessages, optimisticallySendMessage } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface UseConvexStreamingChatOptions {
  onToolCall?: (toolCall: any) => void;
  onComplete?: (threadId: string) => void;
  onError?: (error: Error) => void;
  initialThreadId?: string;
}

export function useConvexStreamingChat(options: UseConvexStreamingChatOptions = {}) {
  const [threadId, setThreadId] = useState<string | null>(options.initialThreadId || null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use native Convex Agent streaming hook
  const threadMessages = useThreadMessages(
    api.streaming.listThreadMessages,
    threadId ? { threadId } : null,
    { initialNumItems: 10, stream: true }
  );

  // Convert to UI messages format
  const messages = threadMessages?.results ? toUIMessages(threadMessages.results) : [];

  // Mutation for sending messages with optimistic updates
  const sendMessageMutation = useMutation(api.streaming.streamStoryAsynchronously)
    .withOptimisticUpdate(optimisticallySendMessage(api.streaming.listThreadMessages));

  const sendMessage = useCallback(async (
    prompt: string,
    currentThreadId?: string,
    storageId?: Id<"_storage">
  ) => {
    // Cancel any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsStreaming(true);

    try {
      // Use existing thread or create new one
      const activeThreadId = currentThreadId || threadId;
      
      if (!activeThreadId) {
        // Need to create a thread first
        // For now, we'll handle this in the mutation
        throw new Error("Thread ID required for streaming");
      }

      // Send message with optimistic update
      const result = await sendMessageMutation({
        prompt,
        threadId: activeThreadId,
      });

      // Update thread ID if needed
      if (!threadId && result.threadId) {
        setThreadId(result.threadId);
      }

      // Handle completion
      if (options.onComplete) {
        options.onComplete(result.threadId);
      }

      // Check for tool calls in the latest message
      const latestMessages = threadMessages?.results?.slice(-2) || [];
      for (const msg of latestMessages) {
        if ('toolCalls' in msg && msg.toolCalls && options.onToolCall) {
          for (const toolCall of msg.toolCalls) {
            options.onToolCall(toolCall);
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      
      if (error.name !== 'AbortError' && options.onError) {
        options.onError(error);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [threadId, sendMessageMutation, threadMessages, options]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setThreadId(null);
  }, []);

  // Check if any message is currently streaming
  useEffect(() => {
    const hasStreamingMessage = messages.some(msg => 
      msg.role === 'assistant' && msg.isStreaming
    );
    setIsStreaming(hasStreamingMessage);
  }, [messages]);

  return {
    messages,
    isStreaming,
    threadId,
    sendMessage,
    stopStreaming,
    clearMessages,
    setThreadId
  };
}