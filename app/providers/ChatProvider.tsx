"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
} from "react";
import { useStreamingChat } from "~/app/hooks/useStreamingChat";
import { logger } from "~/app/utils/logger";

interface ChatMessage {
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
}

interface ChatContextType {
  messages: ChatMessage[];
  isStreaming: boolean;
  threadId: string | null;
  sendMessage: (
    prompt: string,
    currentThreadId?: string,
    storageId?: string,
  ) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  updateMessage: (index: number, updates: Partial<ChatMessage>) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setOnCompleteCallback: (
    callback: ((threadId: string) => void) | null,
  ) => void;
  // Confirmation bubble state
  confirmedFoodLogs: Set<string>;
  setConfirmedFoodLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  rejectedFoodLogs: Set<string>;
  setRejectedFoodLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Store callbacks that can be set by individual pages
  const onCompleteCallbackRef = useRef<((threadId: string) => void) | null>(
    null,
  );

  // Confirmation bubble state that persists across tab switches
  // Now initialized empty - will be populated from Convex
  const [confirmedFoodLogs, setConfirmedFoodLogs] = useState<Set<string>>(
    new Set(),
  );
  const [rejectedFoodLogs, setRejectedFoodLogs] = useState<Set<string>>(
    new Set(),
  );

  // This state will persist across tab switches
  const streamingChat = useStreamingChat({
    onComplete: async (newThreadId) => {
      logger.info("[ChatProvider] Thread completed:", newThreadId);
      if (onCompleteCallbackRef.current) {
        onCompleteCallbackRef.current(newThreadId);
      }
    },
    onToolCall: (toolCall) => {
      logger.info("[ChatProvider] Tool called:", toolCall);
    },
  });

  const setOnCompleteCallback = useCallback(
    (callback: ((threadId: string) => void) | null) => {
      onCompleteCallbackRef.current = callback;
    },
    [],
  );

  return (
    <ChatContext.Provider
      value={{
        ...streamingChat,
        setOnCompleteCallback,
        // Confirmation bubble state
        confirmedFoodLogs,
        setConfirmedFoodLogs,
        rejectedFoodLogs,
        setRejectedFoodLogs,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
