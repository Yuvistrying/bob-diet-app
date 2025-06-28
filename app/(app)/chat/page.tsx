"use client";

import { useState, useRef, useEffect, memo, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-stretch gap-2 max-w-[85%] ml-auto">
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
            "px-4 py-1",
            "bg-muted text-foreground",
            "rounded-2xl rounded-br-sm",
            "shadow-sm border border-border",
            "text-[15px] leading-relaxed text-left",
            "whitespace-pre-wrap break-words"
          )}>
            {message.content}
          </div>
        )}
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
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
    </motion.div>
  );
});

ChatMessage.displayName = 'ChatMessage';

// Memoized confirmation bubble component
const ConfirmationBubble = memo(({ 
  args, 
  confirmId,
  isConfirmed,
  isRejected,
  isStealthMode,
  onConfirm,
  onReject,
  isStreaming
}: any) => {
  if (isConfirmed) {
    return (
      <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-green-50/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 shadow-sm">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-800 dark:text-green-200">
            Logged {args.mealType}
          </span>
          <span className="text-sm text-green-700 dark:text-green-300">
            • {Math.round(args.totalCalories)} calories
          </span>
          <span className="text-sm text-green-600 dark:text-green-400">
            • {args.items.length} items
          </span>
        </div>
      </div>
    );
  }
  
  if (isRejected) {
    return (
      <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 shadow-sm">
        <div className="flex items-center gap-2">
          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="font-medium text-red-800 dark:text-red-200">
            Not Accurate
          </span>
          <span className="text-sm text-red-700 dark:text-red-300">
            • {args.mealType}
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
      </div>
      <div className="space-y-1">
        {args.items.map((item: any, i: number) => (
          <div key={i} className="text-sm text-foreground">
            <span>• {item.name} {item.quantity} - {Math.round(item.calories)} cal</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <div className="font-medium text-foreground">
          Total: {Math.round(args.totalCalories)} calories
        </div>
        {!isStealthMode && (
          <div className="text-xs text-muted-foreground mt-1">
            {Math.round(args.totalProtein)}g protein • {Math.round(args.totalCarbs)}g carbs • {Math.round(args.totalFat)}g fat
          </div>
        )}
      </div>
      <div className="mt-4 space-y-2">
        <div className="text-sm text-foreground mb-3">
          Should I log this as your {args.mealType}?
        </div>
        <Button
          className="w-full h-12 text-base font-medium transition-opacity hover:opacity-80"
          variant="default"
          onClick={onConfirm}
          disabled={isStreaming}
        >
          <Check className="h-5 w-5 mr-2" />
          Yes, log it!
        </Button>
        <Button
          variant="ghost"
          onClick={onReject}
          disabled={isStreaming}
          className="w-full h-8 text-sm text-muted-foreground transition-opacity hover:opacity-80 hover:text-destructive"
          size="sm"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Not accurate
        </Button>
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
  // Remove showScrollToBottom - we'll use !isAtBottom instead
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [onboardingHeight, setOnboardingHeight] = useState(0);
  const [inputAreaHeight, setInputAreaHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Duplicate prevention tracking
  const [activeLogRequests, setActiveLogRequests] = useState<Set<string>>(new Set());
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null); // Track active upload
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onboardingRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
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
    rejectedFoodLogs,
    setRejectedFoodLogs
  } = useChat();
  
  // Convex queries - only run when authenticated (strict check)
  const skipQueries = !isSignedIn || isSignedIn === undefined;
  
  const profile = useQuery(api.userProfiles.getUserProfile, skipQueries ? "skip" : {});
  const todayStats = useQuery(api.foodLogs.getTodayStats, skipQueries ? "skip" : undefined);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight, skipQueries ? "skip" : undefined);
  const preferences = useQuery(api.userPreferences.getUserPreferences, skipQueries ? "skip" : undefined);
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus, skipQueries ? "skip" : undefined);
  const dailySummary = useQuery(api.dailySummary.getDailySummary, skipQueries ? "skip" : {});
  const sessionStats = useQuery(api.chatSessions.getSessionStats, skipQueries ? "skip" : undefined);
  const hasLoggedWeightToday = useQuery(api.weightLogs.hasLoggedWeightToday, skipQueries ? "skip" : undefined);
  const subscription = useQuery(api.subscriptions.fetchUserSubscription, skipQueries ? "skip" : undefined);
  const subscriptionStatus = { hasActiveSubscription: subscription?.status === "active" };
  const pendingConfirmations = useQuery(api.pendingConfirmations.getLatestPendingConfirmation, 
    skipQueries || !threadId ? "skip" : { threadId }
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
  const createNewThread = useMutation(api.threads.createNewThread);
  const logFood = useMutation(api.foodLogs.logFood);
  const saveMessage = useMutation(api.threads.saveMessage);
  const confirmPendingConfirmation = useMutation(api.pendingConfirmations.confirmPendingConfirmation);
  const expirePendingConfirmation = useMutation(api.pendingConfirmations.expirePendingConfirmation);
  
  // Query for thread messages - load when we have a thread ID and are authenticated
  const [shouldLoadThreadMessages, setShouldLoadThreadMessages] = useState(true);
  const threadMessages = useQuery(api.threads.getThreadMessages, 
    isSignedIn && threadId && shouldLoadThreadMessages ? { threadId } : "skip"
  );
  
  // Get all storage IDs from messages that need image URLs
  const storageIdsFromMessages = messages
    .filter(msg => msg.storageId)
    .map(msg => msg.storageId as Id<"_storage">);
    
  // Query to get image URLs for all storage IDs
  const imageUrls = useQuery(
    api.files.getMultipleImageUrls, 
    isSignedIn && storageIdsFromMessages.length > 0 
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

  // Give new users time for profile creation and subscription webhook
  useEffect(() => {
    // Only proceed if we're signed in
    if (isSignedIn === false) return;
    
    // Wait for profile to load (undefined means still loading)
    if (profile === undefined) return;
    
    // Set initial load to false immediately for all users
    setIsInitialLoad(false);
  }, [profile, isSignedIn]);

  // Check subscription status after initial load period
  useEffect(() => {
    console.log('[Chat] Subscription check:', {
      isSignedIn,
      isInitialLoad,
      subscription: subscription ? { status: subscription.status, polarId: subscription.polarId } : null,
      subscriptionStatus,
      profile: profile ? 'loaded' : profile === undefined ? 'loading' : 'null',
      skipQueries
    });
    
    // Skip if not fully authenticated yet
    if (!isSignedIn || isSignedIn === undefined || isInitialLoad) return;
    
    // Skip if subscription is still loading  
    if (subscription === undefined) {
      console.log('[Chat] Subscription still loading...');
      return;
    }
    
    // Skip if profile is still loading (new users need profile first)
    if (profile === undefined) {
      console.log('[Chat] Profile still loading...');
      return;
    }
    
    // Only redirect if we're sure there's no active subscription
    if (!subscriptionStatus.hasActiveSubscription) {
      console.log('[Chat] Redirecting to pricing - no active subscription');
      router.push("/pricing");
    }
  }, [isInitialLoad, subscription, subscriptionStatus, router, isSignedIn, profile, skipQueries]);

  // Clear any old localStorage data on mount to prevent cross-user data leakage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for old confirmations from previous days and clear them
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          // Only keep today's confirmations
          if (parsed.date !== today) {
            logger.info('[Chat] Clearing old confirmations from previous day:', parsed.date);
            localStorage.removeItem('foodConfirmations');
          }
        } catch (e) {
          logger.error('[Chat] Error checking saved confirmations:', e);
          localStorage.removeItem('foodConfirmations');
        }
      }
    }
  }, []);
  
  // Track if we've synced messages for this thread
  const [syncedThreadId, setSyncedThreadId] = useState<string | null>(null);
  
  // Track if we're at bottom for auto-scroll
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [justScrolledUser, setJustScrolledUser] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Transform to push container up
  const [containerTransform, setContainerTransform] = useState(0);
  const containerTransformRef = useRef(0);
  const justScrolledUserRef = useRef(false);
  
  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []);
  
  // Load thread messages from Convex when available or thread changes
  useEffect(() => {
    // Skip if threadMessages is not ready yet
    if (!threadMessages) return;
    
    // If thread changed and we need to sync
    if (threadId && syncedThreadId !== threadId) {
      logger.info(`[Chat] Thread changed from ${syncedThreadId} to ${threadId}`);
      
      // If threadMessages is empty, this is a new thread - keep existing messages (like greeting)
      if (threadMessages.length === 0) {
        logger.info(`[Chat] New thread with no messages - keeping existing messages (${messages.length} messages)`);
        setSyncedThreadId(threadId);
        setHasLoadedHistory(true);
        // Confirmed states are now initialized in ChatProvider from localStorage
        return;
      }
      
      // Load messages from Convex
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
      
      // Scroll to bottom after loading messages from database
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
      
      // Restore confirmed/rejected states from localStorage after loading messages
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date === today) {
            if (parsed.confirmed && parsed.confirmed.length > 0) {
              logger.info('[Chat] Restoring confirmed states after loading messages:', parsed.confirmed);
              setConfirmedFoodLogs(prev => new Set([...prev, ...parsed.confirmed]));
            }
            if (parsed.rejected && parsed.rejected.length > 0) {
              logger.info('[Chat] Restoring rejected states after loading messages:', parsed.rejected);
              setRejectedFoodLogs(prev => new Set([...prev, ...parsed.rejected]));
            }
          }
        } catch (e) {
          logger.error('Error restoring confirmation states:', e);
        }
      }
    }
    
    // Also handle initial load when we have no messages at all
    if (messages.length === 0 && threadMessages && threadMessages.length > 0) {
      logger.info(`[Chat] Initial load: Loading ${threadMessages.length} messages from Convex`);
      
      const loadedMessages = threadMessages.map((msg: any) => {
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
          toolCalls: msg.toolCalls || undefined,
          storageId: msg.metadata?.storageId
        };
      });
      
      setMessages(loadedMessages);
      setHasLoadedHistory(true);
      setSyncedThreadId(threadId);
      
      // Scroll to bottom after loading messages from database
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
      
      // Restore confirmed/rejected states from localStorage after loading messages
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          if (parsed.date === today) {
            if (parsed.confirmed && parsed.confirmed.length > 0) {
              logger.info('[Chat] Restoring confirmed states after loading messages:', parsed.confirmed);
              setConfirmedFoodLogs(prev => new Set([...prev, ...parsed.confirmed]));
            }
            if (parsed.rejected && parsed.rejected.length > 0) {
              logger.info('[Chat] Restoring rejected states after loading messages:', parsed.rejected);
              setRejectedFoodLogs(prev => new Set([...prev, ...parsed.rejected]));
            }
          }
        } catch (e) {
          logger.error('Error restoring confirmation states:', e);
        }
      }
    }
  }, [threadMessages, messages.length, setMessages, threadId, syncedThreadId, scrollToBottom, setConfirmedFoodLogs, setRejectedFoodLogs]);
  
  // Apply theme from preferences
  useEffect(() => {
    if (preferences?.darkMode !== undefined) {
      const theme = preferences.darkMode ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', preferences.darkMode);
    }
  }, [preferences?.darkMode]);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const threshold = 50; // pixels from bottom
    const atBottom = scrollHeight - clientHeight - scrollTop < threshold;
    setIsAtBottom(atBottom);
  }, []);
  
  // Handle scroll events
  useEffect(() => {
    const scrollElement = scrollAreaRef.current;
    if (!scrollElement) return;
    
    const handleScroll = () => {
      checkIfAtBottom();
    };
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [checkIfAtBottom]);

  // Get or create daily thread on mount (only if no thread exists at all)
  useEffect(() => {
    const initThread = async () => {
      // Skip if we already have a thread or are waiting for preferences to load
      if (threadId || !profile || preferences === undefined) {
        return;
      }
      
      // If preferences loaded and has a saved thread, don't create daily thread
      // (The previous useEffect will handle checking if it's from today)
      if (preferences?.agentThreadId) {
        const threadTimestamp = parseInt(preferences.agentThreadId.split('_').pop() || '0');
        const threadDate = threadTimestamp ? new Date(threadTimestamp).toISOString().split('T')[0] : null;
        const today = new Date().toISOString().split('T')[0];
        
        if (threadDate === today) {
          logger.info(`[Chat] Skipping daily thread - saved thread exists from today: ${preferences.agentThreadId}`);
          return;
        }
      }
      
      // Only create daily thread if no saved thread exists or saved thread is old
      try {
        const result = await getOrCreateDailyThread({});
        if (result.threadId) {
          logger.info(`[Chat] Creating daily thread: ${result.threadId}`);
          setThreadId(result.threadId);
          // Don't save this as agentThreadId - daily threads are not persisted
        }
      } catch (error) {
        logger.error('Failed to get/create daily thread:', error);
      }
    };
    
    initThread();
  }, [profile, threadId, preferences, getOrCreateDailyThread, setThreadId]);

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
        if (currentConfirmations.length > 0 || (confirmedFoodLogs.size > 0 && !hasToolCallsInMessages) || (rejectedFoodLogs.size > 0 && !hasToolCallsInMessages)) {
          const persistData = {
            date: today,
            threadId: threadId, // Add thread ID to make confirmations thread-specific
            confirmations: currentConfirmations,
            confirmed: Array.from(confirmedFoodLogs),
            rejected: Array.from(rejectedFoodLogs)
          };
          
          // Check if the state has actually changed
          const stateString = JSON.stringify(persistData);
          if (stateString !== lastSavedStateRef.current) {
            logger.debug('Saving confirmed/rejected bubbles to localStorage:', {
              confirmed: Array.from(confirmedFoodLogs),
              rejected: Array.from(rejectedFoodLogs)
            });
            localStorage.setItem('foodConfirmations', JSON.stringify(persistData));
            lastSavedStateRef.current = stateString;
          }
        } else if (hasToolCallsInMessages && currentConfirmations.length === 0 && confirmedFoodLogs.size === 0 && rejectedFoodLogs.size === 0) {
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
  }, [confirmedFoodLogs, rejectedFoodLogs, messages, threadId]);

  // Load thread ID from preferences
  useEffect(() => {
    if (preferences?.agentThreadId && !threadId) {
      // Check if the saved thread is from today
      const today = new Date().toISOString().split('T')[0];
      
      // Extract date from thread ID if possible (thread IDs include timestamp)
      // Format: thread_userId_timestamp
      const threadTimestamp = parseInt(preferences.agentThreadId.split('_').pop() || '0');
      const threadDate = threadTimestamp ? new Date(threadTimestamp).toISOString().split('T')[0] : null;
      
      // If thread is from a previous day, don't load it - let daily thread be created
      if (threadDate && threadDate !== today) {
        logger.info(`[Chat] Saved thread is from previous day (${threadDate}), will create new daily thread`);
        // Clear the old thread from preferences
        saveAgentThreadId({ threadId: '' }).catch(err => 
          logger.error('Failed to clear old thread:', err)
        );
        return;
      }
      
      logger.info(`[Chat] Loading saved thread from preferences: ${preferences.agentThreadId}`);
      setThreadId(preferences.agentThreadId);
    }
  }, [preferences?.agentThreadId, threadId, setThreadId, saveAgentThreadId]);

  // Create or check daily session on mount
  useEffect(() => {
    const initializeSession = async () => {
      // Only run once profile is loaded, chat history has been checked, and we have a thread ID
      if (profile && hasLoadedHistory && dailySummary !== undefined && threadId) {
        try {
          // This will create a new session if needed or return existing one
          const session = await getOrCreateDailySession({});
          
          // Check if this is a new session for today AND we have no messages
          const today = new Date().toISOString().split('T')[0];
          if (session && session.messageCount === 0 && session.startDate === today && messages.length === 0) {
            // New session with no history - show greeting
            let greeting = `Good morning ${profile?.name || "there"}! 🌅`;
            
            // Add yesterday's summary if available
            if (dailySummary?.yesterday?.stats?.calories > 0 && profile) {
              const yesterday = dailySummary.yesterday.stats;
              const calorieDiff = yesterday.calories - profile.dailyCalorieTarget;
              const proteinDiff = yesterday.protein - profile.proteinTarget;
              
              greeting += ` Yesterday: ${Math.round(yesterday.calories)}cal (${Math.round(yesterday.protein)}p/${Math.round(yesterday.carbs)}c/${Math.round(yesterday.fat)}f). `;
              
              // Add insight based on goals
              if (profile.goal === 'cut') {
                if (calorieDiff > 200) {
                  greeting += `You were ${Math.round(calorieDiff)} calories over target - let's tighten up today! 💪`;
                } else if (calorieDiff >= -200 && calorieDiff <= 0) {
                  greeting += `Great job staying in your deficit! 🎯`;
                }
              } else if (profile.goal === 'gain') {
                if (calorieDiff < -200) {
                  greeting += `You were ${Math.abs(Math.round(calorieDiff))} calories under - need to eat more to gain! 🍽️`;
                } else if (calorieDiff >= 0 && calorieDiff <= 300) {
                  greeting += `Perfect surplus for lean gains! 💪`;
                }
              } else { // maintain
                if (Math.abs(calorieDiff) <= 200) {
                  greeting += `Excellent maintenance! Right on target! ✨`;
                }
              }
            } else {
              greeting += ` Starting fresh for today.`;
            }
            
            if (hasLoggedWeightToday === false) {
              greeting += `\n\nDon't forget to log your weight! ⚖️`;
            }
            
            greeting += `\n\nWhat can I help you with?`;
            
            // Set greeting message only if we truly have no messages
            setMessages([{
              role: "assistant",
              content: greeting,
            }]);
            
            // Save greeting to Convex so it persists
            if (threadId) {
              logger.info('[Chat] Saving greeting message to thread:', threadId);
              try {
                await saveMessage({
                  threadId,
                  role: "assistant",
                  content: greeting,
                });
              } catch (err) {
                logger.error('[Chat] Failed to save greeting message:', err);
              }
            }
            
            // Clear any persisted confirmations from previous day to prevent auto-confirm bug
            localStorage.removeItem('foodConfirmations');
            setConfirmedFoodLogs(new Set());
            setRejectedFoodLogs(new Set());
          }
        } catch (error) {
          logger.error("Error initializing session:", error);
        }
      }
    };
    
    initializeSession();
  }, [profile, hasLoggedWeightToday, hasLoadedHistory, dailySummary, messages.length, preferences, threadId, saveMessage, getOrCreateDailySession, setMessages, setConfirmedFoodLogs, setRejectedFoodLogs]);



  // Initialize with daily summary instead of full history
  useEffect(() => {
    // Use ref to prevent double execution in StrictMode
    if (loadingRef.current) return;
    
    // Only initialize if we haven't loaded from Convex yet
    if (dailySummary && !hasLoadedHistory && messages.length === 0) {
      loadingRef.current = true;
      logger.info('[Chat] Initializing chat - no existing messages');
      
      // If we have a threadId or saved thread in preferences, wait for messages to load from Convex
      if (threadId || preferences?.agentThreadId) {
        logger.info('[Chat] Have threadId or saved thread, waiting for Convex messages');
        return;
      }
      
      // Only show greeting if no messages exist
      let greeting = '';
      if (messages.length === 0) {
        logger.info('[Chat] No messages found, showing greeting');
        
        // Build initial greeting with context
        greeting = `Good morning ${dailySummary.profile?.name || 'there'}! `;
        
        if (dailySummary.yesterday.stats.calories > 0 && dailySummary.profile) {
          const yesterday = dailySummary.yesterday.stats;
          const target = dailySummary.profile.dailyCalorieTarget;
          const proteinTarget = dailySummary.profile.proteinTarget;
          
          greeting += `Yesterday: ${dailySummary.yesterday.total}. `;
          
          // Add insight based on goals
          const calorieDiff = yesterday.calories - target;
          const proteinDiff = yesterday.protein - proteinTarget;
          
          if (dailySummary.profile.goal === 'cut') {
            if (calorieDiff > 200) {
              greeting += `You were ${Math.round(calorieDiff)} calories over target - let's tighten up today! 💪 `;
            } else if (calorieDiff < -500) {
              greeting += `You were ${Math.abs(Math.round(calorieDiff))} calories under - make sure you're eating enough! `;
            } else if (calorieDiff >= -200 && calorieDiff <= 0) {
              greeting += `Great job staying in your deficit! 🎯 `;
            }
          } else if (dailySummary.profile.goal === 'gain') {
            if (calorieDiff < -200) {
              greeting += `You were ${Math.abs(Math.round(calorieDiff))} calories under - need to eat more to gain! 🍽️ `;
            } else if (calorieDiff >= 0 && calorieDiff <= 300) {
              greeting += `Perfect surplus for lean gains! 💪 `;
            } else if (calorieDiff > 500) {
              greeting += `You were ${Math.round(calorieDiff)} calories over - careful not to gain too fast! `;
            }
          } else { // maintain
            if (Math.abs(calorieDiff) <= 200) {
              greeting += `Excellent maintenance! Right on target! ✨ `;
            } else if (calorieDiff > 200) {
              greeting += `You were ${Math.round(calorieDiff)} calories over maintenance. `;
            } else {
              greeting += `You were ${Math.abs(Math.round(calorieDiff))} calories under maintenance. `;
            }
          }
          
          // Protein insight
          if (proteinDiff < -20) {
            greeting += `Try to hit your protein target today (${proteinTarget}g). `;
          } else if (proteinDiff >= -10) {
            greeting += `Great protein intake! 🥩 `;
          }
        }
        
        if (!dailySummary.today.hasWeighedIn) {
          greeting += `\n\nDon't forget to log your weight today! ⚖️`;
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
  }, [dailySummary, onboardingStatus, hasLoadedHistory, messages.length, threadId, isOnboarding, preferences, setConfirmedFoodLogs, setMessages]);

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

  // Measure input area height
  useEffect(() => {
    const measureInputArea = () => {
      if (inputAreaRef.current && scrollAreaRef.current) {
        const oldHeight = inputAreaHeight || 0;
        const newHeight = inputAreaRef.current.offsetHeight;
        
        // Only update if height actually changed
        if (oldHeight !== newHeight) {
          const container = scrollAreaRef.current;
          const { scrollTop, scrollHeight, clientHeight } = container;
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
          const scrollBottom = scrollHeight - scrollTop - clientHeight;
          
          setInputAreaHeight(newHeight);
          
          // Maintain scroll position relative to bottom
          if (!isNearBottom) {
            // User has scrolled up - maintain their position
            requestAnimationFrame(() => {
              if (scrollAreaRef.current) {
                const newScrollHeight = scrollAreaRef.current.scrollHeight;
                scrollAreaRef.current.scrollTop = newScrollHeight - clientHeight - scrollBottom;
              }
            });
          }
        }
      }
    };

    let resizeObserver: ResizeObserver | null = null;

    // Set up observer when component mounts
    const setupObserver = () => {
      measureInputArea(); // Initial measurement
      
      if (inputAreaRef.current) {
        resizeObserver = new ResizeObserver((entries) => {
          measureInputArea();
        });
        
        resizeObserver.observe(inputAreaRef.current);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      setupObserver();
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [inputAreaHeight]); // Include inputAreaHeight to track changes

  // Force remeasure when image preview changes
  useEffect(() => {
    if (inputAreaRef.current) {
      const height = inputAreaRef.current.offsetHeight;
      setInputAreaHeight(height);
    }
  }, [imagePreview]);

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
    
    // Check if user is correcting/rejecting a food log
    const correctionPatterns = [
      /actually it was/i,
      /no,? it was/i,
      /change that to/i,
      /make it/i,
      /should be/i,
      /not .+, it('s| was)/i,
      /send a new one/i,
      /try again/i,
      /that('s| is) wrong/i,
      /that('s| is) not right/i,
      /instead of/i,
      /correction:/i
    ];
    
    const isCorrection = correctionPatterns.some(pattern => pattern.test(userMessage));
    
    // Auto-reject the last pending confirmation if user is correcting
    if (isCorrection) {
      const lastPendingConfirmation = messages
        .map((msg, idx) => ({ msg, idx }))
        .reverse()
        .find(({ msg, idx }) => {
          const confirmCall = msg.toolCalls?.find(tc => 
            tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto"
          );
          if (confirmCall && confirmCall.args && !confirmCall.args.error) {
            const confirmId = getConfirmationId(confirmCall.args, idx);
            return !confirmedFoodLogs.has(confirmId) && !rejectedFoodLogs.has(confirmId);
          }
          return false;
        });
      
      if (lastPendingConfirmation) {
        const confirmCall = lastPendingConfirmation.msg.toolCalls?.find(tc => 
          tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto"
        );
        if (confirmCall) {
          const confirmId = getConfirmationId(confirmCall.args, lastPendingConfirmation.idx);
          logger.info('[Chat] Auto-rejecting confirmation due to correction:', confirmId);
          setRejectedFoodLogs(prev => new Set(prev).add(confirmId));
        }
      }
    }
    
    // Check if this is a confirmation message
    const isConfirmationMessage = /^(yes|yep|yeah|confirm|ok|correct|right|sure)$/i.test(userMessage.toLowerCase().trim());
    
    // If NOT a confirmation and we have pending confirmations, expire them
    if (!isConfirmationMessage && pendingConfirmations) {
      try {
        await expirePendingConfirmation({ confirmationId: pendingConfirmations._id });
      } catch (err) {
        logger.warn('[Chat] Could not expire pending confirmation:', err);
      }
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
      
      // The transform will be handled by the useEffect that watches for new user messages
    } catch (error) {
      logger.error("Error sending message:", error);
      // Add error message
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    }
  };

  // Handle assistant messages - reduce transform if content is cut off
  useEffect(() => {
    if (messages.length > 0 && scrollAreaRef.current) {
      const lastMessage = messages[messages.length - 1];
      
      // Only handle assistant messages
      if (lastMessage.role === 'assistant' || lastMessage.isStreaming) {
        // Don't do anything if we just pushed for a user message
        if (!justScrolledUserRef.current && containerTransformRef.current > 0) {
          // Check if content is being cut off at the bottom
          const container = scrollAreaRef.current;
          const { scrollHeight, clientHeight } = container;
          
          // If there's content below the viewport, gradually reduce transform
          if (scrollHeight > clientHeight) {
            // Calculate how much content is cut off
            const contentBelowViewport = scrollHeight - clientHeight;
            
            // Reduce transform by a portion of the cut-off content
            const reduction = Math.min(containerTransformRef.current, contentBelowViewport * 0.5);
            const newTransform = Math.max(0, containerTransformRef.current - reduction);
            
            console.log('📉 Reducing transform for assistant:', {
              contentBelowViewport,
              reduction,
              newTransform
            });
            
            if (reduction > 0) {
              setContainerTransform(newTransform);
              containerTransformRef.current = newTransform;
            }
          }
        }
      }
    }
  }, [messages]);
  
  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []); // Only on mount
  
  // Watch for new user messages and push them to top with transform
  const previousMessageCount = useRef(0);
  useEffect(() => {
    if (messages.length > previousMessageCount.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Check if the new message is from the user
      if (lastMessage.role === 'user') {
        // Use requestAnimationFrame to ensure DOM has painted
        requestAnimationFrame(() => {
          // Double RAF to ensure layout is complete
          requestAnimationFrame(() => {
            if (scrollAreaRef.current) {
              const userMessages = scrollAreaRef.current.querySelectorAll('.items-end');
              if (userMessages.length > 0) {
                const lastUserMessage = userMessages[userMessages.length - 1] as HTMLElement;
                if (lastUserMessage) {
                  // Get positions
                  const messageRect = lastUserMessage.getBoundingClientRect();
                  const containerRect = scrollAreaRef.current.getBoundingClientRect();
                  
                  // Calculate how far the message is from the top of the container
                  const distanceFromTop = messageRect.top - containerRect.top;
                  
                  // Only apply transform if the message is actually visible
                  if (distanceFromTop > 0) {
                    // Add this distance to our transform to push everything up
                    const newTransform = containerTransformRef.current + distanceFromTop;
                    
                    console.log('🎯 [useEffect] Push to top with transform:', {
                      distanceFromTop,
                      currentTransform: containerTransformRef.current,
                      newTransform
                    });
                    
                    // Apply the transform
                    setContainerTransform(newTransform);
                    containerTransformRef.current = newTransform;
                    
                    setIsAtBottom(false);
                    setJustScrolledUser(true);
                    justScrolledUserRef.current = true;
                    
                    // Reset the flag after animation completes
                    setTimeout(() => {
                      setJustScrolledUser(false);
                      justScrolledUserRef.current = false;
                    }, 1000);
                  }
                }
              }
            }
          });
        });
      }
    }
    
    previousMessageCount.current = messages.length;
  }, [messages]);

  // Scroll to bottom when input area changes (if at bottom)
  useEffect(() => {
    if (inputAreaHeight > 0 && isAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [inputAreaHeight, isAtBottom, scrollToBottom]);
  
  // Additional auto-scroll check (this might be the missing one)
  useEffect(() => {
    if (messages.length > 0 && isAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, isAtBottom, scrollToBottom]);

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
  
  // Generate a unique ID for each confirmation
  const getConfirmationId = useCallback((args: any, messageIndex: number, messageContent?: string) => {
    // Create a unique ID based on food content and message index
    const foodNames = args.items?.map((item: any) => item.name).join('-') || '';
    // Use a combination of food details to create a content hash
    const contentHash = `${args.mealType}-${args.totalCalories}-${foodNames}`.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    // Include message index to ensure uniqueness for same food logged multiple times
    // This allows persistence to work properly while preventing auto-confirmation
    return `confirm-${Math.abs(contentHash)}-${messageIndex}`;
  }, []);
  

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
          rejected: Array.from(rejectedFoodLogs)
        }));
      }, 500); // Wait 500ms before saving
      
      return () => clearTimeout(timeoutId);
    }
  }, [messages, confirmedFoodLogs, rejectedFoodLogs, getConfirmationId]);

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
            <h1 className="font-semibold text-lg text-foreground flex items-center gap-3 ml-4">
              <img src="/logo.svg" alt="Bob" className="h-[60px] w-[60px]" />
              Bob
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
              // Check if there are any unconfirmed food logs across ALL messages
              const hasUnconfirmedFoodLogs = messages.some((msg, idx) => {
                const confirmCall = msg.toolCalls?.find(tc => 
                  tc.toolName === "confirmFood" || tc.toolName === "analyzeAndConfirmPhoto"
                );
                if (confirmCall && confirmCall.args && !confirmCall.args.error) {
                  const confirmId = getConfirmationId(confirmCall.args, idx);
                  return !confirmedFoodLogs.has(confirmId) && !rejectedFoodLogs.has(confirmId);
                }
                return false;
              });
              
              let confirmMessage = "Start a new chat? Your food logs will be saved.";
              if (hasUnconfirmedFoodLogs) {
                confirmMessage = "You have unconfirmed food items. Starting a new chat will close these pending confirmations. Continue?";
              }
              
              if (confirm(confirmMessage)) {
                setIsLoading(true);
                try {
                  // Start new session
                  await startNewChatSession();
                  
                  // Create a new thread, passing the current thread ID for summarization
                  const newThreadResult = await createNewThread({
                    previousThreadId: threadId || undefined
                  });
                  
                  // Clear messages with context-aware greeting
                  let greeting = `Hey ${profile?.name || "there"}! Fresh chat started! `;
                  if (newThreadResult.foodLogsCount > 0) {
                    greeting += `I can see you've logged ${newThreadResult.foodLogsCount} items today. `;
                  }
                  greeting += `What can I help you with?`;
                  
                  setMessages([{
                    role: "assistant",
                    content: greeting,
                  }]);
                  
                  // Set the new thread ID
                  setThreadId(newThreadResult.threadId);
                  
                  // Save the new thread ID to preferences so it persists across refreshes
                  logger.info(`[Chat] Saving new thread to preferences: ${newThreadResult.threadId}`);
                  await saveAgentThreadId({ threadId: newThreadResult.threadId });
                  logger.info(`[Chat] Thread saved successfully`);
                  
                  // Save the greeting to Convex so it persists
                  logger.info('[Chat] Saving New Chat greeting to thread');
                  try {
                    await saveMessage({
                      threadId: newThreadResult.threadId,
                      role: "assistant",
                      content: greeting,
                    });
                  } catch (err) {
                    logger.error('[Chat] Failed to save New Chat greeting:', err);
                  }
                  
                  // Clear confirmations for new thread (they're thread-specific)
                  setConfirmedFoodLogs(new Set());
                  setRejectedFoodLogs(new Set());
                  // Don't clear localStorage - let the save effect handle it with new thread context
                  // Enable loading thread messages for the new thread
                  setShouldLoadThreadMessages(true);
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
            <div className="border border-border rounded-lg p-3 text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
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
            <div className="border border-border rounded-lg p-3 text-center flex flex-col justify-center">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
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
          <div className="border border-border rounded-lg p-3">
            <div className="text-xs text-muted-foreground text-center mb-2 flex items-center justify-center gap-1">
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
                      `${Math.round(todayStats?.calories || 0)}/${profile?.dailyCalorieTarget || 2000}`
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
                        `${Math.round(todayStats?.protein || 0)}g/${profile?.proteinTarget || 150}g`
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
                      {Math.round(todayStats?.carbs || 0)}g/{profile?.carbsTarget || 200}g
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
                      {Math.round(todayStats?.fat || 0)}g/{profile?.fatTarget || 65}g
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
        <div ref={scrollAreaRef} className="h-full overflow-y-auto overflow-x-hidden">
          <div 
            className="max-w-lg mx-auto px-4 pt-4 space-y-4"
            style={{ 
              transform: `translateY(-${containerTransform}px)`,
              transition: 'transform 0.3s ease-out'
            }}>
        <ClientOnly>
          <AnimatePresence initial={false}>
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
              const isRejected = rejectedFoodLogs.has(confirmId);
              
              // Always show confirmations - persistence handles old ones
              // Don't filter based on date here since we already handle that in loading
              
              return (
                <div key={index}>
                  {/* Food confirmation card only - no duplicate message */}
                  <div className="flex justify-start">
                    <ConfirmationBubble
                      args={args}
                      confirmId={confirmId}
                      isConfirmed={isConfirmed}
                      isRejected={isRejected}
                      isStealthMode={isStealthMode}
                      isStreaming={isStreaming}
                      onReject={() => {
                        // Mark as rejected
                        flushSync(() => {
                          setRejectedFoodLogs(prev => new Set(prev).add(confirmId));
                        });
                        
                        // Add a message to guide the user
                        setMessages(prev => [...prev, {
                          role: "assistant",
                          content: "No problem! Please tell me what was incorrect so I can update it."
                        }]);
                      }}
                      onConfirm={async () => {
                        // Check if already processing this request
                        const requestKey = `${confirmId}-${Date.now()}`;
                        if (activeLogRequests.has(confirmId)) {
                          logger.warn('[Chat] Already processing this confirmation:', confirmId);
                          return;
                        }
                        
                        // Mark as processing with flushSync for immediate mobile rendering
                        setActiveLogRequests(prev => new Set(prev).add(confirmId));
                        flushSync(() => {
                          setConfirmedFoodLogs(prev => new Set(prev).add(confirmId));
                        });
                        setIsLoading(true);
                        
                        try {
                          // Use original data
                          const finalItems = args.items;
                          const finalCalories = args.totalCalories;
                          const finalProtein = args.totalProtein;
                          const finalCarbs = args.totalCarbs;
                          const finalFat = args.totalFat;
                          
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
                          
                          // Add a success message with rounded numbers
                          const caloriesRemaining = Math.round((profile?.dailyCalorieTarget || 2000) - ((todayStats?.calories || 0) + finalCalories));
                          const encouragements = [
                            "Great job tracking! 💪",
                            "You're doing awesome! 🌟", 
                            "Keep it up! 🎯",
                            "Nice logging! 👏",
                            "Way to stay on track! 🚀"
                          ];
                          const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
                          const successMessage = `${caloriesRemaining} calories left today. ${randomEncouragement}`;
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
                          
                          // Clear pending confirmation if exists - CRITICAL for preventing auto-confirm bug
                          logger.info('[Chat] Checking for pending confirmations to clear:', {
                            hasMutation: !!confirmPendingConfirmation,
                            hasPendingConfirmations: !!pendingConfirmations,
                            pendingConfirmationId: pendingConfirmations?._id
                          });
                          
                          if (confirmPendingConfirmation && pendingConfirmations) {
                            try {
                              logger.info('[Chat] Calling confirmPendingConfirmation with ID:', pendingConfirmations._id);
                              await confirmPendingConfirmation({ confirmationId: pendingConfirmations._id });
                              logger.info('[Chat] Successfully marked pending confirmation as confirmed');
                            } catch (err) {
                              logger.error('[Chat] Failed to clear pending confirmation:', err);
                            }
                          } else {
                            logger.warn('[Chat] No pending confirmation to clear - this might be the issue!');
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
              key={message.toolCalls?.[0]?.toolCallId || `msg-${index}`}
              className={cn(
                "flex flex-col gap-1",
                message.role === "user" ? "items-end -mr-2" : "items-start"
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
        </AnimatePresence>
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
          {/* Dynamic spacer for input area - includes bottom padding */}
          <div style={{ height: `${(inputAreaHeight || 150) + 40}px` }} />
        </div>
      </div>
      

      {/* Quick Responses for Onboarding */}
      {isOnboarding && currentOnboardingStep && (
        <div ref={onboardingRef} className="fixed left-0 right-0 bg-background/90 backdrop-blur-sm shadow-lg z-20" style={{ bottom: "calc(70px + 4rem + 2.5rem)" }}>
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
      {!isAtBottom && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => {
            scrollToBottom();
            setIsAtBottom(true);
          }}
          className="fixed right-4 bg-muted border border-border text-foreground rounded-full p-2 shadow-md transition-all duration-200 hover:bg-muted/80 focus:outline-none focus:ring-0"
          style={{ 
            zIndex: 20, 
            bottom: `${(inputAreaHeight || 150) + 60}px` 
          }}
        >
          <ChevronDown className="h-5 w-5" />
        </motion.button>
      )}
      
      {/* Input Area - Fixed at bottom */}
      <div ref={inputAreaRef} className="fixed bottom-0 left-0 right-0 bg-background border-t border-border" style={{ paddingBottom: "calc(70px + env(safe-area-inset-bottom))" }}>
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