import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

interface StreamingMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  imageUrl?: string;
  storageId?: string;
  isStreaming?: boolean;
}

interface UseStreamingChatOptions {
  onToolCall?: (toolCall: any) => void;
  onComplete?: (threadId: string) => void;
  onError?: (error: Error) => void;
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    prompt: string,
    currentThreadId?: string,
    storageId?: string
  ) => {
    // Cancel any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsStreaming(true);

    // Add user message
    const userMessage: StreamingMessage = {
      role: "user",
      content: prompt,
      storageId
    };
    
    // Initialize assistant message
    const assistantMessage: StreamingMessage = {
      role: "assistant",
      content: "",
      isStreaming: true
    };
    
    // Add both messages at once
    let assistantIndex: number;
    setMessages(prev => {
      const newMessages = [...prev, userMessage, assistantMessage];
      assistantIndex = newMessages.length - 1;
      return newMessages;
    });

    try {
      const token = await getToken();
      const response = await fetch("/api/chat/stream-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt,
          threadId: currentThreadId || threadId,
          storageId
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
        } catch (e) {
          // Response already consumed or other error
        }
        throw new Error(`Chat error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      let accumulatedText = '';
      const toolCalls: any[] = [];

      // Parse SSE stream for letter-by-letter updates
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          // Parse SSE format: "TYPE:DATA"
          if (line.startsWith('0:')) {
            // Text delta (type 0)
            try {
              const content = JSON.parse(line.slice(2));
              accumulatedText += content;
              
              // Update UI with animated chunks
              setMessages(prev => prev.map((msg, idx) => 
                idx === assistantIndex! 
                  ? { ...msg, content: accumulatedText }
                  : msg
              ));
            } catch (e) {
              console.error('Failed to parse text delta:', e);
            }
          } else if (line.startsWith('9:')) {
            // Tool call (type 9)
            try {
              const toolCallData = JSON.parse(line.slice(2));
              const toolCall = {
                toolCallId: toolCallData.toolCallId,
                toolName: toolCallData.toolName,
                args: toolCallData.args
              };
              toolCalls.push(toolCall);
              if (options.onToolCall) {
                options.onToolCall(toolCall);
              }
            } catch (e) {
              console.error('Failed to parse tool call:', e);
            }
          } else if (line.startsWith('3:')) {
            // Error (type 3)
            try {
              const errorMessage = JSON.parse(line.slice(2));
              console.error('[useStreamingChat] Received error from server:', errorMessage);
              throw new Error(errorMessage);
            } catch (e) {
              console.error('[useStreamingChat] Failed to parse error:', line, e);
              throw new Error('Stream error');
            }
          } else {
            console.log('[useStreamingChat] Unknown SSE line type:', line);
          }
        }
      }
      
      // Mark as complete
      setMessages(prev => prev.map((msg, idx) => 
        idx === assistantIndex! 
          ? { 
              ...msg, 
              content: accumulatedText || "",  // Don't default to greeting
              isStreaming: false,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined 
            }
          : msg
      ));
      
      const finalThreadId = currentThreadId || threadId || `thread_${Date.now()}`;
      if (finalThreadId !== threadId) {
        setThreadId(finalThreadId);
        if (options.onComplete) {
          options.onComplete(finalThreadId);
        }
      }
    } catch (error: any) {
      console.error("[useStreamingChat] Error:", error);
      
      // Update assistant message with error
      setMessages(prev => prev.map((msg, idx) => 
        idx === assistantIndex! 
          ? { 
              ...msg, 
              content: error.name === 'AbortError' 
                ? msg.content // Keep partial content on abort
                : "Sorry, I encountered an error. Please try again.",
              isStreaming: false 
            }
          : msg
      ));
      
      if (error.name !== 'AbortError' && options.onError) {
        options.onError(error);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [getToken, threadId, options]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  const updateMessage = useCallback((index: number, updates: Partial<StreamingMessage>) => {
    setMessages(prev => prev.map((msg, idx) => 
      idx === index ? { ...msg, ...updates } : msg
    ));
  }, []);

  return {
    messages,
    isStreaming,
    threadId,
    sendMessage,
    stopStreaming,
    clearMessages,
    updateMessage,
    setMessages,
    setThreadId
  };
}