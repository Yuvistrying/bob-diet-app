"use client";

import React, { createContext, useContext, useRef, useCallback, useState } from "react";
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
    status: 'calling' | 'complete';
  };
}

interface ChatContextType {
  messages: ChatMessage[];
  isStreaming: boolean;
  threadId: string | null;
  sendMessage: (prompt: string, currentThreadId?: string, storageId?: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  updateMessage: (index: number, updates: Partial<ChatMessage>) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setOnCompleteCallback: (callback: ((threadId: string) => void) | null) => void;
  // Confirmation bubble state
  confirmedFoodLogs: Set<string>;
  setConfirmedFoodLogs: React.Dispatch<React.SetStateAction<Set<string>>>;
  editedFoodItems: Map<string, any>;
  setEditedFoodItems: React.Dispatch<React.SetStateAction<Map<string, any>>>;
  editingFoodLog: string | null;
  setEditingFoodLog: React.Dispatch<React.SetStateAction<string | null>>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Store callbacks that can be set by individual pages
  const onCompleteCallbackRef = useRef<((threadId: string) => void) | null>(null);
  
  // Confirmation bubble state that persists across tab switches
  const [confirmedFoodLogs, setConfirmedFoodLogs] = useState<Set<string>>(() => {
    // Initialize from localStorage on mount
    if (typeof window !== 'undefined') {
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date === today && parsed.confirmed && parsed.confirmed.length > 0) {
            logger.info('[ChatProvider] Initializing confirmed states from localStorage:', parsed.confirmed);
            return new Set(parsed.confirmed);
          }
        } catch (e) {
          logger.error('[ChatProvider] Error loading saved confirmations:', e);
        }
      }
    }
    return new Set();
  });
  
  const [editedFoodItems, setEditedFoodItems] = useState<Map<string, any>>(() => {
    // Initialize edited items from localStorage
    if (typeof window !== 'undefined') {
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date === today && parsed.editedItems) {
            logger.info('[ChatProvider] Initializing edited items from localStorage');
            return new Map(Object.entries(parsed.editedItems));
          }
        } catch (e) {
          logger.error('[ChatProvider] Error loading edited items:', e);
        }
      }
    }
    return new Map();
  });
  
  const [editingFoodLog, setEditingFoodLog] = useState<string | null>(null);
  
  // This state will persist across tab switches
  const streamingChat = useStreamingChat({
    onComplete: async (newThreadId) => {
      logger.info('[ChatProvider] Thread completed:', newThreadId);
      if (onCompleteCallbackRef.current) {
        onCompleteCallbackRef.current(newThreadId);
      }
    },
    onToolCall: (toolCall) => {
      logger.info('[ChatProvider] Tool called:', toolCall);
    }
  });

  const setOnCompleteCallback = useCallback((callback: ((threadId: string) => void) | null) => {
    onCompleteCallbackRef.current = callback;
  }, []);

  return (
    <ChatContext.Provider value={{
      ...streamingChat,
      setOnCompleteCallback,
      // Confirmation bubble state
      confirmedFoodLogs,
      setConfirmedFoodLogs,
      editedFoodItems,
      setEditedFoodItems,
      editingFoodLog,
      setEditingFoodLog
    }}>
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