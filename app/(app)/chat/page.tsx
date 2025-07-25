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
import {
  Camera,
  Paperclip,
  ArrowUp,
  X,
  Check,
  Settings,
  PenSquare,
  ChevronDown,
  Target,
  Scale,
  Flame,
  Dumbbell,
  Wheat,
  Droplet,
  RefreshCw,
  Sparkles,
  HelpCircle,
  FileText,
  LogOut,
  Square,
  RotateCcw,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/app/components/ui/collapsible";
import { ClientOnly } from "~/app/components/ClientOnly";
import { ProfileEditModal } from "~/app/components/ProfileEditModal";
import { MarkdownMessage } from "~/app/components/MarkdownMessage";
import { ThemeToggle } from "~/app/components/ThemeToggle";
import { useChat } from "~/app/providers/ChatProvider";
import { logger } from "~/app/utils/logger";
import { BottomNav } from "~/app/components/BottomNav";
import { OnboardingQuickResponses } from "~/app/components/OnboardingQuickResponses";
import { AuthSyncHandler } from "~/app/components/AuthSyncHandler";

interface Message {
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

// Memoized message component to prevent unnecessary re-renders
const ChatMessage = memo(
  ({
    message,
    index,
    imageUrl,
    onToolAction,
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
          className="flex flex-col items-end gap-2 max-w-[85%] ml-auto"
        >
          {imageUrl && (
            <div className="ml-auto">
              <img
                src={imageUrl}
                alt="User uploaded"
                className="rounded-xl shadow-sm ml-auto"
                style={{
                  maxHeight: "120px",
                  maxWidth: "120px",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {message.content && message.content !== "[Photo uploaded]" && (
            <div
              className={cn(
                "px-4 py-1",
                "bg-muted text-foreground",
                "rounded-2xl rounded-br-sm",
                "shadow-sm border border-border",
                "text-[15px] leading-relaxed text-left",
                "whitespace-pre-wrap break-words",
              )}
            >
              {message.content.startsWith("{") &&
              message.content.includes("_isOnboardingData")
                ? "Preferences saved"
                : message.content}
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
        className="flex justify-start"
      >
        <div className="max-w-[85%] space-y-2">
          {message.activeToolCall && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {message.activeToolCall.status === "calling" ? (
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
            <MarkdownMessage
              content={message.content}
              className="text-[15px]"
            />
          </div>
        </div>
      </motion.div>
    );
  },
);

ChatMessage.displayName = "ChatMessage";

// Memoized confirmation bubble component with custom comparison
const ConfirmationBubble = memo(
  ({
    args,
    confirmId,
    isConfirmed,
    isRejected,
    isStealthMode,
    onConfirm,
    onReject,
    isStreaming,
  }: any) => {
    // Performance monitoring in development
    if (process.env.NODE_ENV === "development") {
      logger.debug(`[ConfirmationBubble] Rendering ${confirmId}`, {
        isConfirmed,
        isRejected,
        timestamp: new Date().toISOString(),
      });
    }

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
              <span>
                • {item.name} {item.quantity} - {Math.round(item.calories)} cal
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <div className="font-medium text-foreground">
            Total: {Math.round(args.totalCalories)} calories
          </div>
          {!isStealthMode && (
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(args.totalProtein)}g protein •{" "}
              {Math.round(args.totalCarbs)}g carbs • {Math.round(args.totalFat)}
              g fat
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
  },
  // Custom comparison to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.confirmId === nextProps.confirmId &&
      prevProps.isConfirmed === nextProps.isConfirmed &&
      prevProps.isRejected === nextProps.isRejected &&
      prevProps.isStealthMode === nextProps.isStealthMode &&
      prevProps.isStreaming === nextProps.isStreaming &&
      JSON.stringify(prevProps.args) === JSON.stringify(nextProps.args)
    );
  },
);

ConfirmationBubble.displayName = "ConfirmationBubble";

function Chat() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  // State - Define before using in queries
  const [input, setInput] = useState("");
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const loadingRef = useRef(false); // Prevent double loads in StrictMode
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  // Remove showScrollToBottom - we'll use !isAtBottom instead
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [inputAreaHeight, setInputAreaHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isNutritionCollapsed, setIsNutritionCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nutritionCollapsed");
      // If no stored preference, default to collapsed (true)
      return stored === null ? true : stored === "true";
    }
    return true; // Default to collapsed
  });

  // Duplicate prevention tracking
  const [activeLogRequests, setActiveLogRequests] = useState<Set<string>>(
    new Set(),
  );
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null); // Track active upload
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSentMessageRef = useRef<{
    content: string;
    timestamp: number;
  } | null>(null);

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
    setRejectedFoodLogs,
  } = useChat();

  // Convex queries - only run when authenticated (strict check)
  // Memoize to prevent recalculation on every render
  const skipQueries = useMemo(
    () => !isSignedIn || isSignedIn === undefined,
    [isSignedIn],
  );

  const profile = useQuery(
    api.userProfiles.getUserProfile,
    skipQueries ? "skip" : {},
  );
  const todayStats = useQuery(
    api.foodLogs.getTodayStats,
    skipQueries ? "skip" : undefined,
  );
  const latestWeight = useQuery(
    api.weightLogs.getLatestWeight,
    skipQueries ? "skip" : undefined,
  );
  const preferences = useQuery(
    api.userPreferences.getUserPreferences,
    skipQueries ? "skip" : undefined,
  );
  const onboardingStatus = useQuery(
    api.onboarding.getOnboardingStatus,
    skipQueries ? "skip" : undefined,
  );
  const dailySummary = useQuery(
    api.dailySummary.getDailySummary,
    skipQueries ? "skip" : {},
  );
  const sessionStats = useQuery(
    api.chatSessions.getSessionStats,
    skipQueries ? "skip" : undefined,
  );
  const hasLoggedWeightToday = useQuery(
    api.weightLogs.hasLoggedWeightToday,
    skipQueries ? "skip" : undefined,
  );
  const subscription = useQuery(
    api.subscriptions.fetchUserSubscription,
    skipQueries ? "skip" : undefined,
  );
  const subscriptionStatus = {
    hasActiveSubscription: subscription?.status === "active",
  };
  const pendingConfirmations = useQuery(
    api.pendingConfirmations.getLatestPendingConfirmation,
    skipQueries || !threadId ? "skip" : { threadId },
  );
  const confirmedBubblesFromDB = useQuery(
    api.confirmedBubbles.getConfirmedBubbles,
    skipQueries || !threadId ? "skip" : { threadId },
  );

  // Convex action for Agent SDK (not used with streaming)
  // const sendMessageAction = useAction(api.agentActions.chat);

  // Convex mutations for file upload
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const storeFileId = useMutation(api.files.storeFileId);
  const resetOnboarding = useMutation(api.onboarding.resetOnboarding);
  const forceCompleteOnboarding = useMutation(
    api.onboardingFix.forceCompleteOnboarding,
  );
  const saveOnboardingProgress = useMutation(
    api.onboarding.saveOnboardingProgress,
  );
  const updateOnboardingStep = useMutation(api.onboarding.updateOnboardingStep);
  const saveAgentThreadId = useMutation(api.userPreferences.saveAgentThreadId);
  const startNewChatSession = useMutation(api.chatSessions.startNewChatSession);
  const getOrCreateDailySession = useMutation(
    api.chatSessions.getOrCreateDailySession,
  );
  const updateTheme = useMutation(api.userPreferences.updateTheme);
  const getOrCreateDailyThread = useMutation(
    api.threads.getOrCreateDailyThread,
  );
  const createNewThread = useMutation(api.threads.createNewThread);
  const logFood = useMutation(api.foodLogs.logFood);
  const saveMessage = useMutation(api.threads.saveMessage);
  const confirmPendingConfirmation = useMutation(
    api.pendingConfirmations.confirmPendingConfirmation,
  );
  const expirePendingConfirmation = useMutation(
    api.pendingConfirmations.expirePendingConfirmation,
  );
  const saveConfirmedBubble = useMutation(
    api.confirmedBubbles.saveConfirmedBubble,
  );
  const resetOnboardingDev = useMutation(api.dev.resetOnboarding);

  // Define isOnboarding early to use in useEffects
  // Only consider user as onboarding if we've loaded the status and it's not completed
  const isOnboarding =
    onboardingStatus !== undefined && !onboardingStatus?.completed;
  const isOnboardingLoading = onboardingStatus === undefined;
  const isStealthMode = preferences?.displayMode === "stealth";

  // Auto-advance from welcome to name step
  useEffect(() => {
    if (
      isOnboarding &&
      onboardingStatus?.currentStep === "welcome" &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant"
    ) {
      // Automatically move to name step after welcome message
      updateOnboardingStep({ step: "name" });
    }
  }, [
    isOnboarding,
    onboardingStatus?.currentStep,
    messages,
    updateOnboardingStep,
  ]);

  // Query for thread messages - load when we have a thread ID and are authenticated
  const [shouldLoadThreadMessages, setShouldLoadThreadMessages] =
    useState(true);
  const [threadMessageRetryCount, setThreadMessageRetryCount] = useState(0);
  const threadMessages = useQuery(
    api.threads.getThreadMessages,
    isSignedIn && threadId && shouldLoadThreadMessages ? { threadId } : "skip",
  );

  // Handle empty thread messages with retry for onboarding
  useEffect(() => {
    if (
      threadMessages !== undefined &&
      threadMessages.length === 0 &&
      isOnboarding &&
      threadId &&
      threadMessageRetryCount < 3
    ) {
      // Retry after a short delay to handle eventual consistency
      const timer = setTimeout(() => {
        logger.info(
          `[Chat] Retrying thread messages query (attempt ${threadMessageRetryCount + 1})`,
        );
        setThreadMessageRetryCount((prev) => prev + 1);
        // Force re-query by toggling the flag
        setShouldLoadThreadMessages(false);
        setTimeout(() => setShouldLoadThreadMessages(true), 100);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [threadMessages, isOnboarding, threadId, threadMessageRetryCount]);

  // Get all storage IDs from messages that need image URLs - memoized to prevent unnecessary re-renders
  const storageIdsFromMessages = useMemo(() => {
    const ids = messages
      .filter((msg) => msg.storageId)
      .map((msg) => msg.storageId as Id<"_storage">);
    // Remove duplicates to ensure stable array
    return [...new Set(ids)];
  }, [
    // Create a stable dependency by joining the storage IDs
    messages
      .filter((msg) => msg.storageId)
      .map((msg) => msg.storageId)
      .join(","),
  ]);

  // Query to get image URLs for all storage IDs
  const imageUrls = useQuery(
    api.files.getMultipleImageUrls,
    isSignedIn && storageIdsFromMessages.length > 0
      ? { storageIds: storageIdsFromMessages }
      : "skip",
  );

  // Toggle function for nutrition card
  const toggleNutritionCollapsed = () => {
    const newState = !isNutritionCollapsed;
    setIsNutritionCollapsed(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("nutritionCollapsed", newState.toString());
    }
  };

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
    logger.debug("[Chat] Subscription check:", {
      isSignedIn,
      isInitialLoad,
      subscription: subscription
        ? { status: subscription.status, polarId: subscription.polarId }
        : null,
      subscriptionStatus,
      profile: profile ? "loaded" : profile === undefined ? "loading" : "null",
      skipQueries,
    });

    // Skip if not fully authenticated yet
    if (!isSignedIn || isSignedIn === undefined || isInitialLoad) return;

    // Skip if subscription is still loading
    if (subscription === undefined) {
      logger.debug("[Chat] Subscription still loading...");
      return;
    }

    // Skip if profile is still loading ONLY if we're checking for subscription redirect
    // But allow onboarding to work without a profile
    if (profile === undefined && !onboardingStatus) {
      logger.debug("[Chat] Profile still loading...");
      return;
    }

    // Only redirect if we're sure there's no active subscription
    if (!subscriptionStatus.hasActiveSubscription) {
      logger.info("[Chat] Redirecting to pricing - no active subscription");
      router.push("/pricing");
    }
  }, [
    isInitialLoad,
    subscription,
    subscriptionStatus,
    router,
    isSignedIn,
    profile,
    skipQueries,
  ]);

  // Note: Confirmation state is now managed entirely through Convex
  // No localStorage is used for food confirmations to ensure cross-device consistency

  // Track if we've synced messages for this thread
  const [syncedThreadId, setSyncedThreadId] = useState<string | null>(null);

  // Track if we're at bottom for auto-scroll
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []);

  // Handle touch events to prevent scroll boundary issues
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollAreaRef.current || touchStartYRef.current === null) return;

    const touchY = e.touches[0].clientY;
    const scrollTop = scrollAreaRef.current.scrollTop;
    const scrollHeight = scrollAreaRef.current.scrollHeight;
    const clientHeight = scrollAreaRef.current.clientHeight;
    const isScrollingDown = touchY < touchStartYRef.current;
    const isScrollingUp = touchY > touchStartYRef.current;

    // At the top and trying to scroll up
    if (scrollTop <= 0 && isScrollingUp) {
      e.preventDefault();
      return;
    }

    // At the bottom and trying to scroll down
    if (scrollTop + clientHeight >= scrollHeight - 1 && isScrollingDown) {
      e.preventDefault();
      // Scroll up by 1 pixel to prevent the freeze
      scrollAreaRef.current.scrollTop = scrollHeight - clientHeight - 1;
      return;
    }
  }, []);

  // Generate a unique ID for each confirmation
  const getConfirmationId = useCallback((args: any, messageIndex: number) => {
    // Simplified fallback ID generation for backward compatibility
    // This should rarely be used now that tools generate UUIDs
    const dataString = JSON.stringify({
      mealType: args.mealType,
      totalCalories: args.totalCalories,
      items: args.items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        calories: item.calories,
      })),
    });

    const hash = dataString.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    const fallbackId = `confirm-fallback-${Math.abs(hash)}-${messageIndex}`;
    logger.info("[Chat] Generating legacy fallback confirmation ID:", {
      fallbackId,
      reason: "No confirmationId provided by tool",
      messageIndex,
    });
    return fallbackId;
  }, []);

  // Load thread messages from Convex when available or thread changes
  useEffect(() => {
    // Skip if threadMessages is not ready yet or we've already synced this thread
    if (threadMessages === undefined || syncedThreadId === threadId) return;

    // Skip if no threadId
    if (!threadId) return;

    logger.info(`[Chat] Thread changed from ${syncedThreadId} to ${threadId}`);
    logger.info(`[Chat] threadMessages status:`, {
      threadMessagesLength: threadMessages?.length,
      threadMessagesLoaded: threadMessages !== undefined,
      isOnboarding,
      onboardingStatus,
    });

    // If threadMessages is empty, we're done (greeting will be in messages if it exists)
    if (threadMessages.length === 0) {
      logger.info(`[Chat] New thread with no messages in database`);
      logger.info(`[Chat] Current messages in state:`, messages);
      setSyncedThreadId(threadId);
      setHasLoadedHistory(true);

      // For onboarding, provide a fallback message if none exists
      // BUT only if we've actually loaded thread messages and they're truly empty
      // This prevents the flash of onboarding content while loading
      if (isOnboarding && messages.length === 0 && hasLoadedHistory) {
        logger.info(
          `[Chat] Adding fallback onboarding message (after confirming thread is loaded and empty)`,
        );
        setMessages([
          {
            role: "assistant",
            content:
              "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
          },
        ]);
      }

      return;
    }

    // Load messages from Convex
    logger.info(
      `[Chat] Loading ${threadMessages.length} messages from Convex for thread ${threadId}`,
    );

    // Convert Convex messages to the format expected by the chat UI
    const loadedMessages = threadMessages.map((msg: any) => {
      // Log if we have toolCalls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        logger.info(`[Chat] Loading message with toolCalls:`, {
          messageContent: msg.content.substring(0, 50),
          toolCallCount: msg.toolCalls.length,
          toolNames: msg.toolCalls.map((tc: any) => tc.toolName),
          toolCallIds: msg.toolCalls.map((tc: any) => tc.toolCallId),
          firstToolCall: msg.toolCalls[0],
        });
      }

      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
        toolCalls: msg.toolCalls || undefined,
        storageId: msg.metadata?.storageId,
        confirmationIds: msg.metadata?.confirmationIds,
        confirmationMetadata: msg.metadata?.confirmationMetadata,
      };
    });

    // Batch state updates
    setMessages(loadedMessages);
    setHasLoadedHistory(true);
    setSyncedThreadId(threadId);

    // Scroll to bottom after loading messages from database
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);

    // Confirmation states are now loaded from Convex via confirmedBubblesFromDB subscription
  }, [threadMessages, threadId, syncedThreadId]);

  // Sync confirmed bubbles from database when they load
  useEffect(() => {
    if (!confirmedBubblesFromDB || confirmedBubblesFromDB.length === 0) return;

    logger.info("[Chat] Syncing confirmed bubbles from database:", {
      count: confirmedBubblesFromDB.length,
      bubbles: confirmedBubblesFromDB.map((b) => ({
        confirmationId: b.confirmationId,
        status: b.status,
        foodDescription: b.foodDescription,
      })),
    });

    // Add confirmed/rejected bubbles from database
    const confirmed = new Set<string>();
    const rejected = new Set<string>();

    confirmedBubblesFromDB.forEach((bubble) => {
      if (bubble.status === "confirmed") {
        confirmed.add(bubble.confirmationId);
      } else if (bubble.status === "rejected") {
        rejected.add(bubble.confirmationId);
      }
    });

    if (confirmed.size > 0) {
      logger.debug(
        "[Chat] Adding confirmed IDs from DB:",
        Array.from(confirmed),
      );
      setConfirmedFoodLogs((prev) => new Set([...prev, ...confirmed]));
    }
    if (rejected.size > 0) {
      logger.debug("[Chat] Adding rejected IDs from DB:", Array.from(rejected));
      setRejectedFoodLogs((prev) => new Set([...prev, ...rejected]));
    }
  }, [confirmedBubblesFromDB]);

  // Apply theme from preferences
  useEffect(() => {
    if (preferences?.darkMode !== undefined) {
      const theme = preferences.darkMode ? "dark" : "light";
      localStorage.setItem("theme", theme);
      document.documentElement.classList.toggle("dark", preferences.darkMode);
    }
  }, [preferences?.darkMode]);

  // Auto-refresh at 3:30 AM local time
  useEffect(() => {
    // Calculate time until next 3:30 AM in local timezone
    const getTimeUntilRefresh = () => {
      const now = new Date();
      const next330AM = new Date();
      next330AM.setHours(3, 30, 0, 0);

      // If it's already past 3:30 AM today, set for tomorrow
      if (now > next330AM) {
        next330AM.setDate(next330AM.getDate() + 1);
      }

      return next330AM.getTime() - now.getTime();
    };

    // Set timer for 3:30 AM refresh
    const timeUntilRefresh = getTimeUntilRefresh();
    logger.info("[Chat] Setting auto-refresh timer", {
      timeUntilRefresh: `${Math.floor(timeUntilRefresh / 1000 / 60 / 60)} hours ${Math.floor((timeUntilRefresh / 1000 / 60) % 60)} minutes`,
      refreshAt: new Date(Date.now() + timeUntilRefresh).toLocaleString(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZoneName: "short",
        },
      ),
    });

    const refreshTimer = setTimeout(() => {
      logger.info("[Chat] Auto-refreshing at 3:30 AM...");
      window.location.reload();
    }, timeUntilRefresh);

    return () => {
      clearTimeout(refreshTimer);
    };
  }, [threadId]); // Only depends on threadId - timer won't reset on messages!

  // Removed visibility change refresh - let backend handle thread management

  // Warning system - separate effect with ref to track if warning was shown
  const warningShownRef = useRef(false);
  const lastMessageTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const checkWarningTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      if (hours === 3 && minutes >= 25 && minutes < 30) {
        // Check if user was active in last 5 minutes
        if (
          lastMessageTimeRef.current &&
          Date.now() - lastMessageTimeRef.current < 5 * 60 * 1000
        ) {
          const minutesLeft = 30 - minutes;
          // Show warning only once
          if (!warningShownRef.current) {
            const warningMessage: Message = {
              role: "assistant",
              content: `🌙 Heads up! Chat will refresh in ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""} to start the new day fresh.`,
              isStreaming: false,
            };
            setMessages((prev) => [...prev, warningMessage]);
            warningShownRef.current = true;
          }
        }
      } else if (hours !== 3 || minutes >= 30) {
        // Reset warning flag after 3:30 AM
        warningShownRef.current = false;
      }
    };

    // Check once on mount
    checkWarningTime();

    // Then check every minute during potential warning window
    const interval = setInterval(checkWarningTime, 60000);
    return () => clearInterval(interval);
  }, []); // No dependencies - runs once

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

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [checkIfAtBottom]);

  // Get or create daily thread on mount (only if no thread exists at all)
  useEffect(() => {
    const initThread = async () => {
      // Skip if we already have a thread or are waiting for preferences to load
      if (threadId || preferences === undefined) {
        return;
      }

      // For onboarding, we need a thread even without a profile
      // But skip if profile is still loading (undefined) vs doesn't exist (null)
      if (profile === undefined) {
        return;
      }

      // If preferences loaded and has a saved thread, don't create daily thread
      // (The previous useEffect will handle checking if it's from today)
      if (preferences?.agentThreadId) {
        const threadTimestamp = parseInt(
          preferences.agentThreadId.split("_").pop() || "0",
        );
        const threadDate = threadTimestamp
          ? new Date(threadTimestamp).toISOString().split("T")[0]
          : null;
        const today = new Date().toISOString().split("T")[0];

        if (threadDate === today) {
          logger.info(
            `[Chat] Skipping daily thread - saved thread exists from today: ${preferences.agentThreadId}`,
          );
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
        logger.error("Failed to get/create daily thread:", error);
      }
    };

    initThread();
  }, [profile, threadId, preferences, getOrCreateDailyThread, setThreadId]);

  // Load thread ID from preferences
  useEffect(() => {
    if (preferences?.agentThreadId && !threadId) {
      // Check if the saved thread is from today
      const today = new Date().toISOString().split("T")[0];

      // Extract date from thread ID if possible (thread IDs include timestamp)
      // Format: thread_userId_timestamp
      const threadTimestamp = parseInt(
        preferences.agentThreadId.split("_").pop() || "0",
      );
      const threadDate = threadTimestamp
        ? new Date(threadTimestamp).toISOString().split("T")[0]
        : null;

      // If thread is from a previous day, don't load it - let daily thread be created
      if (threadDate && threadDate !== today) {
        logger.info(
          `[Chat] Saved thread is from previous day (${threadDate}), will create new daily thread`,
        );
        // Clear the old thread from preferences
        saveAgentThreadId({ threadId: "" }).catch((err) =>
          logger.error("Failed to clear old thread:", err),
        );
        return;
      }

      logger.info(
        `[Chat] Loading saved thread from preferences: ${preferences.agentThreadId}`,
      );
      setThreadId(preferences.agentThreadId);
    }
  }, [preferences?.agentThreadId, threadId, setThreadId, saveAgentThreadId]);

  // Create or check daily session on mount
  useEffect(() => {
    const initializeSession = async () => {
      // Only run once profile is loaded, chat history has been checked, and we have a thread ID
      if (
        profile &&
        hasLoadedHistory &&
        dailySummary !== undefined &&
        threadId &&
        threadMessages !== undefined // Wait for threadMessages to be loaded
      ) {
        try {
          // This will create a new session if needed or return existing one
          const session = await getOrCreateDailySession({});

          // Check if this is a new session for today AND we have no messages in database
          const today = new Date().toISOString().split("T")[0];
          if (
            session &&
            session.messageCount === 0 &&
            session.startDate === today &&
            messages.length === 0 &&
            threadMessages?.length === 0 // Check database messages too
          ) {
            // New session with no history - wait for server-side greeting
            logger.info(
              "[Chat] New session detected, waiting for server greeting",
            );

            // Clear any persisted confirmations from previous day to prevent auto-confirm bug
            setConfirmedFoodLogs(new Set());
            setRejectedFoodLogs(new Set());
          }
        } catch (error) {
          logger.error("Error initializing session:", error);
        }
      }
    };

    initializeSession();
  }, [
    profile,
    hasLoggedWeightToday,
    hasLoadedHistory,
    dailySummary,
    messages.length,
    preferences,
    threadId,
    threadMessages,
    saveMessage,
    getOrCreateDailySession,
    setMessages,
    setConfirmedFoodLogs,
    setRejectedFoodLogs,
  ]);

  // Initialize with daily summary instead of full history
  useEffect(() => {
    // Use ref to prevent double execution in StrictMode
    if (loadingRef.current) return;

    // Only initialize if we haven't loaded from Convex yet
    if (dailySummary && !hasLoadedHistory && messages.length === 0) {
      loadingRef.current = true;
      logger.info("[Chat] Initializing chat - no existing messages");

      // If we have a threadId or saved thread in preferences, wait for messages to load from Convex
      if (threadId || preferences?.agentThreadId) {
        logger.info(
          "[Chat] Have threadId or saved thread, waiting for Convex messages",
        );
        return;
      }

      // Don't generate greeting client-side - wait for server greeting
      if (messages.length === 0) {
        logger.info("[Chat] No messages found, waiting for server greeting");
      }

      const initialMessages: Message[] = [];

      // Always check onboarding status, even without profile
      const needsOnboarding = !profile || !profile.onboardingCompleted;

      if (needsOnboarding) {
        // Onboarding welcome message - ONLY if we don't already have messages
        if (messages.length === 0) {
          initialMessages.push({
            role: "assistant",
            content:
              "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
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
  }, [
    dailySummary,
    onboardingStatus,
    hasLoadedHistory,
    messages.length,
    threadId,
    isOnboarding,
    preferences,
    setConfirmedFoodLogs,
    setMessages,
  ]);

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
                scrollAreaRef.current.scrollTop =
                  newScrollHeight - clientHeight - scrollBottom;
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Detect if mobile device
  const isMobile =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Handle keyboard events in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (isMobile) {
        // Mobile: Enter creates newline (default behavior)
        return;
      } else {
        // Desktop: Enter sends message, Shift+Enter creates newline
        if (!e.shiftKey) {
          e.preventDefault();
          handleSubmit(e as any);
        }
        // If Shift+Enter, let default behavior create newline
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    overrideMessage?: string,
  ) => {
    e.preventDefault();

    const messageToSend = overrideMessage || input.trim();

    if ((!messageToSend && !selectedImage) || isStreaming || isUploading)
      return;

    const userMessage = messageToSend;
    const hasImage = !!selectedImage;

    // Prevent double submissions
    if (hasImage && activeUploadId) {
      logger.warn("[Chat] Upload already in progress, ignoring submission");
      return;
    }

    // Create user message
    let messageContent = userMessage;
    if (hasImage) {
      messageContent = userMessage || "What's in this photo?";
    }

    // Check if this is dietary preferences data and just show "Preferences saved"
    let displayContent = messageContent;
    if (
      messageContent.startsWith("{") &&
      messageContent.includes("_isOnboardingData")
    ) {
      displayContent = "Preferences saved";
    }

    const newUserMessage: Message = {
      role: "user",
      content: displayContent,
      imageUrl: imagePreview || undefined,
      // We'll add storageId after upload
    };

    // Check if there are any unconfirmed food logs that should be removed
    // This happens when user types something else instead of confirming
    const hasUnconfirmedFoodLogs = messages.some((msg, idx) => {
      const confirmCall = msg.toolCalls?.find(
        (tc) =>
          tc.toolName === "confirmFood" ||
          tc.toolName === "analyzeAndConfirmPhoto",
      );
      if (confirmCall) {
        const argsWithToolCallId = {
          ...confirmCall.args,
          _toolCallId: confirmCall.toolCallId,
        };
        const confirmId = getConfirmationId(argsWithToolCallId, idx);
        return !confirmedFoodLogs.has(confirmId);
      }
      return false;
    });

    // Keep confirmation bubbles visible - don't remove them
    // They should only be removed when explicitly confirmed or rejected

    // Check for duplicate message submission (within 2 seconds)
    const now = Date.now();
    if (
      lastSentMessageRef.current &&
      lastSentMessageRef.current.content === messageContent &&
      now - lastSentMessageRef.current.timestamp < 2000
    ) {
      logger.warn(
        "[Chat] Duplicate message submission prevented:",
        messageContent,
      );
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
      /correction:/i,
    ];

    const isCorrection = correctionPatterns.some((pattern) =>
      pattern.test(userMessage),
    );

    // Auto-reject the last pending confirmation if user is correcting
    if (isCorrection) {
      const lastPendingConfirmation = messages
        .map((msg, idx) => ({ msg, idx }))
        .reverse()
        .find(({ msg, idx }) => {
          const confirmCall = msg.toolCalls?.find(
            (tc) =>
              tc.toolName === "confirmFood" ||
              tc.toolName === "analyzeAndConfirmPhoto",
          );
          if (confirmCall && confirmCall.args && !confirmCall.args.error) {
            const argsWithToolCallId = {
              ...confirmCall.args,
              _toolCallId: confirmCall.toolCallId,
            };
            const confirmId = getConfirmationId(argsWithToolCallId, idx);
            return (
              !confirmedFoodLogs.has(confirmId) &&
              !rejectedFoodLogs.has(confirmId)
            );
          }
          return false;
        });

      if (lastPendingConfirmation) {
        const confirmCall = lastPendingConfirmation.msg.toolCalls?.find(
          (tc) =>
            tc.toolName === "confirmFood" ||
            tc.toolName === "analyzeAndConfirmPhoto",
        );
        if (confirmCall) {
          const argsWithToolCallId = {
            ...confirmCall.args,
            _toolCallId: confirmCall.toolCallId,
          };
          const confirmId = getConfirmationId(
            argsWithToolCallId,
            lastPendingConfirmation.idx,
          );
          logger.info(
            "[Chat] Auto-rejecting confirmation due to correction:",
            confirmId,
          );
          setRejectedFoodLogs((prev) => new Set(prev).add(confirmId));
        }
      }
    }

    // Check if this is a confirmation message
    const isConfirmationMessage =
      /^(yes|yep|yeah|confirm|ok|correct|right|sure)$/i.test(
        userMessage.toLowerCase().trim(),
      );

    // If NOT a confirmation and we have pending confirmations, expire them
    if (!isConfirmationMessage && pendingConfirmations) {
      try {
        await expirePendingConfirmation({
          confirmationId: pendingConfirmations._id,
        });
      } catch (err) {
        logger.warn("[Chat] Could not expire pending confirmation:", err);
      }
    }

    // Remove day-check - let the backend handle thread management

    // Update last message time for warning system
    lastMessageTimeRef.current = now;

    // Don't add message here - the streaming hook will add it
    // Only clear input if not using override message (from onboarding cards)
    if (!overrideMessage) {
      setInput("");
    }
    lastSentMessageRef.current = { content: messageContent, timestamp: now };

    // Auto-scroll to bottom immediately when user sends message
    requestAnimationFrame(() => {
      scrollToBottom();
    });

    try {
      let finalMessage = messageToSend; // Use the original message with JSON for backend

      let storageId: string | null = null;

      // If there's an image, upload it to Convex storage
      if (selectedImage && imagePreview) {
        // Generate a unique upload ID to track this upload
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        setActiveUploadId(uploadId);
        setIsUploading(true);

        try {
          logger.info("Starting image upload...", {
            uploadId,
            fileName: selectedImage.name,
            fileSize: selectedImage.size,
            fileType: selectedImage.type,
          });

          // Clear the image immediately to prevent re-uploads
          const imageToUpload = selectedImage;
          clearImage();

          storageId = await uploadPhoto(imageToUpload);
          logger.info("Upload successful, storageId:", storageId);

          finalMessage = userMessage || "Please analyze this food photo";
        } catch (uploadError) {
          logger.error("Failed to upload image:", uploadError);
          const errorMessage =
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown error";
          const errorStack =
            uploadError instanceof Error ? uploadError.stack : undefined;

          logger.error("Upload error details:", {
            message: errorMessage,
            stack: errorStack,
          });

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Sorry, I couldn't upload the image. Error: ${errorMessage}. Please try again.`,
            },
          ]);
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
        storageId || undefined,
      );
    } catch (error) {
      logger.error("Error sending message:", error);
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    }
  };

  // Scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, []); // Only on mount

  // Scroll to bottom when input area changes (if at bottom) - Disabled for mobile UX
  // useEffect(() => {
  //   if (inputAreaHeight > 0 && isAtBottom) {
  //     requestAnimationFrame(() => {
  //       scrollToBottom();
  //     });
  //   }
  // }, [inputAreaHeight, isAtBottom, scrollToBottom]);

  // Auto-scroll disabled for better mobile UX
  // useEffect(() => {
  //   if (messages.length > 0 && isAtBottom) {
  //     requestAnimationFrame(() => {
  //       scrollToBottom();
  //     });
  //   }
  // }, [messages, isAtBottom, scrollToBottom]);

  // Handle file processing
  const processImageFile = (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      logger.error("Invalid file type:", file?.type);
      return;
    }

    try {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = (error) => {
        logger.error("FileReader error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't read the image file. Please try again.",
          },
        ]);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      logger.error("Error processing image:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I encountered an error processing the image. Please try again.",
        },
      ]);
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
      fileInputRef.current.value = "";
    }
  };

  // Handle photo upload to Convex storage
  const uploadPhoto = async (file: File): Promise<string> => {
    try {
      // Get upload URL from Convex
      logger.debug("Getting upload URL from Convex...");
      const uploadUrl = await generateUploadUrl({
        metadata: { type: "image", purpose: "food-analysis" },
      });
      logger.debug("Got upload URL:", uploadUrl);

      // Upload the file
      logger.debug("Uploading file to Convex storage...");
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      logger.debug("Upload response status:", result.status);

      if (!result.ok) {
        const errorText = await result.text();
        logger.error("Upload failed:", errorText);
        throw new Error(
          `Failed to upload image: ${result.status} ${errorText}`,
        );
      }

      const responseData = await result.json();
      logger.debug("Upload response data:", responseData);
      const { storageId } = responseData;

      // Store the file ID
      logger.debug("Storing file ID...");
      await storeFileId({ storageId, uploadUrl });

      return storageId;
    } catch (error) {
      logger.error("Upload error in uploadPhoto:", error);
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

  // Note: Confirmation states are persisted only to Convex via saveConfirmedBubble mutation
  // This ensures consistency across all devices and sessions

  // Confirmation states are loaded from Convex and synced via confirmedBubblesFromDB

  // Show loading state while checking auth
  if (isSignedIn === undefined) {
    return (
      <div
        className="fixed inset-x-0 top-0 bottom-16 bg-background flex flex-col"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="flex-shrink-0">
          <div>
            <div className="max-w-lg mx-auto px-4 py-2 flex justify-between items-center">
              <div className="h-[45px]" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render chat if not signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 bottom-16 bg-background flex flex-col"
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Fixed Header Container */}
        <div className="flex-shrink-0">
          {/* Header */}
          <div>
            <div className="max-w-lg mx-auto px-4 py-2 flex justify-between items-center">
              <div>
                <h1 className="text-foreground flex items-center gap-3 ml-4">
                  <img
                    src="/logo.svg"
                    alt="Bob"
                    className="h-[45px] w-[45px]"
                  />
                  <span
                    className="text-2xl"
                    style={{
                      fontFamily: '"Fugaz One", Inter, sans-serif',
                      fontWeight: 400,
                      fontStyle: "normal",
                    }}
                  >
                    BOB
                  </span>
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
                      if (
                        confirm(
                          "Reset onboarding? This will restart the setup process but keep your data.",
                        )
                      ) {
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
                      const confirmCall = msg.toolCalls?.find(
                        (tc) =>
                          tc.toolName === "confirmFood" ||
                          tc.toolName === "analyzeAndConfirmPhoto",
                      );
                      if (
                        confirmCall &&
                        confirmCall.args &&
                        !confirmCall.args.error
                      ) {
                        const argsWithToolCallId = {
                          ...confirmCall.args,
                          _toolCallId: confirmCall.toolCallId,
                        };
                        const confirmId = getConfirmationId(
                          argsWithToolCallId,
                          idx,
                        );
                        return (
                          !confirmedFoodLogs.has(confirmId) &&
                          !rejectedFoodLogs.has(confirmId)
                        );
                      }
                      return false;
                    });

                    let confirmMessage =
                      "Start a new chat? Your food logs will be saved.";
                    if (hasUnconfirmedFoodLogs) {
                      confirmMessage =
                        "You have unconfirmed food items. Starting a new chat will close these pending confirmations. Continue?";
                    }

                    if (confirm(confirmMessage)) {
                      setIsLoading(true);
                      try {
                        // Start new session
                        await startNewChatSession();

                        // Create a new thread, passing the current thread ID for summarization
                        const newThreadResult = await createNewThread({
                          previousThreadId: threadId || undefined,
                        });

                        // Clear messages - server will provide greeting
                        setMessages([]);
                        logger.info(
                          "[Chat] New thread created, waiting for server greeting",
                        );

                        // Set the new thread ID
                        setThreadId(newThreadResult.threadId);

                        // Save the new thread ID to preferences so it persists across refreshes
                        logger.info(
                          `[Chat] Saving new thread to preferences: ${newThreadResult.threadId}`,
                        );
                        await saveAgentThreadId({
                          threadId: newThreadResult.threadId,
                        });
                        logger.info(`[Chat] Thread saved successfully`);

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

                {/* Dev button to reset onboarding - only in development */}
                {process.env.NODE_ENV === "development" && (
                  <Button
                    type="button"
                    onClick={async () => {
                      if (
                        confirm(
                          "Reset onboarding? This will delete all your data as if you just signed up.",
                        )
                      ) {
                        try {
                          // Clear all local storage
                          localStorage.clear();
                          sessionStorage.clear();

                          // Clear local chat state
                          setMessages([]);
                          setThreadId(null);

                          // Reset onboarding in database
                          await resetOnboardingDev({});

                          // Wait a bit for Convex to process
                          await new Promise((resolve) =>
                            setTimeout(resolve, 500),
                          );

                          // Force a hard reload to clear all state
                          window.location.href = "/chat";
                        } catch (error) {
                          console.error("Failed to reset onboarding:", error);
                        }
                      }
                    }}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground transition-opacity hover:opacity-70"
                    title="Reset Onboarding (Dev)"
                  >
                    <RotateCcw className="h-5 w-5" />
                    <span className="sr-only">Reset Onboarding</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Status Cards - Always visible */}
          <div className="">
            <div className="max-w-lg mx-auto px-4 py-1.5">
              {/* Three Cards Row */}
              <div className="grid grid-cols-3 gap-1.5">
                {/* Goal Card */}
                <div className="bg-muted rounded-lg p-2 text-center flex flex-col justify-center">
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <Target className="h-3 w-3" />
                    Goal
                  </div>
                  <div className="text-sm font-bold text-card-foreground">
                    {profile?.goal
                      ? profile.goal === "cut"
                        ? "Cut"
                        : profile.goal === "gain"
                          ? "Gain"
                          : "Maintain"
                      : onboardingStatus?.responses?.goal
                        ? onboardingStatus.responses.goal === "cut"
                          ? "Cut"
                          : onboardingStatus.responses.goal === "gain"
                            ? "Gain"
                            : "Maintain"
                        : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {profile?.targetWeight
                      ? `${profile.targetWeight} ${profile?.preferredUnits === "imperial" ? "lbs" : "kg"}`
                      : onboardingStatus?.responses?.target_weight
                        ? `${onboardingStatus.responses.target_weight.weight || onboardingStatus.responses.target_weight} ${
                            onboardingStatus.responses.target_weight.unit ||
                            onboardingStatus.responses.current_weight?.unit ||
                            "kg"
                          }`
                        : "Set goal"}
                  </div>
                </div>

                {/* Current Weight Card */}
                <div className="bg-muted rounded-lg p-2 text-center flex flex-col justify-center">
                  <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    <Scale className="h-3 w-3" />
                    Current
                  </div>
                  <div className="text-sm font-bold text-card-foreground">
                    {latestWeight?.weight ||
                      profile?.currentWeight ||
                      onboardingStatus?.responses?.current_weight?.weight ||
                      onboardingStatus?.responses?.current_weight ||
                      "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {latestWeight?.weight ||
                    profile?.currentWeight ||
                    onboardingStatus?.responses?.current_weight
                      ? latestWeight?.unit ||
                        (profile?.preferredUnits === "imperial"
                          ? "lbs"
                          : "kg") ||
                        onboardingStatus?.responses?.current_weight?.unit ||
                        "kg"
                      : ""}
                  </div>
                </div>

                {/* Nutrition Card - Collapsible */}
                <div className="bg-muted rounded-lg p-2 text-center flex flex-col justify-center relative">
                  <Collapsible
                    open={!isNutritionCollapsed}
                    onOpenChange={() => toggleNutritionCollapsed()}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                        <Flame className="h-3 w-3" />
                        Calories
                      </div>
                      <div className="text-sm font-bold text-card-foreground">
                        {isStealthMode
                          ? todayStats &&
                            profile &&
                            todayStats.calories > profile.dailyCalorieTarget
                            ? "Over"
                            : "OK"
                          : profile?.dailyCalorieTarget
                            ? `${Math.round(todayStats?.calories || 0)}/${profile.dailyCalorieTarget}`
                            : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 inline-block transition-transform",
                            isNutritionCollapsed && "rotate-180",
                          )}
                        />
                      </div>
                    </CollapsibleTrigger>

                    {/* Macros - Collapsible */}
                    <CollapsibleContent className="absolute top-full left-0 right-0 mt-1 bg-background rounded-lg shadow-lg border border-border p-2 z-50 space-y-0.5">
                      {/* Protein - Show based on preference */}
                      {preferences?.showProtein !== false && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Dumbbell className="h-2.5 w-2.5" />P
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              todayStats && profile?.proteinTarget
                                ? getProgressColor(
                                    todayStats.protein,
                                    profile.proteinTarget,
                                  )
                                : "text-muted-foreground",
                            )}
                          >
                            {isStealthMode
                              ? todayStats &&
                                profile &&
                                todayStats.protein < profile.proteinTarget * 0.8
                                ? "Low"
                                : "OK"
                              : profile?.proteinTarget
                                ? `${Math.round(todayStats?.protein || 0)}g`
                                : "—"}
                          </span>
                        </div>
                      )}

                      {/* Carbs - Show based on preference */}
                      {!isStealthMode && preferences?.showCarbs !== false && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Wheat className="h-2.5 w-2.5" />C
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              todayStats && profile?.carbsTarget
                                ? getProgressColor(
                                    todayStats.carbs,
                                    profile.carbsTarget,
                                  )
                                : "text-muted-foreground",
                            )}
                          >
                            {profile?.carbsTarget
                              ? `${Math.round(todayStats?.carbs || 0)}g`
                              : "—"}
                          </span>
                        </div>
                      )}

                      {/* Fats - Show based on preference */}
                      {!isStealthMode && preferences?.showFats !== false && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Droplet className="h-2.5 w-2.5" />F
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              todayStats &&
                                (profile?.fatTarget || profile?.fatTarget === 0)
                                ? getProgressColor(
                                    todayStats.fat,
                                    profile.fatTarget || 65,
                                  )
                                : "text-muted-foreground",
                            )}
                          >
                            {profile?.fatTarget !== undefined
                              ? `${Math.round(todayStats?.fat || 0)}g`
                              : "—"}
                          </span>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Messages - Scrollable area */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={scrollAreaRef}
            className="h-full overflow-y-auto overflow-x-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "none",
            }}
          >
            <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 relative">
              <ClientOnly>
                <AnimatePresence initial={false}>
                  {messages.map((message, index) => {
                    // Handle messages with tool calls (like confirmFood)
                    if (message.toolCalls && message.toolCalls.length > 0) {
                      const confirmFoodCall = message.toolCalls.find(
                        (tc) =>
                          tc.toolName === "confirmFood" ||
                          tc.toolName === "analyzeAndConfirmPhoto",
                      );

                      // Skip messages that only have non-confirmation tool calls and no content
                      if (!confirmFoodCall && !message.content) {
                        return null;
                      }

                      if (confirmFoodCall) {
                        // For analyzeAndConfirmPhoto, the confirmation data is in args, not result
                        let args = confirmFoodCall.args;

                        // If it's analyzeAndConfirmPhoto and has analysisComplete, extract the data
                        if (
                          confirmFoodCall.toolName ===
                            "analyzeAndConfirmPhoto" &&
                          args?.analysisComplete
                        ) {
                          // Remove the analysisComplete flag for consistent handling
                          const { analysisComplete, ...confirmationData } =
                            args;
                          args = confirmationData;
                        }

                        // Handle special cases for analyzeAndConfirmPhoto
                        const isNoFoodDetected = args?.noFoodDetected === true;
                        const hasError = args?.error === true;

                        // Flag to determine if we should show the confirmation bubble
                        let shouldShowConfirmation = true;

                        // If no food detected or error, don't show confirmation bubble
                        // but let the message with Bob's response show
                        if (isNoFoodDetected || hasError) {
                          logger.info(
                            "[Chat] Special case - skipping confirmation bubble:",
                            {
                              noFoodDetected: isNoFoodDetected,
                              error: hasError,
                              hasContent: !!message.content,
                            },
                          );
                          // Don't show confirmation bubble, but continue rendering the message
                          shouldShowConfirmation = false;
                        } else if (!args || !args.items) {
                          // This is an actual error - no args or no items
                          logger.warn(
                            "[Chat] Skipping confirmation - invalid args:",
                            {
                              hasArgs: !!args,
                              hasItems: args?.items,
                            },
                          );
                          return null;
                        } else {
                          // Normal confirmation bubble case - process it
                          // Use the confirmationId directly from args
                          let confirmId: string;

                          // Check if args has a confirmationId from the tool response
                          if (args.confirmationId) {
                            confirmId = args.confirmationId;
                            logger.info(
                              "[Chat] Using tool-generated confirmation ID:",
                              {
                                confirmId,
                                toolCallId:
                                  confirmFoodCall.toolCallId ||
                                  confirmFoodCall.id,
                              },
                            );
                          } else {
                            // Last resort: generate ID (should rarely happen now)
                            const toolCallId =
                              confirmFoodCall.toolCallId || confirmFoodCall.id;
                            const argsWithToolCallId = {
                              ...args,
                              _toolCallId: toolCallId,
                            };
                            confirmId = getConfirmationId(
                              argsWithToolCallId,
                              index,
                            );
                            logger.info(
                              "[Chat] Generated fallback confirmation ID:",
                              {
                                toolCallId,
                                confirmId,
                                reason: "No confirmationId in args",
                              },
                            );
                          }

                          // Check if we're still loading confirmed bubbles from database
                          // If so, check if this bubble exists in the DB to prevent flash of pending state
                          const isLoadingBubbles =
                            confirmedBubblesFromDB === undefined && threadId;
                          let isConfirmedInDB = false;
                          let isRejectedInDB = false;

                          if (confirmedBubblesFromDB) {
                            // Try to find bubble with exact ID match first
                            let bubbleInDB = confirmedBubblesFromDB.find(
                              (b) => b.confirmationId === confirmId,
                            );

                            // If not found and we have food items, try to match by content
                            // This handles legacy bubbles that have different IDs
                            if (!bubbleInDB && args.items) {
                              const foodDescription =
                                args.description ||
                                args.items
                                  .map((item: any) => item.name)
                                  .join(", ");
                              bubbleInDB = confirmedBubblesFromDB.find(
                                (b) =>
                                  b.foodDescription === foodDescription &&
                                  b.messageIndex === index,
                              );

                              if (bubbleInDB) {
                                logger.info(
                                  "[Chat] Found bubble by content match:",
                                  {
                                    dbId: bubbleInDB.confirmationId,
                                    generatedId: confirmId,
                                    foodDescription: foodDescription.substring(
                                      0,
                                      50,
                                    ),
                                  },
                                );
                              }
                            }

                            if (bubbleInDB) {
                              isConfirmedInDB =
                                bubbleInDB.status === "confirmed";
                              isRejectedInDB = bubbleInDB.status === "rejected";
                            }
                          }

                          // Use local state if available, otherwise use DB state
                          const isConfirmed =
                            confirmedFoodLogs.has(confirmId) || isConfirmedInDB;
                          const isRejected =
                            rejectedFoodLogs.has(confirmId) || isRejectedInDB;

                          // Enhanced logging for debugging persistence
                          logger.debug("[Chat] Bubble state check:", {
                            confirmId,
                            isConfirmedInDB,
                            isRejectedInDB,
                            localConfirmed: confirmedFoodLogs.has(confirmId),
                            localRejected: rejectedFoodLogs.has(confirmId),
                            toolCallId: confirmFoodCall?.toolCallId,
                            messageIndex: index,
                            threadId,
                            dbLoaded: confirmedBubblesFromDB !== undefined,
                            bubbleIdsInDB:
                              confirmedBubblesFromDB?.map(
                                (b) => b.confirmationId,
                              ) || [],
                            foodDescription: args.description,
                          });

                          // Always show confirmations - persistence handles old ones
                          // Don't filter based on date here since we already handle that in loading

                          return shouldShowConfirmation ? (
                            <div key={confirmId || `confirm-${index}`}>
                              {/* Food confirmation card only - no duplicate message */}
                              <div className="flex justify-start">
                                <ConfirmationBubble
                                  args={args}
                                  confirmId={confirmId}
                                  isConfirmed={isConfirmed}
                                  isRejected={isRejected}
                                  isStealthMode={isStealthMode}
                                  isStreaming={isStreaming}
                                  onReject={async () => {
                                    // Mark as rejected
                                    setRejectedFoodLogs((prev) =>
                                      new Set(prev).add(confirmId),
                                    );

                                    // Save to Convex for cross-device sync
                                    if (threadId && saveConfirmedBubble) {
                                      try {
                                        await saveConfirmedBubble({
                                          threadId,
                                          messageIndex: index,
                                          confirmationId: confirmId,
                                          toolCallId:
                                            confirmFoodCall.toolCallId,
                                          foodDescription: args.description,
                                          status: "rejected",
                                        });
                                        logger.info(
                                          "[Chat] Saved rejected bubble to Convex:",
                                          confirmId,
                                        );
                                      } catch (error) {
                                        logger.error(
                                          "[Chat] Failed to save rejected bubble to Convex:",
                                          error,
                                        );
                                      }
                                    }

                                    // Add a message to guide the user
                                    setMessages((prev) => [
                                      ...prev,
                                      {
                                        role: "assistant",
                                        content:
                                          "No problem! Please tell me what was incorrect so I can update it.",
                                      },
                                    ]);
                                  }}
                                  onConfirm={async () => {
                                    // Check if already processing this request
                                    const requestKey = `${confirmId}-${Date.now()}`;
                                    if (activeLogRequests.has(confirmId)) {
                                      logger.warn(
                                        "[Chat] Already processing this confirmation:",
                                        confirmId,
                                      );
                                      return;
                                    }

                                    // Mark as processing with flushSync for immediate mobile rendering
                                    setActiveLogRequests((prev) =>
                                      new Set(prev).add(confirmId),
                                    );
                                    flushSync(() => {
                                      setConfirmedFoodLogs((prev) =>
                                        new Set(prev).add(confirmId),
                                      );
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
                                        confidence: args.confidence || "medium",
                                      });

                                      // Save to Convex for cross-device sync
                                      if (threadId && saveConfirmedBubble) {
                                        try {
                                          await saveConfirmedBubble({
                                            threadId,
                                            messageIndex: index,
                                            confirmationId: confirmId,
                                            toolCallId:
                                              confirmFoodCall.toolCallId,
                                            foodDescription: args.description,
                                            status: "confirmed",
                                          });
                                          logger.info(
                                            "[Chat] Saved confirmed bubble to Convex:",
                                            confirmId,
                                          );
                                        } catch (error) {
                                          logger.error(
                                            "[Chat] Failed to save confirmed bubble to Convex:",
                                            error,
                                          );
                                        }
                                      }

                                      // Add a success message with rounded numbers
                                      const caloriesRemaining = Math.round(
                                        (profile?.dailyCalorieTarget || 2000) -
                                          ((todayStats?.calories || 0) +
                                            finalCalories),
                                      );
                                      const encouragements = [
                                        "Great job tracking! 💪",
                                        "You're doing awesome! 🌟",
                                        "Keep it up! 🎯",
                                        "Nice logging! 👏",
                                        "Way to stay on track! 🚀",
                                      ];
                                      const randomEncouragement =
                                        encouragements[
                                          Math.floor(
                                            Math.random() *
                                              encouragements.length,
                                          )
                                        ];
                                      const successMessage = `${caloriesRemaining} calories left today. ${randomEncouragement}`;
                                      setMessages((prev) => [
                                        ...prev,
                                        {
                                          role: "assistant",
                                          content: successMessage,
                                        },
                                      ]);

                                      // Save the message to chat history with foodLogId
                                      if (threadId) {
                                        try {
                                          await saveMessage({
                                            threadId,
                                            role: "assistant",
                                            content: successMessage,
                                            metadata: {
                                              foodLogId: logResult,
                                              actionType: "food_log",
                                            },
                                          });
                                        } catch (err) {
                                          logger.warn(
                                            "[Chat] Could not save food log message to history:",
                                            err,
                                          );
                                        }
                                      }

                                      // Clear pending confirmation if exists - CRITICAL for preventing auto-confirm bug
                                      logger.info(
                                        "[Chat] Checking for pending confirmations to clear:",
                                        {
                                          hasMutation:
                                            !!confirmPendingConfirmation,
                                          hasPendingConfirmations:
                                            !!pendingConfirmations,
                                          pendingConfirmationId:
                                            pendingConfirmations?._id,
                                        },
                                      );

                                      if (
                                        confirmPendingConfirmation &&
                                        pendingConfirmations
                                      ) {
                                        try {
                                          logger.info(
                                            "[Chat] Calling confirmPendingConfirmation with ID:",
                                            pendingConfirmations._id,
                                          );
                                          await confirmPendingConfirmation({
                                            confirmationId:
                                              pendingConfirmations._id,
                                          });
                                          logger.info(
                                            "[Chat] Successfully marked pending confirmation as confirmed",
                                          );
                                        } catch (err) {
                                          logger.error(
                                            "[Chat] Failed to clear pending confirmation:",
                                            err,
                                          );
                                        }
                                      } else {
                                        logger.warn(
                                          "[Chat] No pending confirmation to clear - this might be the issue!",
                                        );
                                      }
                                    } catch (error) {
                                      logger.error(
                                        "Error logging food directly:",
                                        error,
                                      );
                                      // On error, fall back to sending "yes" message
                                      try {
                                        await sendStreamingMessage(
                                          "yes",
                                          threadId || undefined,
                                        );
                                      } catch (streamError) {
                                        logger.error(
                                          "Error confirming via stream:",
                                          streamError,
                                        );
                                        setMessages((prev) => [
                                          ...prev,
                                          {
                                            role: "assistant",
                                            content:
                                              "Sorry, I couldn't log that. Please try again.",
                                          },
                                        ]);
                                      }
                                    } finally {
                                      setIsLoading(false);
                                      // Remove from active requests
                                      setActiveLogRequests((prev) => {
                                        const next = new Set(prev);
                                        next.delete(confirmId);
                                        return next;
                                      });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          ) : null;
                        } // End of normal confirmation bubble case
                      }
                    }

                    // Regular message display - use memoized component
                    const imgUrl =
                      message.storageId && imageUrls?.[message.storageId]
                        ? imageUrls[message.storageId]
                        : message.imageUrl || null;

                    // Generate stable key based on content hash or toolCallId
                    const messageKey =
                      message.toolCalls?.[0]?.toolCallId ||
                      `msg-${message.role}-${message.content.substring(0, 50)}-${index}`;

                    return (
                      <div
                        key={messageKey}
                        className={cn(
                          "flex flex-col gap-1",
                          message.role === "user"
                            ? "items-end -mr-2"
                            : "items-start",
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

              {/* Onboarding Card - Show when onboarding not complete and there's at least one assistant message */}
              {(() => {
                // Debug what's blocking the UI
                logger.debug("[Chat] Onboarding UI Debug:", {
                  isOnboarding,
                  messagesLength: messages.length,
                  lastMessageRole: messages[messages.length - 1]?.role,
                  onboardingStatus,
                  currentStep: onboardingStatus?.currentStep,
                  isStreaming,
                  shouldShow:
                    isOnboarding &&
                    !isOnboardingLoading &&
                    messages.length > 0 &&
                    messages[messages.length - 1]?.role === "assistant" &&
                    !isStreaming,
                });

                return (
                  isOnboarding &&
                  !isOnboardingLoading && // Don't show while loading onboarding status
                  messages.length > 0 &&
                  messages[messages.length - 1]?.role === "assistant" &&
                  !isStreaming // Don't show while Bob is responding
                );
              })() && (
                <div className="mt-4">
                  <OnboardingQuickResponses
                    step={onboardingStatus?.currentStep || "name"}
                    onSelect={async (value) => {
                      // Send the response directly without showing in input field
                      await handleSubmit(new Event("submit") as any, value);
                    }}
                    isLoading={isLoading || isStreaming}
                    currentInput=""
                  />
                </div>
              )}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="flex space-x-1 p-3">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Spacer for fixed input area with small padding for breathing room */}
            <div style={{ height: `${(inputAreaHeight || 120) + 10}px` }} />
          </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <div
          ref={inputAreaRef}
          className="absolute bottom-0 left-0 right-0 bg-background overflow-hidden"
          style={{ maxHeight: "200px", zIndex: 10 }}
        >
          <div
            className="max-w-lg mx-auto px-4 pt-2"
            style={{ paddingBottom: "10px" }}
          >
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
                <div className="flex items-center overflow-hidden">
                  {/* Left side icons */}
                  <div className="flex items-center gap-3 mr-3 flex-shrink-0">
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
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
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
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Bob anything"
                    rows={1}
                    className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none focus:outline-none focus:ring-0 text-base min-w-0 resize-none leading-relaxed"
                    disabled={isStreaming}
                    style={{
                      WebkitAppearance: "none",
                      overflow: "hidden",
                      maxHeight: "120px",
                    }}
                  />

                  {/* Send/Stop button */}
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => {
                        logger.info("[Chat] User requested to stop streaming");
                        stopStreaming();
                      }}
                      className="ml-2 rounded-full p-1.5 transition-opacity focus:outline-none focus:ring-0 hover:opacity-80 bg-foreground text-background flex-shrink-0"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        (!input.trim() && !selectedImage) || isUploading
                      }
                      className={cn(
                        "ml-2 rounded-full p-1.5 transition-opacity focus:outline-none focus:ring-0 hover:opacity-80 flex-shrink-0",
                        (!input.trim() && !selectedImage) || isUploading
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-foreground text-background",
                      )}
                    >
                      {isUploading ? (
                        <div className="h-4 w-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Scroll to bottom button - Fixed positioning with dynamic bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{ bottom: `${(inputAreaHeight || 120) + 64 + 60}px` }}
      >
        <div className="max-w-lg mx-auto px-4 relative">
          <AnimatePresence>
            {!isAtBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  scrollToBottom();
                }}
                className="absolute right-4 bg-muted border border-border text-foreground rounded-full p-2 shadow-md transition-all duration-200 hover:bg-muted/80 focus:outline-none focus:ring-0 pointer-events-auto"
                style={{
                  zIndex: 20,
                }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Navigation - Outside the main container */}
      <BottomNav />
    </>
  );
}

export default function ChatPage() {
  return (
    <AuthSyncHandler>
      <Chat />
    </AuthSyncHandler>
  );
}
