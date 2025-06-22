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
      assistantIndex = newMessages.length - 1; // Assistant is the last message
      return newMessages;
    });

    try {
      const token = await getToken();
      console.log("[useStreamingChat] Sending request to /api/chat/stream-v2");
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
      console.log("[useStreamingChat] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[useStreamingChat] Error response:", errorText);
        throw new Error(`Chat error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      const toolCalls: any[] = [];
      let currentToolCallId = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[useStreamingChat] Stream done");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log("[useStreamingChat] Raw chunk:", chunk);
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === '') continue;
          console.log("[useStreamingChat] Processing line:", trimmedLine);
          
          // Parse Vercel AI SDK data stream format
          // Format: "0:{"type":"text-delta","textDelta":"Hello"}\n"
          const colonIndex = trimmedLine.indexOf(':');
          if (colonIndex === -1) continue;
          
          const eventType = trimmedLine.substring(0, colonIndex);
          const jsonData = trimmedLine.substring(colonIndex + 1);
          
          try {
            // Special handling for simple string responses
            if (jsonData.startsWith('"') && jsonData.endsWith('"')) {
              const text = JSON.parse(jsonData);
              console.log("[useStreamingChat] String event:", eventType, "text:", text);
              
              if (eventType === '0') {
                accumulatedText += text;
                setMessages(prev => prev.map((msg, idx) => 
                  idx === assistantIndex! 
                    ? { ...msg, content: accumulatedText }
                    : msg
                ));
              } else if (eventType === '3') {
                // Error event
                console.error("[useStreamingChat] Error from stream:", text);
                throw new Error(text);
              }
              continue;
            }
            
            const data = JSON.parse(jsonData);
            console.log("[useStreamingChat] Parsed event:", eventType, "data:", data);
            
            // Handle different event types from Vercel AI SDK
            switch (eventType) {
              case '0': // Text delta
                if (data.type === 'text-delta' && data.textDelta) {
                  accumulatedText += data.textDelta;
                  setMessages(prev => prev.map((msg, idx) => 
                    idx === assistantIndex! 
                      ? { ...msg, content: accumulatedText }
                      : msg
                  ));
                }
                break;
                
              case '2': // Tool call
                if (data.type === 'tool-call') {
                  const toolCall = {
                    toolCallId: data.toolCallId || `tool-${currentToolCallId++}`,
                    toolName: data.toolName,
                    args: data.args
                  };
                  toolCalls.push(toolCall);
                  if (options.onToolCall) {
                    options.onToolCall(toolCall);
                  }
                }
                break;
                
              case '9': // Tool call (Vercel AI SDK format)
                // Handle tool calls with direct properties
                if (data.toolCallId && data.toolName && data.args) {
                  const toolCall = {
                    toolCallId: data.toolCallId,
                    toolName: data.toolName,
                    args: data.args
                  };
                  toolCalls.push(toolCall);
                  if (options.onToolCall) {
                    options.onToolCall(toolCall);
                  }
                }
                break;
                
              case 'a': // Tool result (Vercel AI SDK format)
                if (data.toolCallId && data.result) {
                  // Update the tool call with its result
                  const toolCallIndex = toolCalls.findIndex(tc => tc.toolCallId === data.toolCallId);
                  if (toolCallIndex !== -1) {
                    toolCalls[toolCallIndex].result = data.result;
                  }
                }
                break;
                
              case 'd': // Finish message
                if (data.type === 'finish') {
                  setMessages(prev => prev.map((msg, idx) => 
                    idx === assistantIndex! 
                      ? { 
                          ...msg, 
                          isStreaming: false,
                          toolCalls: toolCalls.length > 0 ? toolCalls : undefined 
                        }
                      : msg
                  ));
                  
                  // Use the current threadId or generate one
                  const finalThreadId = currentThreadId || threadId || `thread_${Date.now()}`;
                  if (finalThreadId !== threadId) {
                    setThreadId(finalThreadId);
                    if (options.onComplete) {
                      options.onComplete(finalThreadId);
                    }
                  }
                  setIsStreaming(false);
                  return;
                }
                break;
                
              case '3': // Error (alternative format)
                console.error("[useStreamingChat] Error event type 3:", data);
                throw new Error(typeof data === 'string' ? data : data.error || 'Stream error');
                
              case 'e': // Error
                if (data.type === 'error') {
                  console.error("[useStreamingChat] Error event type e:", data);
                  throw new Error(data.error || 'Stream error');
                }
                break;
            }
          } catch (e) {
            console.error('[useStreamingChat] Failed to parse stream data:', {
              error: e,
              line: trimmedLine,
              eventType,
              jsonData
            });
          }
        }
      }
      
      // If we exit the loop without a finish event, mark as complete
      console.log("[useStreamingChat] Stream ended, finalizing message");
      setMessages(prev => prev.map((msg, idx) => 
        idx === assistantIndex! 
          ? { 
              ...msg, 
              content: accumulatedText || "Hey! How can I help you today?",
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
      console.error('[useStreamingChat] Streaming error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
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
  }, [getToken, messages.length, threadId, options]);

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