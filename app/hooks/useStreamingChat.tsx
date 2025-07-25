import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { logger } from "~/app/utils/logger";

interface StreamingMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  imageUrl?: string;
  storageId?: string;
  isStreaming?: boolean;
  activeToolCall?: {
    name: string;
    status: "calling" | "complete";
  };
  confirmationIds?: Record<string, string>;
  confirmationMetadata?: Record<string, any>;
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

  const sendMessage = useCallback(
    async (prompt: string, currentThreadId?: string, storageId?: string) => {
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
        storageId,
      };

      // Initialize assistant message
      const assistantMessage: StreamingMessage = {
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      // Add both messages at once
      let assistantIndex: number;
      setMessages((prev) => {
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
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt,
            threadId: currentThreadId || threadId,
            storageId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorText = "Unknown error";
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

        let accumulatedText = "";
        const toolCalls: any[] = [];

        // Parse SSE stream for letter-by-letter updates
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === "") continue;

            // Parse SSE format: "TYPE:DATA"
            if (line.startsWith("0:")) {
              // Text delta (type 0)
              try {
                const content = JSON.parse(line.slice(2));
                accumulatedText += content;

                // Update UI immediately for now - we'll implement a better debouncing solution
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === assistantIndex!
                      ? { ...msg, content: accumulatedText }
                      : msg,
                  ),
                );
              } catch (e) {
                logger.error("Failed to parse text delta:", e);
              }
            } else if (line.startsWith("1:")) {
              // Tool call start (type 1)
              try {
                const toolCallData = JSON.parse(line.slice(2));

                logger.info("[useStreamingChat] Received tool call (type 1):", {
                  toolName: toolCallData.toolName,
                  hasArgs: !!toolCallData.args,
                  argsKeys: toolCallData.args
                    ? Object.keys(toolCallData.args)
                    : [],
                });

                // Show tool is being called
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === assistantIndex!
                      ? {
                          ...msg,
                          activeToolCall: {
                            name: toolCallData.toolName,
                            status: "calling",
                          },
                        }
                      : msg,
                  ),
                );

                toolCalls.push({
                  toolCallId: toolCallData.toolCallId,
                  toolName: toolCallData.toolName,
                  args: toolCallData.args,
                });

                if (options.onToolCall) {
                  options.onToolCall(toolCallData);
                }
              } catch (e) {
                logger.error("Failed to parse tool call:", e);
              }
            } else if (line.startsWith("2:")) {
              // Tool result (type 2)
              try {
                const toolResult = JSON.parse(line.slice(2));

                logger.info(
                  "[useStreamingChat] Received tool result (type 2):",
                  {
                    toolCallId: toolResult.toolCallId,
                    hasResult: !!toolResult.result,
                    resultKeys: toolResult.result
                      ? Object.keys(toolResult.result)
                      : [],
                  },
                );

                // Find the matching tool call and merge the result into its args
                const toolCallIndex = toolCalls.findIndex(
                  (tc) => tc.toolCallId === toolResult.toolCallId,
                );
                if (toolCallIndex !== -1) {
                  const toolCall = toolCalls[toolCallIndex];

                  // For confirmFood and analyzeAndConfirmPhoto, merge the result into args
                  if (
                    (toolCall.toolName === "confirmFood" ||
                      toolCall.toolName === "analyzeAndConfirmPhoto") &&
                    toolResult.result
                  ) {
                    logger.info(
                      `[useStreamingChat] Merging ${toolCall.toolName} result into args`,
                      {
                        originalArgs: toolCall.args
                          ? Object.keys(toolCall.args)
                          : [],
                        resultKeys: Object.keys(toolResult.result),
                        hasConfirmationId: !!toolResult.result.confirmationId,
                        confirmationId: toolResult.result.confirmationId,
                      },
                    );
                    toolCalls[toolCallIndex] = {
                      ...toolCall,
                      args: {
                        ...toolCall.args,
                        ...toolResult.result,
                      },
                    };
                  }
                }

                // Mark tool as complete
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === assistantIndex! && msg.activeToolCall
                      ? {
                          ...msg,
                          activeToolCall: {
                            ...msg.activeToolCall,
                            status: "complete",
                          },
                        }
                      : msg,
                  ),
                );
              } catch (e) {
                logger.error("Failed to parse tool result:", e);
              }
            } else if (line.startsWith("3:")) {
              // Error (type 3)
              logger.error(
                "[useStreamingChat] Received error line from server:",
                line,
              );
              try {
                const errorMessage = JSON.parse(line.slice(2));
                logger.error(
                  "[useStreamingChat] Parsed error message:",
                  errorMessage,
                );
                throw new Error(errorMessage);
              } catch (e) {
                logger.error("[useStreamingChat] Failed to parse error:", e);
                logger.error("[useStreamingChat] Original line was:", line);
                throw new Error("Stream error");
              }
            } else if (line.startsWith("9:")) {
              // Tool call (type 9) - same as type 1
              try {
                const toolCallData = JSON.parse(line.slice(2));

                logger.info("[useStreamingChat] Received tool call (type 9):", {
                  toolName: toolCallData.toolName,
                  hasArgs: !!toolCallData.args,
                  argsKeys: toolCallData.args
                    ? Object.keys(toolCallData.args)
                    : [],
                });

                // Show tool is being called
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === assistantIndex!
                      ? {
                          ...msg,
                          activeToolCall: {
                            name: toolCallData.toolName,
                            status: "calling",
                          },
                        }
                      : msg,
                  ),
                );

                toolCalls.push({
                  toolCallId: toolCallData.toolCallId,
                  toolName: toolCallData.toolName,
                  args: toolCallData.args,
                });

                if (options.onToolCall) {
                  options.onToolCall(toolCallData);
                }
              } catch (e) {
                logger.error("Failed to parse tool call:", e);
              }
            } else if (line.startsWith("a:")) {
              // Tool result (type a) - same as type 2
              try {
                const toolResult = JSON.parse(line.slice(2));

                logger.info(
                  "[useStreamingChat] Received tool result (type a):",
                  {
                    toolCallId: toolResult.toolCallId,
                    hasResult: !!toolResult.result,
                    resultKeys: toolResult.result
                      ? Object.keys(toolResult.result)
                      : [],
                  },
                );

                // Find the matching tool call and merge the result into its args
                const toolCallIndex = toolCalls.findIndex(
                  (tc) => tc.toolCallId === toolResult.toolCallId,
                );
                if (toolCallIndex !== -1) {
                  const toolCall = toolCalls[toolCallIndex];

                  // For confirmFood and analyzeAndConfirmPhoto, merge the result into args
                  if (
                    (toolCall.toolName === "confirmFood" ||
                      toolCall.toolName === "analyzeAndConfirmPhoto") &&
                    toolResult.result
                  ) {
                    logger.info(
                      `[useStreamingChat] Merging ${toolCall.toolName} result into args`,
                      {
                        originalArgs: toolCall.args
                          ? Object.keys(toolCall.args)
                          : [],
                        resultKeys: Object.keys(toolResult.result),
                        hasConfirmationId: !!toolResult.result.confirmationId,
                        confirmationId: toolResult.result.confirmationId,
                      },
                    );
                    toolCalls[toolCallIndex] = {
                      ...toolCall,
                      args: {
                        ...toolCall.args,
                        ...toolResult.result,
                      },
                    };
                  }
                }

                // Mark tool as complete
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === assistantIndex! && msg.activeToolCall
                      ? {
                          ...msg,
                          activeToolCall: {
                            ...msg.activeToolCall,
                            status: "complete",
                          },
                        }
                      : msg,
                  ),
                );
              } catch (e) {
                logger.error("Failed to parse tool result:", e);
              }
            } else if (line.startsWith("f:")) {
              // Metadata/frame info (type f) - contains messageId
              // We can safely ignore this for now
            } else if (line.startsWith("e:")) {
              // End event (type e) - contains finish reason and usage stats
              // We can safely ignore this for now
            } else if (line.startsWith("d:")) {
              // Done event (type d) - final usage stats
              // We can safely ignore this for now
            } else {
              // Only log truly unknown types
              logger.warn(
                "[useStreamingChat] Unknown SSE line type:",
                line.substring(0, 2),
              );
            }
          }
        }

        // Mark as complete
        logger.info("[useStreamingChat] Completing message with toolCalls:", {
          toolCallCount: toolCalls.length,
          toolNames: toolCalls.map((tc) => tc.toolName),
        });

        setMessages((prev) =>
          prev.map((msg, idx) =>
            idx === assistantIndex!
              ? {
                  ...msg,
                  content: accumulatedText || "", // Don't default to greeting
                  isStreaming: false,
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                }
              : msg,
          ),
        );

        // Force a re-render on mobile devices to ensure confirmation bubbles appear
        if (
          toolCalls.length > 0 &&
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          setTimeout(() => {
            setMessages((prev) => [...prev]);
          }, 100);
        }

        const finalThreadId =
          currentThreadId || threadId || `thread_${Date.now()}`;
        if (finalThreadId !== threadId) {
          setThreadId(finalThreadId);
          if (options.onComplete) {
            options.onComplete(finalThreadId);
          }
        }
      } catch (error: any) {
        // Handle AbortError silently - it's expected when cancelling previous requests
        if (error.name === "AbortError") {
          logger.debug(
            "[useStreamingChat] Request aborted (expected behavior)",
          );
          // Keep partial content on abort
          setMessages((prev) =>
            prev.map((msg, idx) =>
              idx === assistantIndex! ? { ...msg, isStreaming: false } : msg,
            ),
          );
        } else {
          // Log real errors
          logger.error("[useStreamingChat] Error:", error);

          // Update assistant message with error
          setMessages((prev) =>
            prev.map((msg, idx) =>
              idx === assistantIndex!
                ? {
                    ...msg,
                    content: "Sorry, I encountered an error. Please try again.",
                    isStreaming: false,
                  }
                : msg,
            ),
          );

          if (options.onError) {
            options.onError(error);
          }
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [getToken, threadId, options],
  );

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

  const updateMessage = useCallback(
    (index: number, updates: Partial<StreamingMessage>) => {
      setMessages((prev) =>
        prev.map((msg, idx) => (idx === index ? { ...msg, ...updates } : msg)),
      );
    },
    [],
  );

  return {
    messages,
    isStreaming,
    threadId,
    sendMessage,
    stopStreaming,
    clearMessages,
    updateMessage,
    setMessages,
    setThreadId,
  };
}
