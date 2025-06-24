"use client";

import { useState, useRef, useEffect, memo, useMemo, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Card, CardContent } from "~/app/components/ui/card";
import { cn } from "~/lib/utils";
import { Camera, Paperclip, ArrowUp, X, Check, Settings, PenSquare, ChevronDown, Target, Scale, Flame, Dumbbell, Wheat, Droplet, RefreshCw, Sparkles, HelpCircle, FileText, LogOut } from "lucide-react";
import { ClientOnly } from "~/app/components/ClientOnly";
import { OnboardingQuickResponses } from "~/app/components/OnboardingQuickResponses";
import { ProfileEditModal } from "~/app/components/ProfileEditModal";
import { MarkdownMessage } from "~/app/components/MarkdownMessage";
import { ThemeToggle } from "~/app/components/ThemeToggle";
import { useChat } from "~/app/providers/ChatProvider";
import { logger } from "~/app/utils/logger";

interface Message {
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

// Memoized message component to prevent unnecessary re-renders
const ChatMessage = memo(({ 
  message, 
  index,
  imageUrl,
  onToolAction
}: { 
  message: Message; 
  index: number;
  imageUrl?: string | null;
  onToolAction?: (action: string, data: any) => void;
}) => {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2">
        {imageUrl && (
          <div>
            <img
              src={imageUrl}
              alt="User uploaded"
              className="rounded-xl shadow-sm"
              style={{ maxHeight: '120px', maxWidth: '120px', objectFit: 'cover' }}
            />
          </div>
        )}
        
        {(message.content && message.content !== "[Photo uploaded]") && (
          <div className={cn(
            "relative max-w-[70%] px-4 py-2.5",
            "bg-muted text-foreground",
            "rounded-2xl rounded-br-sm",
            "shadow-sm border border-border",
            message.content.length < 20 && "min-w-[80px] text-center"
          )}>
            <div className="text-[15px] leading-relaxed">{message.content}</div>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] space-y-2">
        {message.activeToolCall && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {message.activeToolCall.status === 'calling' ? (
              <>
                <div className="animate-spin h-3 w-3 border-2 border-muted border-t-primary rounded-full" />
                <span>Running {message.activeToolCall.name}...</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span>Completed {message.activeToolCall.name}</span>
              </>
            )}
          </div>
        )}
        <div className="text-foreground">
          <MarkdownMessage content={message.content} className="text-[15px]" />
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

// Memoized confirmation bubble component
const ConfirmationBubble = memo(({ 
  args, 
  confirmId,
  isConfirmed,
  editingFoodLog,
  editedFoodItems,
  isStealthMode,
  onConfirm,
  onEdit,
  onEditChange,
  onReject,
  isStreaming
}: any) => {
  // Ensure editedFoodItems is a Map
  const editedItems = editedFoodItems instanceof Map ? editedFoodItems : new Map();
  if (isConfirmed) {
    return (
      <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-green-50/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 shadow-sm">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-800 dark:text-green-200">
            Logged {args.mealType}
          </span>
          <span className="text-sm text-green-700 dark:text-green-300">
            • {editedItems.get(confirmId) ? 
                editedItems.get(confirmId).reduce((sum: number, item: any) => sum + (item.calories || 0), 0) : 
                args.totalCalories} calories
          </span>
          <span className="text-sm text-green-600 dark:text-green-400">
            • {editedItems.get(confirmId)?.length || args.items.length} items
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[80%] px-4 py-3 rounded-2xl border border-border">
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium text-card-foreground flex items-center gap-1">
          Got it! Let me confirm what you had:
          <FileText className="h-4 w-4" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mt-1 -mr-1"
          onClick={onEdit}
        >
          <PenSquare className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {(editedItems.get(confirmId) || args.items).map((item: any, i: number) => (
          <div key={i} className="text-sm text-foreground">
            {editingFoodLog === confirmId ? (
              <div className="flex items-center gap-2">
                <span>•</span>
                <Input
                  value={item.name}
                  onChange={(e) => onEditChange(confirmId, i, 'name', e.target.value)}
                  className="h-6 px-2 py-1 text-sm bg-input"
                />
                <Input
                  value={item.quantity}
                  onChange={(e) => onEditChange(confirmId, i, 'quantity', e.target.value)}
                  className="h-6 px-2 py-1 text-sm w-24 bg-input"
                />
                <span>-</span>
                <Input
                  type="number"
                  value={item.calories}
                  onChange={(e) => onEditChange(confirmId, i, 'calories', parseInt(e.target.value) || 0)}
                  className="h-6 px-2 py-1 text-sm w-20 bg-input"
                />
                <span>cal</span>
              </div>
            ) : (
              <span>• {item.name} {item.quantity} - {item.calories} cal</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <div className="font-medium text-foreground">
          Total: {editedItems.get(confirmId) ? 
            editedItems.get(confirmId).reduce((sum: number, item: any) => sum + (item.calories || 0), 0) : 
            args.totalCalories} calories
        </div>
        {!isStealthMode && (
          <div className="text-xs text-muted-foreground mt-1">
            {args.totalProtein}g protein • {args.totalCarbs}g carbs • {args.totalFat}g fat
          </div>
        )}
      </div>
      <div className="mt-4 space-y-3">
        <div className="text-sm text-foreground">
          Should I log this as your {args.mealType}?
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1 transition-opacity hover:opacity-80"
            variant="default"
            onClick={onConfirm}
            disabled={isStreaming}
          >
            <Check className="h-4 w-4 mr-2" />
            Yes, log it!
          </Button>
          {editingFoodLog === confirmId && (
            <Button
              variant="outline"
              onClick={onReject}
              disabled={isStreaming}
              className="transition-opacity hover:opacity-80"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

ConfirmationBubble.displayName = 'ConfirmationBubble';

export default function Chat() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  
  // State - Define before using in queries
  const [input, setInput] = useState("");
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const loadingRef = useRef(false); // Prevent double loads in StrictMode
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>(""); // Track last saved state to prevent duplicates
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  // Removed - now using ChatProvider state
  const [persistedConfirmations, setPersistedConfirmations] = useState<any[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [onboardingHeight, setOnboardingHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Duplicate prevention tracking
  const [activeLogRequests, setActiveLogRequests] = useState<Set<string>>(new Set());
  const [recentLogs, setRecentLogs] = useState<Map<string, number>>(new Map()); // logKey -> timestamp
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null); // Track active upload
  const [recentMessageHashes, setRecentMessageHashes] = useState<Set<string>>(new Set()); // Track recent messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const onboardingRef = useRef<HTMLDivElement>(null);
  const lastSentMessageRef = useRef<{ content: string; timestamp: number } | null>(null);
  
  // Use shared chat context that persists across tab switches (moved up to use threadId)
  const {
    messages,
    isStreaming,
    threadId,
    sendMessage: sendStreamingMessage,
    stopStreaming,
    setMessages,
    setThreadId,
    setOnCompleteCallback,
    // Confirmation bubble state from ChatProvider
    confirmedFoodLogs,
    setConfirmedFoodLogs,
    editedFoodItems,
    setEditedFoodItems,
    editingFoodLog,
    setEditingFoodLog
  } = useChat();
  
  // Convex queries
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const dailySummary = useQuery(api.dailySummary.getDailySummary, {});
  const sessionStats = useQuery(api.chatSessions.getSessionStats);
  const hasLoggedWeightToday = useQuery(api.weightLogs.hasLoggedWeightToday);
  const subscriptionStatus = useQuery(api.subscriptions.checkUserSubscriptionStatus, {});
  const pendingConfirmations = useQuery(api.pendingConfirmations.getLatestPendingConfirmation, 
    threadId ? { threadId } : "skip"
  );
  
  // Convex action for Agent SDK (not used with streaming)
  // const sendMessageAction = useAction(api.agentActions.chat);
  
  // Convex mutations for file upload
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const storeFileId = useMutation(api.files.storeFileId);
  const resetOnboarding = useMutation(api.onboarding.resetOnboarding);
  const forceCompleteOnboarding = useMutation(api.onboardingFix.forceCompleteOnboarding);
  const saveAgentThreadId = useMutation(api.userPreferences.saveAgentThreadId);
  const startNewChatSession = useMutation(api.chatSessions.startNewChatSession);
  const getOrCreateDailySession = useMutation(api.chatSessions.getOrCreateDailySession);
  const updateTheme = useMutation(api.userPreferences.updateTheme);
  const getOrCreateDailyThread = useMutation(api.threads.getOrCreateDailyThread);
  const logFood = useMutation(api.foodLogs.logFood);
  const saveMessage = useMutation(api.threads.saveMessage);
  const confirmPendingConfirmation = useMutation(api.pendingConfirmations.confirmPendingConfirmation);
  
  // Query for thread messages
  const threadMessages = useQuery(api.threads.getThreadMessages, 
    threadId ? { threadId, limit: 100 } : "skip"
  );
  
  // Get all storage IDs from messages that need image URLs
  const storageIdsFromMessages = messages
    .filter(msg => msg.storageId)
    .map(msg => msg.storageId as Id<"_storage">);
    
  // Query to get image URLs for all storage IDs
  const imageUrls = useQuery(
    api.files.getMultipleImageUrls, 
    storageIdsFromMessages.length > 0 
      ? { storageIds: storageIdsFromMessages }
      : "skip"
  );

  // Define isOnboarding early to use in useEffects
  const isOnboarding = !onboardingStatus?.completed;
  const isStealthMode = preferences?.displayMode === "stealth";

  // Detect current onboarding step from the last assistant message
  const detectOnboardingStep = () => {
    if (!isOnboarding) return null;
    
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMessage) return null;
    
    const content = lastAssistantMessage.content.toLowerCase();
    
    if (content.includes("biological sex") || content.includes("male or female")) {
      return "gender";
    } else if (content.includes("activity level") || content.includes("how active")) {
      return "activity_level";
    } else if (content.includes("would you like to") && content.includes("describe") && (content.includes("goal") || content.includes("situation"))) {
      // Only show goal options if Bob explicitly asks user to describe their goal/situation
      // This happens rarely when weights are equal or unclear
      return "goal";
    } else if (content.includes("standard mode") || content.includes("stealth mode")) {
      return "display_mode";
    } else if (content.includes("current weight") && !content.includes("goal weight")) {
      return "current_weight";
    } else if (content.includes("goal weight") || content.includes("target weight")) {
      return "target_weight";
    } else if (content.includes("height") && content.includes("age")) {
      return "height_age";
    }
    
    return null;
  };
  
  const currentOnboardingStep = detectOnboardingStep();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isSignedIn === false) {
      router.push("/sign-in");
    }
  }, [isSignedIn, router]);

  // Set up callback for thread ID saving
  useEffect(() => {
    setOnCompleteCallback(async (newThreadId: string) => {
      if (newThreadId && !threadId) {
        await saveAgentThreadId({ threadId: newThreadId });
      }
    });
    
    // Cleanup on unmount
    return () => {
      setOnCompleteCallback(null);
    };
  }, [threadId, saveAgentThreadId, setOnCompleteCallback]);

  // For new users (no profile), check subscription immediately
  useEffect(() => {
    if (profile === null) {
      setIsInitialLoad(false);
    }
  }, [profile]);

  // For existing users, give time for subscription webhook to update after payment
  useEffect(() => {
    // Only set timer if we have a profile (existing user)
    if (profile && isInitialLoad) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 5000); // 5 seconds grace period
      
      return () => clearTimeout(timer);
    }
  }, [profile, isInitialLoad]);

  // Check subscription status after initial load period
  useEffect(() => {
    if (!isInitialLoad && subscriptionStatus !== undefined && !subscriptionStatus.hasActiveSubscription) {
      router.push("/pricing");
    }
  }, [isInitialLoad, subscriptionStatus, router]);

  // Clear any old localStorage data on mount to prevent cross-user data leakage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear old localStorage items that might contain other users' data
      // Don't clear chatMessages - we'll load from Convex instead
      // localStorage.removeItem('agentThreadId');
      
      // Load persisted confirmations for today only
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          // Only load confirmations from today
          if (parsed.date === today) {
            setPersistedConfirmations(parsed.confirmations || []);
            // Restore confirmed state for already-logged items
            if (parsed.confirmed && parsed.confirmed.length > 0) {
              logger.info('Restoring confirmed states:', parsed.confirmed);
              setConfirmedFoodLogs(prev => new Set([...prev, ...parsed.confirmed]));
              if (parsed.editedItems) {
                setEditedFoodItems(new Map(Object.entries(parsed.editedItems)));
              }
            }
          } else {
            // Clear old confirmations from previous days
            localStorage.removeItem('foodConfirmations');
          }
        } catch (e) {
          logger.error('Error loading persisted confirmations:', e);
        }
      }
    }
  }, []);
  
  // Track if we've synced messages for this thread
  const [syncedThreadId, setSyncedThreadId] = useState<string | null>(null);
  
  // Load thread messages from Convex when available or thread changes
  useEffect(() => {
    // Load messages if:
    // 1. We have thread messages from Convex
    // 2. Either we have no messages OR the thread has changed
    if (threadMessages && threadMessages.length > 0 && 
        (messages.length === 0 || syncedThreadId !== threadId)) {
      logger.info(`[Chat] Loading ${threadMessages.length} messages from Convex for thread ${threadId}`);
      
      // Convert Convex messages to the format expected by the chat UI
      const loadedMessages = threadMessages.map((msg: any) => {
        // Log if we have toolCalls
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          logger.info(`[Chat] Loading message with toolCalls:`, {
            messageContent: msg.content.substring(0, 50),
            toolCallCount: msg.toolCalls.length,
            toolNames: msg.toolCalls.map((tc: any) => tc.toolName)
          });
        }
        
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
          toolCalls: msg.toolCalls || undefined, // Don't fallback to metadata.toolCalls
          // Don't set imageUrl here - let the imageUrls query handle it
          storageId: msg.metadata?.storageId
        };
      });
      
      setMessages(loadedMessages);
      setHasLoadedHistory(true);
      setSyncedThreadId(threadId);
      
      // Restore confirmed states from localStorage if available
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date === today && parsed.confirmed && parsed.confirmed.length > 0) {
            logger.info('[Chat] Restoring confirmed states for loaded messages:', parsed.confirmed);
            setConfirmedFoodLogs(prev => new Set([...prev, ...parsed.confirmed]));
            if (parsed.editedItems) {
              // Convert the plain object back to a Map
              const itemsMap = new Map(Object.entries(parsed.editedItems));
              setEditedFoodItems(itemsMap);
            }
          }
        } catch (e) {
          logger.error('Error restoring confirmation states:', e);
        }
      }
    }
  }, [threadMessages, messages.length, setMessages, threadId, syncedThreadId]);
  
  // Apply theme from preferences
  useEffect(() => {
    if (preferences?.darkMode !== undefined) {
      const theme = preferences.darkMode ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', preferences.darkMode);
    }
  }, [preferences?.darkMode]);

  // Get or create daily thread on mount
  useEffect(() => {
    const initThread = async () => {
      if (!threadId && profile) {
        try {
          const result = await getOrCreateDailyThread({});
          if (result.threadId) {
            logger.info(`[Chat] Initialized daily thread: ${result.threadId}`);
            setThreadId(result.threadId);
          }
        } catch (error) {
          logger.error('Failed to get/create daily thread:', error);
        }
      }
    };
    
    initThread();
  }, [profile, threadId, getOrCreateDailyThread, setThreadId]);

  // Save confirmation state to localStorage whenever it changes (debounced)
  useEffect(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set a new timeout to save after 1500ms of no changes
    saveTimeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') {
        const today = new Date().toISOString().split('T')[0];
        
        // Get all current confirmations from messages
        const currentConfirmations = messages
          .map((msg, idx) => {
            const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto");
            if (confirmCall) {
              return {
                index: idx,
                content: msg.content,
                args: confirmCall.args,
                triggerContent: messages[idx - 1]?.content || ""
              };
            }
            return null;
          })
          .filter(Boolean);
        
        // Check if we have any messages with toolCalls
        const hasToolCallsInMessages = messages.some(msg => msg.toolCalls && msg.toolCalls.length > 0);
        
        // Only save if:
        // 1. We have confirmations in the current messages (with toolCalls), OR
        // 2. We have confirmed food logs but NO toolCalls in messages (meaning messages were loaded from DB without toolCalls)
        // This prevents clearing confirmations when messages are reloaded without toolCalls
        if (currentConfirmations.length > 0 || (confirmedFoodLogs.size > 0 && !hasToolCallsInMessages)) {
          const persistData = {
            date: today,
            confirmations: currentConfirmations,
            confirmed: Array.from(confirmedFoodLogs),
            editedItems: editedFoodItems instanceof Map 
              ? Object.fromEntries(Array.from(editedFoodItems.entries()))
              : editedFoodItems
          };
          
          // Check if the state has actually changed
          const stateString = JSON.stringify(persistData);
          if (stateString !== lastSavedStateRef.current) {
            logger.debug('Saving confirmed bubbles to localStorage:', Array.from(confirmedFoodLogs));
            localStorage.setItem('foodConfirmations', JSON.stringify(persistData));
            lastSavedStateRef.current = stateString;
          }
        } else if (hasToolCallsInMessages && currentConfirmations.length === 0 && confirmedFoodLogs.size === 0) {
          // Only clear if we have toolCalls in messages but no confirmations
          // This means the user rejected all confirmations
          logger.debug('Clearing food confirmations - no active confirmations');
          localStorage.removeItem('foodConfirmations');
          lastSavedStateRef.current = "";
        }
        // If no toolCalls in messages and no confirmed logs, do nothing (preserve existing localStorage)
      }
    }, 1500);
    
    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [confirmedFoodLogs, editedFoodItems, messages]);

  // Load thread ID from preferences
  useEffect(() => {
    // if (preferences?.agentThreadId && !threadId) {
    //   setThreadId(preferences.agentThreadId);
    // }
  }, []);

  // Create or check daily session on mount
  useEffect(() => {
    const initializeSession = async () => {
      // Only run once profile is loaded and chat history has been checked
      if (profile && hasLoadedHistory && dailySummary !== undefined) {
        try {
          // This will create a new session if needed or return existing one
          const session = await getOrCreateDailySession({});
          
          // Check if this is a new session for today AND we have no messages
          const today = new Date().toISOString().split('T')[0];
          if (session && session.messageCount === 0 && session.startDate === today && messages.length === 0) {
            // New session with no history - show greeting
            let greeting = `Good morning ${profile?.name || "there"}! 🌅 Starting fresh for today.`;
            
            if (hasLoggedWeightToday === false) {
              greeting += ` Don't forget to log your weight! ⚖️`;
            }
            
            greeting += ` What can I help you with?`;
            
            // Set greeting message only if we truly have no messages
            setMessages([{
              role: "assistant",
              content: greeting,
            }]);
            setThreadId(null); // Clear thread for new day
          }
        } catch (error) {
          logger.error("Error initializing session:", error);
        }
      }
    };
    
    initializeSession();
  }, [profile, hasLoggedWeightToday, hasLoadedHistory, dailySummary, messages.length]);



  // Initialize with daily summary instead of full history
  useEffect(() => {
    // Use ref to prevent double execution in StrictMode
    if (loadingRef.current) return;
    
    // Only initialize if we haven't loaded from Convex yet
    if (dailySummary && !hasLoadedHistory && messages.length === 0) {
      loadingRef.current = true;
      logger.info('[Chat] Initializing chat - no existing messages');
      
      // If we have a threadId, wait for messages to load from Convex
      if (threadId) {
        logger.info('[Chat] Have threadId, waiting for Convex messages');
        return;
      }
      
      // Only show greeting if no messages exist
      let greeting = '';
      if (messages.length === 0) {
        logger.info('[Chat] No messages found, showing greeting');
        
        // Build initial greeting with context
        greeting = `Good morning ${dailySummary.profile?.name || 'there'}! `;
        
        if (dailySummary.yesterday.stats.calories > 0) {
          greeting += `Yesterday: ${dailySummary.yesterday.total}. `;
        }
        
        if (!dailySummary.today.hasWeighedIn) {
          greeting += `Don't forget to log your weight today! ⚖️\n\n`;
        }
        
        if (dailySummary.today.foodLogs.length > 0) {
          greeting += `Today so far:\n${dailySummary.today.summary}\n\n`;
          greeting += `Total: ${dailySummary.today.stats.calories}cal `;
          greeting += `(${dailySummary.today.stats.protein}p/${dailySummary.today.stats.carbs}c/${dailySummary.today.stats.fat}f)`;
          if (dailySummary.today.remaining) {
            greeting += `\n${dailySummary.today.remaining.calories} calories remaining.`;
          }
        } else {
          greeting += `Ready to start tracking for today? What's on your plate?`;
        }
      }
      
      // Check for pending confirmations from localStorage
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      const initialMessages: Message[] = [];
      
      if (!isOnboarding && greeting) {
        // Add the greeting message first
        initialMessages.push({
          role: "assistant",
          content: greeting
        });
        
        // Then restore any pending confirmations
        if (savedConfirmations) {
          try {
            const parsed = JSON.parse(savedConfirmations);
            const today = new Date().toISOString().split('T')[0];
            
            if (parsed.date === today && parsed.confirmations?.length > 0) {
              logger.info('Restoring pending confirmations:', parsed.confirmations.length);
              
              // Add pending confirmations after greeting
              parsed.confirmations.forEach((conf: any) => {
                initialMessages.push({
                  role: "assistant",
                  content: conf.content,
                  toolCalls: [{
                    toolName: "confirmFood",
                    args: conf.args
                  }]
                });
              });
              
              // Restore confirmed states
              if (parsed.confirmed?.length > 0) {
                setConfirmedFoodLogs(prev => new Set([...prev, ...parsed.confirmed]));
              }
              if (parsed.editedItems) {
                setEditedFoodItems(new Map(Object.entries(parsed.editedItems)));
              }
            }
          } catch (e) {
            logger.error('Error loading confirmations:', e);
          }
        }
      } else {
        // Onboarding welcome message - ONLY if we don't already have messages
        if (messages.length === 0) {
          initialMessages.push({
            role: "assistant",
            content: "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?"
          });
        }
      }
      
      // Set all messages at once - ONLY if we have new messages to set
      if (initialMessages.length > 0 && messages.length === 0) {
        setMessages(initialMessages);
      }
      setHasLoadedHistory(true);
      
      // Reset loading ref
      setTimeout(() => {
        loadingRef.current = false;
      }, 100);
    }
  }, [dailySummary, onboardingStatus, hasLoadedHistory, persistedConfirmations, messages.length, threadId, isOnboarding]);

  // Measure onboarding container height
  useEffect(() => {
    if (onboardingRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setOnboardingHeight(entry.contentRect.height);
        }
      });
      
      resizeObserver.observe(onboardingRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [isOnboarding, currentOnboardingStep]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if ((!input.trim() && !selectedImage) || isStreaming || isUploading) return;

    const userMessage = input.trim();
    const hasImage = !!selectedImage;
    
    // Prevent double submissions
    if (hasImage && activeUploadId) {
      logger.warn('[Chat] Upload already in progress, ignoring submission');
      return;
    }
    
    // Create user message
    let messageContent = userMessage;
    if (hasImage) {
      messageContent = userMessage || "What's in this photo?";
    }
    
    const newUserMessage: Message = { 
      role: "user", 
      content: messageContent,
      imageUrl: imagePreview || undefined,
      // We'll add storageId after upload
    };
    
    // Check if there are any unconfirmed food logs that should be removed
    // This happens when user types something else instead of confirming
    const hasUnconfirmedFoodLogs = messages.some((msg, idx) => {
      const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto");
      if (confirmCall) {
        const confirmId = getConfirmationId(confirmCall.args, idx);
        return !confirmedFoodLogs.has(confirmId);
      }
      return false;
    });
    
    // Keep confirmation bubbles visible - don't remove them
    // They should only be removed when explicitly confirmed or rejected
    
    // Check for duplicate message submission (within 2 seconds)
    const now = Date.now();
    if (lastSentMessageRef.current && 
        lastSentMessageRef.current.content === messageContent && 
        now - lastSentMessageRef.current.timestamp < 2000) {
      logger.warn('[Chat] Duplicate message submission prevented:', messageContent);
      return;
    }
    
    // Don't add message here - the streaming hook will add it
    setInput("");
    lastSentMessageRef.current = { content: messageContent, timestamp: now };

    try {
      let finalMessage = userMessage;
      
      let storageId: string | null = null;
      
      // If there's an image, upload it to Convex storage
      if (selectedImage && imagePreview) {
        // Generate a unique upload ID to track this upload
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        setActiveUploadId(uploadId);
        setIsUploading(true);
        
        try {
          logger.info('Starting image upload...', {
            uploadId,
            fileName: selectedImage.name,
            fileSize: selectedImage.size,
            fileType: selectedImage.type
          });
          
          // Clear the image immediately to prevent re-uploads
          const imageToUpload = selectedImage;
          clearImage();
          
          storageId = await uploadPhoto(imageToUpload);
          logger.info('Upload successful, storageId:', storageId);
          
          finalMessage = userMessage || "Please analyze this food photo";
        } catch (uploadError) {
          logger.error("Failed to upload image:", uploadError);
          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
          const errorStack = uploadError instanceof Error ? uploadError.stack : undefined;
          
          logger.error('Upload error details:', {
            message: errorMessage,
            stack: errorStack
          });
          
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `Sorry, I couldn't upload the image. Error: ${errorMessage}. Please try again.`
          }]);
          setIsLoading(false);
          setIsUploading(false);
          setActiveUploadId(null);
          return;
        } finally {
          setIsUploading(false);
          setActiveUploadId(null);
        }
      }
      
      // Send message using streaming
      await sendStreamingMessage(
        finalMessage,
        threadId || undefined,
        storageId || undefined
      );
    } catch (error) {
      logger.error("Error sending message:", error);
      // Add error message
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    }
  };

  // Handle scroll position to show/hide scroll to bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollToBottom(!isAtBottom);
      }
    };
    
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current && messagesEndRef.current) {
      const container = chatContainerRef.current;
      // Use scrollTop instead of scrollIntoView for better control
      container.scrollTop = container.scrollHeight;
    }
  }, []);
  
  // Smart auto-scroll - only when appropriate
  useEffect(() => {
    if (!chatContainerRef.current || messages.length === 0) return;
    
    const container = chatContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200; // More generous threshold
    
    // Don't auto-scroll if we're loading initial messages
    const isLoadingInitialMessages = hasLoadedHistory && messages.length > 5;
    if (isLoadingInitialMessages && !isStreaming) {
      return;
    }
    
    // Conditions for auto-scroll:
    // 1. User is streaming a message (always scroll)
    // 2. User just sent a message (scroll to see their message)
    // 3. User is already near bottom when new message arrives
    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    
    if (isStreaming || isUserMessage || isNearBottom) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, isStreaming, scrollToBottom, hasLoadedHistory]);

  // Handle file processing
  const processImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      logger.error('Invalid file type:', file?.type);
      return;
    }
    
    try {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = (error) => {
        logger.error('FileReader error:', error);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, I couldn't read the image file. Please try again."
        }]);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      logger.error('Error processing image:', error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error processing the image. Please try again."
      }]);
    }
  };

  // Handle image selection from input
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Clear selected image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle photo upload to Convex storage
  const uploadPhoto = async (file: File): Promise<string> => {
    try {
      // Get upload URL from Convex
      logger.debug('Getting upload URL from Convex...');
      const uploadUrl = await generateUploadUrl({ 
        metadata: { type: "image", purpose: "food-analysis" } 
      });
      logger.debug('Got upload URL:', uploadUrl);
      
      // Upload the file
      logger.debug('Uploading file to Convex storage...');
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      logger.debug('Upload response status:', result.status);
      
      if (!result.ok) {
        const errorText = await result.text();
        logger.error('Upload failed:', errorText);
        throw new Error(`Failed to upload image: ${result.status} ${errorText}`);
      }
      
      const responseData = await result.json();
      logger.debug('Upload response data:', responseData);
      const { storageId } = responseData;
      
      // Store the file ID
      logger.debug('Storing file ID...');
      await storeFileId({ storageId, uploadUrl });
      
      return storageId;
    } catch (error) {
      logger.error('Upload error in uploadPhoto:', error);
      throw error;
    }
  };

  // Helper functions
  const getProgressColor = (value: number, target: number) => {
    const percentage = (value / target) * 100;
    if (percentage < 80) return "text-muted-foreground";
    if (percentage <= 100) return "text-foreground";
    return "text-destructive";
  };
  
  // Generate a stable ID for a confirmation
  const getConfirmationId = useCallback((args: any, messageIndex: number, messageContent?: string) => {
    // Create a stable ID based on food content and a hash of the message
    const foodNames = args.items?.map((item: any) => item.name).join('-') || '';
    // Use a combination of food details to create a unique but stable ID
    const contentHash = `${args.mealType}-${args.totalCalories}-${foodNames}`.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    // Remove messageIndex from the ID to make it truly stable across reloads
    return `confirm-${Math.abs(contentHash)}`;
  }, []);
  
  // Clean up old entries from recentLogs (older than 30 seconds)
  const cleanupRecentLogs = () => {
    const now = Date.now();
    const thirtySecondsAgo = now - 30000;
    
    setRecentLogs(prev => {
      const newMap = new Map(prev);
      for (const [key, timestamp] of newMap) {
        if (timestamp < thirtySecondsAgo) {
          newMap.delete(key);
        }
      }
      return newMap;
    });
    
    // Also clean up message hashes older than 30 seconds
    setRecentMessageHashes(prev => {
      const newSet = new Set<string>();
      const cutoffTime = now - 30000;
      prev.forEach(hash => {
        const [, timestamp] = hash.split('_');
        if (parseInt(timestamp) > cutoffTime) {
          newSet.add(hash);
        }
      });
      return newSet;
    });
  };
  
  // Check if this food log is a duplicate
  const isDuplicateLog = (args: any): boolean => {
    const logKey = `${args.mealType}-${args.totalCalories}-${Date.now() / 1000 | 0}`; // 1-second precision
    const now = Date.now();
    
    // Clean up old entries
    cleanupRecentLogs();
    
    // Check if we logged something very similar in the last 30 seconds
    for (const [key, timestamp] of recentLogs) {
      if (key.startsWith(`${args.mealType}-${args.totalCalories}`) && 
          now - timestamp < 30000) {
        logger.warn('[Chat] Duplicate log detected:', { key, timeSince: now - timestamp });
        return true;
      }
    }
    
    return false;
  };
  
  // Callbacks for confirmation bubble
  const handleEditChange = useCallback((confirmId: string, itemIndex: number, field: string, value: any) => {
    setEditedFoodItems(prev => {
      const newMap = new Map(prev);
      const items = newMap.get(confirmId) || [];
      const updatedItems = [...items];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: value };
      newMap.set(confirmId, updatedItems);
      return newMap;
    });
  }, [setEditedFoodItems]);
  
  const handleEditToggle = useCallback((confirmId: string, args: any) => {
    if (editingFoodLog === confirmId) {
      setEditingFoodLog(null);
    } else {
      setEditingFoodLog(confirmId);
      if (!editedFoodItems.get(confirmId)) {
        setEditedFoodItems(prev => {
          const newMap = new Map(prev);
          newMap.set(confirmId, [...args.items]);
          return newMap;
        });
      }
    }
  }, [editingFoodLog, editedFoodItems, setEditingFoodLog, setEditedFoodItems]);

  // Persist confirmation states to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      // Debounce the localStorage save
      const timeoutId = setTimeout(() => {
        // Find all confirmation messages with their IDs
        const confirmations = messages
          .map((msg, idx) => ({ msg, idx }))
          .filter(({ msg }) => msg.toolCalls?.some(tc => tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto"))
          .map(({ msg, idx }) => {
            const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto");
            
            // Extract args properly for both tool types
            let args = confirmCall?.args;
            if (confirmCall?.toolName === "analyzeAndConfirmPhoto" && args?.analysisComplete) {
              const { analysisComplete, ...confirmationData } = args;
              args = confirmationData;
            }
            
            const confirmId = getConfirmationId(args, idx);
            return {
              index: idx,
              confirmId: confirmId,
              content: msg.content,
              args: args,
              triggerContent: messages[idx - 1]?.content || "",
              isConfirmed: confirmedFoodLogs.has(confirmId)
            };
          });
        
        // Save to localStorage
        localStorage.setItem('foodConfirmations', JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          confirmations: confirmations,
          confirmed: Array.from(confirmedFoodLogs),
          editedItems: editedFoodItems instanceof Map 
            ? Object.fromEntries(Array.from(editedFoodItems.entries()))
            : {}
        }));
      }, 500); // Wait 500ms before saving
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, confirmedFoodLogs, editedFoodItems, getConfirmationId]);

  // Show loading state while checking auth
  if (isSignedIn === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render chat if not signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex flex-col bg-background fixed inset-0 overflow-hidden">
      {/* Fixed Header Container */}
      <div className="flex-shrink-0">
        {/* Header */}
        <div className="border-b border-border">
          <div className="max-w-lg mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-lg text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Bob - Diet Coach
            </h1>
          </div>
          <div className="flex items-center gap-2">
          {/* DEV ONLY: Emergency Complete Button */}
          {process.env.NODE_ENV === "development" && isOnboarding && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                setIsLoading(true);
                try {
                  const result = await forceCompleteOnboarding();
                  if (result.error) {
                    alert(`Error: ${result.error}`);
                  } else {
                    window.location.reload();
                  }
                } catch (error) {
                  logger.error("Error forcing completion:", error);
                  alert("Failed to force complete");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isStreaming}
              className="text-xs text-red-500"
            >
              🚨 Force Complete
            </Button>
          )}
          {/* DEV ONLY: Reset Onboarding Button */}
          {process.env.NODE_ENV === "development" && !isOnboarding && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (confirm("Reset onboarding? This will restart the setup process but keep your data.")) {
                  setIsLoading(true);
                  try {
                    await resetOnboarding();
                    // Refresh the page to restart
                    window.location.reload();
                  } catch (error) {
                    logger.error("Error resetting onboarding:", error);
                    alert("Failed to reset onboarding");
                  } finally {
                    setIsLoading(false);
                  }
                }
              }}
              disabled={isStreaming}
              className="text-xs text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset Onboarding
            </Button>
          )}
          <ThemeToggle 
            onThemeChange={async (theme) => {
              await updateTheme({ darkMode: theme === "dark" });
            }}
          />
          <Button
            onClick={async () => {
              // Check if there's an active food confirmation
              const lastMessage = messages[messages.length - 1];
              const hasActiveConfirmation = lastMessage?.toolCalls?.some(
                tc => tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto"
              );
              
              if (hasActiveConfirmation) {
                alert("Please complete the current food confirmation first!");
                return;
              }
              
              if (confirm("Start a new chat? Your food logs will be saved.")) {
                setIsLoading(true);
                try {
                  // Start new session
                  await startNewChatSession();
                  // Clear messages
                  setMessages([{
                    role: "assistant",
                    content: `Hey ${profile?.name || "there"}! Fresh chat started! What can I help you with?`,
                  }]);
                  // Clear thread ID
                  setThreadId(null);
                } catch (error) {
                  logger.error("Error starting new chat:", error);
                } finally {
                  setIsLoading(false);
                }
              }
            }}
            disabled={isStreaming}
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground transition-opacity hover:opacity-70"
          >
            <PenSquare className="h-5 w-5" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
        </div>
        </div>

        {/* Status Cards - Only show after onboarding */}
        {!isOnboarding && (
          <div className="border-b border-border">
            <div className="max-w-lg mx-auto px-4 py-2 space-y-1.5">
          {/* Weight Cards Row */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Goal Card */}
            <div className="border border-border rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Goal
              </div>
              <div className="text-lg font-bold text-card-foreground">
                {profile?.goal === "cut" ? "Cut" : profile?.goal === "gain" ? "Gain" : "Maintain"}
              </div>
              {profile?.targetWeight && (
                <div className="text-xs text-muted-foreground">
                  {profile.targetWeight} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                </div>
              )}
            </div>

            {/* Current Weight Card */}
            <div className="border border-border rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Scale className="h-3 w-3" />
                Current
              </div>
              <div className="text-lg font-bold text-card-foreground">
                {latestWeight?.weight || profile?.currentWeight || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {latestWeight?.unit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
            </div>
          </div>

          {/* Nutrition Card - Full Width */}
          <div className="border border-border rounded-lg p-2">
            <div className="text-xs text-muted-foreground text-center mb-1 flex items-center justify-center gap-1">
              <Flame className="h-3 w-3" />
              Nutrition
            </div>
            <div className="space-y-0.5">
                {/* Calories - Always show */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    Cals
                  </span>
                  <span className={cn("text-xs font-semibold", todayStats && profile ? getProgressColor(todayStats.calories, profile.dailyCalorieTarget) : "")}>
                    {isStealthMode ? (
                      todayStats && profile && todayStats.calories > profile.dailyCalorieTarget ? "Over" : "OK"
                    ) : (
                      `${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000}`
                    )}
                  </span>
                </div>
                
                {/* Protein - Show based on preference */}
                {preferences?.showProtein !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Dumbbell className="h-3 w-3" />
                      Protein
                    </span>
                    <span className={cn("text-xs font-semibold", todayStats && profile?.proteinTarget ? getProgressColor(todayStats.protein, profile.proteinTarget) : "text-muted-foreground")}>
                      {isStealthMode ? (
                        todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 ? "Low" : "OK"
                      ) : (
                        `${todayStats?.protein || 0}g/${profile?.proteinTarget || 150}g`
                      )}
                    </span>
                  </div>
                )}
                
                {/* Carbs - Show based on preference */}
                {!isStealthMode && preferences?.showCarbs !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wheat className="h-3 w-3" />
                      Carbs
                    </span>
                    <span className={cn("text-xs font-semibold", todayStats && profile?.carbsTarget ? getProgressColor(todayStats.carbs, profile.carbsTarget) : "text-muted-foreground")}>
                      {todayStats?.carbs || 0}g/{profile?.carbsTarget || 200}g
                    </span>
                  </div>
                )}
                
                {/* Fats - Show based on preference */}
                {!isStealthMode && preferences?.showFats !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Droplet className="h-3 w-3" />
                      Fats
                    </span>
                    <span className={cn("text-xs font-semibold", 
                      todayStats && (profile?.fatTarget || profile?.fatTarget === 0) 
                        ? getProgressColor(todayStats.fat, profile.fatTarget || 65) 
                        : "text-muted-foreground"
                    )}>
                      {todayStats?.fat || 0}g/{profile?.fatTarget || 65}g
                    </span>
                  </div>
                )}
            </div>
          </div>
          </div>
        </div>
        )}
      </div>

      {/* Chat Messages - Scrollable area */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={chatContainerRef} className="h-full overflow-y-auto overflow-x-hidden space-y-4" style={{ minHeight: 0, paddingBottom: isOnboarding && currentOnboardingStep ? `${onboardingHeight + 180}px` : "140px" }}>
          <div className="max-w-lg mx-auto px-4 pt-4">
        <ClientOnly>
          
          {messages.map((message, index) => {
          // Handle messages with tool calls (like confirmFood)
          if (message.toolCalls && message.toolCalls.length > 0) {
            const confirmFoodCall = message.toolCalls.find(tc => 
              tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto"
            );
            
            if (confirmFoodCall) {
              // For analyzeAndConfirmPhoto, the confirmation data is in args, not result
              let args = confirmFoodCall.args;
              
              // If it's analyzeAndConfirmPhoto and has analysisComplete, extract the data
              if (confirmFoodCall.toolName === "analyzeAndConfirmPhoto" && args?.analysisComplete) {
                // Remove the analysisComplete flag for consistent handling
                const { analysisComplete, ...confirmationData } = args;
                args = confirmationData;
              }
              
              // Skip if no valid args or if it's an error
              if (!args || args.error || !args.items) {
                logger.warn('[Chat] Skipping confirmation - invalid args:', {
                  hasArgs: !!args,
                  hasError: args?.error,
                  hasItems: args?.items
                });
                return null;
              }
              const confirmId = getConfirmationId(args, index);
              const isConfirmed = confirmedFoodLogs.has(confirmId);
              
              // Always show confirmations - persistence handles old ones
              // Don't filter based on date here since we already handle that in loading
              
              return (
                <div key={index} className="space-y-4">
                  {/* Bob's message */}
                  <div className="flex justify-start">
                    <div className="max-w-[70%] text-foreground">
                      <MarkdownMessage content={message.content} className="text-[15px]" />
                    </div>
                  </div>
                  
                  {/* Food confirmation card - either full or collapsed */}
                  <div className="flex justify-start">
                    <ConfirmationBubble
                      args={args}
                      confirmId={confirmId}
                      isConfirmed={isConfirmed}
                      editingFoodLog={editingFoodLog}
                      editedFoodItems={editedFoodItems}
                      isStealthMode={isStealthMode}
                      isStreaming={isStreaming}
                      onEdit={() => handleEditToggle(confirmId, args)}
                      onEditChange={handleEditChange}
                      onReject={() => {
                        setEditingFoodLog(null);
                        setEditedFoodItems(prev => {
                          const newMap = new Map(prev);
                          newMap.set(confirmId, args.items);
                          return newMap;
                        });
                      }}
                      onConfirm={async () => {
                        // Check for duplicate
                        if (isDuplicateLog(args)) {
                          logger.warn('[Chat] Duplicate log prevented for:', args.description);
                          setMessages(prev => [...prev, {
                            role: "assistant",
                            content: "This food was already logged recently!"
                          }]);
                          return;
                        }
                        
                        // Check if already processing this request
                        const requestKey = `${confirmId}-${Date.now()}`;
                        if (activeLogRequests.has(confirmId)) {
                          logger.warn('[Chat] Already processing this confirmation:', confirmId);
                          return;
                        }
                        
                        // Mark as processing
                        setActiveLogRequests(prev => new Set(prev).add(confirmId));
                        setConfirmedFoodLogs(prev => new Set(prev).add(confirmId));
                        setIsLoading(true);
                        
                        try {
                          // Get the final data (either edited or original)
                          const finalItems = editedFoodItems.get(confirmId) || args.items;
                          const finalCalories = finalItems.reduce((sum: number, item: any) => sum + (item.calories || 0), 0);
                          const finalProtein = finalItems.reduce((sum: number, item: any) => sum + (item.protein || 0), 0);
                          const finalCarbs = finalItems.reduce((sum: number, item: any) => sum + (item.carbs || 0), 0);
                          const finalFat = finalItems.reduce((sum: number, item: any) => sum + (item.fat || 0), 0);
                          
                          // Log the food directly
                          const logResult = await logFood({
                            description: args.description,
                            foods: finalItems.map((item: any) => ({
                              name: item.name,
                              quantity: item.quantity,
                              calories: item.calories,
                              protein: item.protein || 0,
                              carbs: item.carbs || 0,
                              fat: item.fat || 0,
                            })),
                            meal: args.mealType,
                            aiEstimated: true,
                            confidence: args.confidence || "medium"
                          });
                          
                          // Track this successful log
                          const logKey = `${args.mealType}-${finalCalories}`;
                          setRecentLogs(prev => new Map(prev).set(logKey, Date.now()));
                          
                          // Add a success message
                          const caloriesRemaining = (profile?.dailyCalorieTarget || 2000) - ((todayStats?.calories || 0) + finalCalories);
                          const successMessage = `Logged! ${caloriesRemaining} calories left today.`;
                          setMessages(prev => [...prev, {
                            role: "assistant",
                            content: successMessage
                          }]);
                          
                          // Save the message to chat history with foodLogId
                          if (threadId) {
                            try {
                              await saveMessage({
                                threadId,
                                role: "assistant",
                                content: successMessage,
                                metadata: {
                                  foodLogId: logResult,
                                  actionType: "food_log"
                                }
                              });
                            } catch (err) {
                              logger.warn('[Chat] Could not save food log message to history:', err);
                            }
                          }
                          
                          // Clear pending confirmation if exists
                          if (confirmPendingConfirmation && pendingConfirmations) {
                            try {
                              await confirmPendingConfirmation({ confirmationId: pendingConfirmations._id });
                            } catch (err) {
                              logger.warn('[Chat] Could not clear pending confirmation:', err);
                            }
                          }
                          
                        } catch (error) {
                          logger.error("Error logging food directly:", error);
                          // On error, fall back to sending "yes" message
                          try {
                            await sendStreamingMessage(
                              "yes",
                              threadId || undefined
                            );
                          } catch (streamError) {
                            logger.error("Error confirming via stream:", streamError);
                            setMessages(prev => [...prev, {
                              role: "assistant",
                              content: "Sorry, I couldn't log that. Please try again."
                            }]);
                          }
                        } finally {
                          setIsLoading(false);
                          setEditingFoodLog(null);
                          // Remove from active requests
                          setActiveLogRequests(prev => {
                            const next = new Set(prev);
                            next.delete(confirmId);
                            return next;
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              );
            }
          }

          // Regular message display - use memoized component
          const imgUrl = message.storageId && imageUrls?.[message.storageId] 
            ? imageUrls[message.storageId] 
            : message.imageUrl || null;
            
          return (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-2",
                message.role === "user" ? "items-end" : "items-start"
              )}
            >
              <ChatMessage 
                message={message} 
                index={index}
                imageUrl={imgUrl}
              />
            </div>
          );
        })}
        </ClientOnly>
        
        {isStreaming && (
          <div className="flex justify-start">
            <div className="flex space-x-1 p-3">
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        )}
          <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
      

      {/* Quick Responses for Onboarding */}
      {isOnboarding && currentOnboardingStep && (
        <div ref={onboardingRef} className="fixed left-0 right-0 bg-background/90 backdrop-blur-sm shadow-lg z-20" style={{ bottom: "calc(76px + 4rem + 2.5rem)" }}>
          <div className="max-w-lg mx-auto px-2 py-2">
          <OnboardingQuickResponses
            step={currentOnboardingStep}
            currentInput={input}
            onSelect={async (value) => {
              // Send using streaming (it will add the user message)
              setIsLoading(true);

              try {
                await sendStreamingMessage(
                  value,
                  threadId || undefined
                );
              } catch (error) {
                logger.error("Error sending quick response:", error);
                setMessages(prev => [...prev, {
                  role: "assistant",
                  content: "Sorry, I encountered an error. Please try again."
                }]);
              } finally {
                setIsLoading(false);
              }
            }}
            isLoading={isLoading || isStreaming}
          />
          </div>
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed right-1/2 translate-x-1/2 bg-muted text-foreground rounded-full p-2.5 shadow-sm transition-all duration-200 focus:outline-none focus:ring-0 border border-border"
          style={{ zIndex: 10, bottom: "calc(76px + 5rem + 2rem)" }}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
      
      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border" style={{ paddingBottom: "76px" }}>
        <div className="max-w-lg mx-auto px-4 py-4">
          <form
            onSubmit={handleSubmit}
            className="relative focus:outline-none"
          >
            <div className="relative bg-card border border-border rounded-3xl shadow-sm px-5 py-4 w-full">
              {/* Image Preview at top */}
              {imagePreview && (
                <div className="relative mb-3">
                  <img 
                    src={imagePreview} 
                    alt="Selected food" 
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-md bg-primary focus:outline-none focus:ring-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              
              {/* Bottom row with icons, input, and send button */}
              <div className="flex items-center">
                {/* Left side icons */}
                <div className="flex items-center gap-3 mr-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="text-muted-foreground transition-opacity p-1 focus:outline-none focus:ring-0 hover:opacity-70"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground transition-opacity p-1 focus:outline-none focus:ring-0 hover:opacity-70"
                    onClick={() => {
                      // Create a temporary input without capture attribute for gallery
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          // Use the direct file processor
                          processImageFile(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Input field */}
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Bob anything"
                  className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none focus:outline-none focus:ring-0 text-[15px]"
                  disabled={isStreaming}
                  style={{ WebkitAppearance: 'none' }}
                />
                
                {/* Send button */}
                <button
                  type="submit"
                  disabled={(!input.trim() && !selectedImage) || isStreaming || isUploading}
                  className={cn(
                    "ml-2 rounded-full p-1.5 transition-opacity focus:outline-none focus:ring-0 hover:opacity-80",
                    (!input.trim() && !selectedImage) || isStreaming || isUploading
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-foreground text-background"
                  )}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}