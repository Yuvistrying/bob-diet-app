"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/react-router";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Camera, Paperclip, ArrowUp, X, Check, Settings, PenSquare, ChevronDown } from "lucide-react";
import { ClientOnly } from "~/components/ClientOnly";
import { OnboardingQuickResponses } from "~/components/OnboardingQuickResponses";
import { ProfileEditModal } from "~/components/ProfileEditModal";
import { MarkdownMessage } from "~/components/MarkdownMessage";
import { ThemeToggle } from "~/components/ThemeToggle";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  imageUrl?: string;
  storageId?: string;
}

export default function Chat() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  
  // State - Define before using in queries
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [confirmedFoodLogs, setConfirmedFoodLogs] = useState<Set<string>>(new Set());
  const [editingFoodLog, setEditingFoodLog] = useState<string | null>(null);
  const [editedFoodItems, setEditedFoodItems] = useState<any>({});
  const [persistedConfirmations, setPersistedConfirmations] = useState<any[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Convex queries
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const chatHistory = useQuery(api.chatHistory.getTodayChats);
  const sessionStats = useQuery(api.chatSessions.getSessionStats);
  const hasLoggedWeightToday = useQuery(api.weightLogs.hasLoggedWeightToday);
  
  // Convex action for Agent SDK
  const sendMessage = useAction(api.agentActions.chat);
  
  // Convex mutations for file upload
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const storeFileId = useMutation(api.files.storeFileId);
  const resetOnboarding = useMutation(api.onboarding.resetOnboarding);
  const forceCompleteOnboarding = useMutation(api.onboardingFix.forceCompleteOnboarding);
  
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
  
  // Convex mutation to save thread ID
  const saveAgentThreadId = useMutation(api.userPreferences.saveAgentThreadId);
  const startNewChatSession = useMutation(api.chatSessions.startNewChatSession);
  const getOrCreateDailySession = useMutation(api.chatSessions.getOrCreateDailySession);
  const updateTheme = useMutation(api.userPreferences.updateTheme);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isSignedIn === false) {
      navigate("/sign-in");
    }
  }, [isSignedIn, navigate]);

  // Clear any old localStorage data on mount to prevent cross-user data leakage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear old localStorage items that might contain other users' data
      localStorage.removeItem('chatMessages');
      localStorage.removeItem('agentThreadId');
      
      // Load persisted confirmations for today only
      const savedConfirmations = localStorage.getItem('foodConfirmations');
      if (savedConfirmations) {
        try {
          const parsed = JSON.parse(savedConfirmations);
          const today = new Date().toISOString().split('T')[0];
          // Only load confirmations from today
          if (parsed.date === today) {
            setPersistedConfirmations(parsed.confirmations || []);
            // IMPORTANT: Restore confirmed state to maintain minimized bubbles
            if (parsed.confirmed && parsed.confirmed.length > 0) {
              console.log('Loading confirmed bubbles from localStorage:', parsed.confirmed);
              setConfirmedFoodLogs(new Set(parsed.confirmed));
            }
            if (parsed.editedItems) {
              setEditedFoodItems(parsed.editedItems);
            }
          } else {
            // Clear old confirmations
            localStorage.removeItem('foodConfirmations');
          }
        } catch (e) {
          console.error('Error loading persisted confirmations:', e);
        }
      }
    }
  }, []);
  
  // Apply theme from preferences
  useEffect(() => {
    if (preferences?.darkMode !== undefined) {
      const theme = preferences.darkMode ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', preferences.darkMode);
    }
  }, [preferences?.darkMode]);

  // Save confirmation state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all current confirmations from messages
      const currentConfirmations = messages
        .map((msg, idx) => {
          const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood");
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
      
      // Only save if there are confirmations to save
      if (currentConfirmations.length > 0 || confirmedFoodLogs.size > 0) {
        const persistData = {
          date: today,
          confirmations: currentConfirmations,
          confirmed: Array.from(confirmedFoodLogs),
          editedItems: editedFoodItems
        };
        
        console.log('Saving confirmed bubbles to localStorage:', Array.from(confirmedFoodLogs));
        localStorage.setItem('foodConfirmations', JSON.stringify(persistData));
      }
    }
  }, [confirmedFoodLogs, editedFoodItems, messages]);

  // Load thread ID from preferences
  useEffect(() => {
    if (preferences?.agentThreadId && !threadId) {
      setThreadId(preferences.agentThreadId);
    }
  }, [preferences?.agentThreadId]);

  // Create or check daily session on mount
  useEffect(() => {
    const initializeSession = async () => {
      // Only run once profile is loaded and chat history has been checked
      if (profile && hasLoadedHistory && chatHistory !== undefined) {
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
          console.error("Error initializing session:", error);
        }
      }
    };
    
    initializeSession();
  }, [profile, hasLoggedWeightToday, hasLoadedHistory, chatHistory, messages.length]);



  // Load today's chat history on mount
  useEffect(() => {
    if (chatHistory && !hasLoadedHistory) {
      const formattedHistory: Message[] = chatHistory.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        // Don't load old confirmFood tool calls from history - they've already been acted upon
        toolCalls: msg.metadata?.toolCalls || undefined,
        // Include storageId if present
        storageId: msg.metadata?.storageId || undefined
      }));
      
      // Add persisted confirmations back to the messages
      if (persistedConfirmations.length > 0) {
        // Sort confirmations by index to insert them in the right order
        const sortedConfirmations = [...persistedConfirmations].sort((a, b) => b.index - a.index);
        
        sortedConfirmations.forEach(conf => {
          // Find if this confirmation already exists in the history
          const existingIndex = formattedHistory.findIndex((msg, idx) => 
            msg.toolCalls?.some(tc => tc.toolName === "confirmFood") &&
            idx === conf.index
          );
          
          if (existingIndex === -1) {
            // Only add if it doesn't already exist
            // Find where to insert based on trigger content
            const insertIndex = formattedHistory.findIndex(msg => 
              msg.content.includes(conf.triggerContent)
            );
            
            if (insertIndex >= 0 && insertIndex + 1 <= formattedHistory.length) {
              formattedHistory.splice(insertIndex + 1, 0, {
                role: "assistant",
                content: conf.content,
                toolCalls: [{
                  toolName: "confirmFood",
                  args: conf.args
                }]
              });
            }
          }
        });
      }
      
      // Set messages from database history first
      setMessages(formattedHistory);
      
      // Then restore confirmed state from localStorage after messages are set
      // This ensures bubbles stay minimized after refresh
      setTimeout(() => {
        const savedConfirmations = localStorage.getItem('foodConfirmations');
        if (savedConfirmations) {
          try {
            const parsed = JSON.parse(savedConfirmations);
            if (parsed.confirmed && parsed.confirmed.length > 0) {
              console.log('Restoring confirmed state after chat history loaded:', parsed.confirmed);
              setConfirmedFoodLogs(new Set(parsed.confirmed));
            }
          } catch (e) {
            console.error('Error restoring confirmed state:', e);
          }
        }
      }, 100); // Small delay to ensure messages are rendered
      
      // Only show welcome message if there's truly no history
      if (formattedHistory.length === 0) {
        const isOnboarding = !onboardingStatus?.completed;
        
        if (isOnboarding) {
          setMessages([{
            role: "assistant",
            content: "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
          }]);
        }
        // Don't show a generic welcome back message - let the daily session handle it
      }
      setHasLoadedHistory(true);
    }
  }, [chatHistory, onboardingStatus, hasLoadedHistory, persistedConfirmations]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    const hasImage = !!selectedImage;
    
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
      const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood");
      if (confirmCall) {
        const confirmId = getConfirmationId(confirmCall.args);
        return !confirmedFoodLogs.has(confirmId);
      }
      return false;
    });
    
    if (hasUnconfirmedFoodLogs && userMessage.toLowerCase() !== "yes") {
      // Remove unconfirmed food log messages but keep confirmed ones
      setMessages(prev => prev.filter((msg, idx) => {
        const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood");
        if (confirmCall) {
          const confirmId = getConfirmationId(confirmCall.args);
          if (!confirmedFoodLogs.has(confirmId)) {
            // This is an unconfirmed food log, remove it
            return false;
          }
        }
        return true;
      }));
    }
    
    // Don't add message yet - wait until we have storageId if there's an image
    if (!selectedImage) {
      setMessages(prev => [...prev, newUserMessage]);
    }
    setInput("");
    setIsLoading(true);

    try {
      let finalMessage = userMessage;
      
      let storageId: string | null = null;
      
      // If there's an image, upload it to Convex storage
      if (selectedImage && imagePreview) {
        try {
          console.log('Starting image upload...', {
            fileName: selectedImage.name,
            fileSize: selectedImage.size,
            fileType: selectedImage.type
          });
          
          storageId = await uploadPhoto(selectedImage);
          console.log('Upload successful, storageId:', storageId);
          
          // Now add the message with storageId
          const messageWithImage: Message = {
            ...newUserMessage,
            storageId: storageId
          };
          setMessages(prev => [...prev, messageWithImage]);
          
          finalMessage = userMessage || "Please analyze this food photo";
        } catch (uploadError) {
          console.error("Failed to upload image:", uploadError);
          console.error('Upload error details:', {
            message: uploadError.message,
            stack: uploadError.stack
          });
          
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `Sorry, I couldn't upload the image. Error: ${uploadError.message || 'Unknown error'}. Please try again.`
          }]);
          setIsLoading(false);
          return;
        }
        
        // Clear the image after sending
        clearImage();
      }
      
      // Send message using Convex Agent SDK
      const response = await sendMessage({
        prompt: finalMessage,
        threadId: threadId || undefined,
        storageId: storageId as any || undefined, // Type assertion for string -> Id conversion
      });
      
      // Save threadId for future messages
      if (response.threadId && !threadId) {
        setThreadId(response.threadId);
        // Save to database for persistence across tabs
        await saveAgentThreadId({ threadId: response.threadId });
      }

      // Add AI response to messages with tool calls if any
      console.log("Response from AI:", response);
      const assistantMessage: Message = { 
        role: "assistant", 
        content: response.text || "",
        toolCalls: response.toolCalls
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
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
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  // Persist confirmation states
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      // Find all confirmation messages with their IDs
      const confirmations = messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.toolCalls?.some(tc => tc.toolName === "confirmFood"))
        .map(({ msg, idx }) => {
          const confirmCall = msg.toolCalls?.find(tc => tc.toolName === "confirmFood");
          const confirmId = getConfirmationId(confirmCall?.args, idx);
          return {
            index: idx,
            confirmId: confirmId,
            content: msg.content,
            args: confirmCall?.args,
            triggerContent: messages[idx - 1]?.content || "",
            isConfirmed: confirmedFoodLogs.has(confirmId)
          };
        });
      
      // Save to localStorage
      localStorage.setItem('foodConfirmations', JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        confirmations: confirmations,
        confirmed: Array.from(confirmedFoodLogs),
        editedItems: editedFoodItems
      }));
    }
  }, [messages, confirmedFoodLogs, editedFoodItems]);

  // Handle file processing
  const processImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      console.error('Invalid file type:', file?.type);
      return;
    }
    
    try {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, I couldn't read the image file. Please try again."
        }]);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing image:', error);
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
      console.log('Getting upload URL from Convex...');
      const uploadUrl = await generateUploadUrl({ 
        metadata: { type: "image", purpose: "food-analysis" } 
      });
      console.log('Got upload URL:', uploadUrl);
      
      // Upload the file
      console.log('Uploading file to Convex storage...');
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      console.log('Upload response status:', result.status);
      
      if (!result.ok) {
        const errorText = await result.text();
        console.error('Upload failed:', errorText);
        throw new Error(`Failed to upload image: ${result.status} ${errorText}`);
      }
      
      const responseData = await result.json();
      console.log('Upload response data:', responseData);
      const { storageId } = responseData;
      
      // Store the file ID
      console.log('Storing file ID...');
      await storeFileId({ storageId, uploadUrl });
      
      return storageId;
    } catch (error) {
      console.error('Upload error in uploadPhoto:', error);
      throw error;
    }
  };

  // Helper functions
  const getProgressColor = (value: number, target: number) => {
    const percentage = (value / target) * 100;
    if (percentage < 80) return "text-gray-600 dark:text-gray-400";
    if (percentage <= 100) return "text-gray-600 dark:text-gray-400";
    return "text-gray-600 dark:text-gray-400";
  };
  
  // Generate a stable ID for a confirmation based on its content
  const getConfirmationId = (args: any) => {
    // Create a stable ID based on the content, not the index
    const foodNames = args.items?.map((item: any) => item.name).join('-') || '';
    return `${args.mealType}-${args.totalCalories}-${foodNames}`;
  };

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

  // Show loading state while checking auth
  if (isSignedIn === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground font-mono">Loading...</div>
      </div>
    );
  }

  // Don't render chat if not signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex flex-col" style={{ height: "100vh", minHeight: "-webkit-fill-available" }}>
      {/* Fixed Header Container */}
      <div className="flex-shrink-0 bg-white dark:bg-black">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Bob - Diet Coach</h1>
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
                  console.error("Error forcing completion:", error);
                  alert("Failed to force complete");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
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
                    console.error("Error resetting onboarding:", error);
                    alert("Failed to reset onboarding");
                  } finally {
                    setIsLoading(false);
                  }
                }
              }}
              disabled={isLoading}
              className="text-xs text-muted-foreground"
            >
              🔄 Reset Onboarding
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
                tc => tc.toolName === "confirmFood"
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
                    content: `Hey ${profile?.name || "there"}! 🌟 Fresh chat started! What can I help you with?`,
                  }]);
                  // Clear thread ID
                  setThreadId(null);
                } catch (error) {
                  console.error("Error starting new chat:", error);
                } finally {
                  setIsLoading(false);
                }
              }
            }}
            disabled={isLoading}
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <PenSquare className="h-5 w-5" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
        </div>

        {/* Status Cards - Only show after onboarding */}
        {!isOnboarding && (
          <div className="p-2 border-b border-gray-200 dark:border-gray-800 space-y-1.5">
          {/* Weight Cards Row */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Goal Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-center shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">🎯 Goal</div>
              <div className="text-lg font-bold font-mono text-gray-900 dark:text-gray-100">
                {profile?.goal === "cut" ? "Cut" : profile?.goal === "gain" ? "Gain" : "Maintain"}
              </div>
              {profile?.targetWeight && (
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {profile.targetWeight} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                </div>
              )}
            </div>

            {/* Current Weight Card */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 text-center shadow-sm">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">⚖️ Current</div>
              <div className="text-lg font-bold font-mono text-gray-900 dark:text-gray-100">
                {latestWeight?.weight || profile?.currentWeight || "—"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {latestWeight?.unit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
            </div>
          </div>

          {/* Nutrition Card - Full Width */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono text-center mb-1">🔥 Nutrition</div>
            <div className="space-y-0.5">
                {/* Calories - Always show */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-700 dark:text-gray-300">🔥 Cals</span>
                  <span className={cn("text-xs font-semibold font-mono", todayStats && profile ? getProgressColor(todayStats.calories, profile.dailyCalorieTarget) : "")}>
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
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">💪 Protein</span>
                    <span className={cn("text-xs font-semibold font-mono", todayStats && profile?.proteinTarget ? getProgressColor(todayStats.protein, profile.proteinTarget) : "text-gray-600 dark:text-gray-400")}>
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
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">🍞 Carbs</span>
                    <span className={cn("text-xs font-semibold font-mono", todayStats && profile?.carbsTarget ? getProgressColor(todayStats.carbs, profile.carbsTarget) : "text-gray-600 dark:text-gray-400")}>
                      {todayStats?.carbs || 0}g/{profile?.carbsTarget || 200}g
                    </span>
                  </div>
                )}
                
                {/* Fats - Show based on preference */}
                {!isStealthMode && preferences?.showFats !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">🥑 Fats</span>
                    <span className={cn("text-xs font-semibold font-mono", 
                      todayStats && (profile?.fatTarget || profile?.fatTarget === 0) 
                        ? getProgressColor(todayStats.fat, profile.fatTarget || 65) 
                        : "text-gray-600 dark:text-gray-400"
                    )}>
                      {todayStats?.fat || 0}g/{profile?.fatTarget || 65}g
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Chat Messages - Scrollable area */}
      <div className="flex-1 relative overflow-hidden bg-gray-50 dark:bg-gray-950">
        <div ref={chatContainerRef} className="h-full overflow-y-auto px-4 py-4 space-y-4" style={{ minHeight: 0, paddingBottom: "140px" }}>
        <ClientOnly>
          
          {messages.map((message, index) => {
          // Handle messages with tool calls (like confirmFood)
          if (message.toolCalls && message.toolCalls.length > 0) {
            const confirmFoodCall = message.toolCalls.find(tc => tc.toolName === "confirmFood");
            if (confirmFoodCall) {
              const args = confirmFoodCall.args;
              const confirmId = getConfirmationId(args);
              const isConfirmed = confirmedFoodLogs.has(confirmId);
              
              // Always show confirmations - persistence handles old ones
              // Don't filter based on date here since we already handle that in loading
              
              return (
                <div key={index} className="space-y-4">
                  {/* Bob's message */}
                  <div className="flex justify-start">
                    <div className="max-w-[70%] text-gray-800 dark:text-gray-200">
                      <MarkdownMessage content={message.content} className="text-[15px]" />
                    </div>
                  </div>
                  
                  {/* Food confirmation card - either full or collapsed */}
                  <div className="flex justify-start">
                    {isConfirmed ? (
                      // Collapsed summary view
                      <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="font-medium text-green-800 dark:text-green-200">
                            Logged {args.mealType}
                          </span>
                          <span className="text-sm text-green-700 dark:text-green-300">
                            • {editedFoodItems[confirmId] ? 
                                editedFoodItems[confirmId].reduce((sum: number, item: any) => sum + (item.calories || 0), 0) : 
                                args.totalCalories} calories
                          </span>
                          <span className="text-sm text-green-600 dark:text-green-400">
                            • {editedFoodItems[confirmId]?.length || args.items.length} items
                          </span>
                        </div>
                      </div>
                    ) : (
                      // Full confirmation bubble
                      <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">Got it! Let me confirm what you had: 📝</div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 -mt-1 -mr-1"
                            onClick={() => {
                              if (editingFoodLog === confirmId) {
                                setEditingFoodLog(null);
                              } else {
                                setEditingFoodLog(confirmId);
                                // Initialize edited items if not already done
                                if (!editedFoodItems[confirmId]) {
                                  setEditedFoodItems({ ...editedFoodItems, [confirmId]: [...args.items] });
                                }
                              }
                            }}
                          >
                            <PenSquare className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {(editedFoodItems[confirmId] || args.items).map((item: any, i: number) => (
                            <div key={i} className="text-sm font-mono text-gray-800 dark:text-gray-200">
                              {editingFoodLog === confirmId ? (
                                <div className="flex items-center gap-2">
                                  <span>•</span>
                                  <Input
                                    value={item.name}
                                    onChange={(e) => {
                                      const updatedItems = [...(editedFoodItems[confirmId] || args.items)];
                                      updatedItems[i] = { ...updatedItems[i], name: e.target.value };
                                      setEditedFoodItems({ ...editedFoodItems, [confirmId]: updatedItems });
                                    }}
                                    className="h-6 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800"
                                  />
                                  <Input
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const updatedItems = [...(editedFoodItems[confirmId] || args.items)];
                                      updatedItems[i] = { ...updatedItems[i], quantity: e.target.value };
                                      setEditedFoodItems({ ...editedFoodItems, [confirmId]: updatedItems });
                                    }}
                                    className="h-6 px-2 py-1 text-sm w-24 bg-gray-50 dark:bg-gray-800"
                                  />
                                  <span>-</span>
                                  <Input
                                    type="number"
                                    value={item.calories}
                                    onChange={(e) => {
                                      const updatedItems = [...(editedFoodItems[confirmId] || args.items)];
                                      updatedItems[i] = { ...updatedItems[i], calories: parseInt(e.target.value) || 0 };
                                      setEditedFoodItems({ ...editedFoodItems, [confirmId]: updatedItems });
                                    }}
                                    className="h-6 px-2 py-1 text-sm w-20 bg-gray-50 dark:bg-gray-800"
                                  />
                                  <span>cal</span>
                                </div>
                              ) : (
                                <span>• {item.name} {item.quantity} - {item.calories} cal</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="font-medium font-mono text-gray-900 dark:text-gray-100">
                            Total: {editedFoodItems[confirmId] ? 
                              editedFoodItems[confirmId].reduce((sum: number, item: any) => sum + (item.calories || 0), 0) : 
                              args.totalCalories} calories
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                              {args.totalProtein}g protein • {args.totalCarbs}g carbs • {args.totalFat}g fat
                            </div>
                          )}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="text-sm text-gray-800 dark:text-gray-200">
                            Should I log this as your {args.mealType}? 🤔
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              variant="default"
                              onClick={async () => {
                                // Mark this confirmation as confirmed
                                setConfirmedFoodLogs(prev => new Set(prev).add(confirmId));
                                
                                // Update the bubble's args if edited
                                if (editedFoodItems[confirmId]) {
                                  const updatedMessage = [...messages];
                                  const confirmCall = updatedMessage[index].toolCalls?.find(tc => tc.toolName === "confirmFood");
                                  if (confirmCall) {
                                    // Update the args with edited data
                                    const editedItems = editedFoodItems[confirmId];
                                    confirmCall.args = {
                                      ...confirmCall.args,
                                      items: editedItems,
                                      totalCalories: editedItems.reduce((sum: number, item: any) => sum + (item.calories || 0), 0)
                                    };
                                  }
                                  setMessages(updatedMessage);
                                }
                                
                                // Always just send "yes" - the backend will use the updated args
                                const yesMessage: Message = { role: "user", content: "yes" };
                                setMessages(prev => [...prev, yesMessage]);
                                setIsLoading(true);
                                
                                try {
                                  // Send confirmation
                                  const response = await sendMessage({
                                    prompt: "yes",
                                    threadId: threadId || undefined,
                                  });
                                  
                                  // Save threadId if new
                                  if (response.threadId && !threadId) {
                                    setThreadId(response.threadId);
                                    await saveAgentThreadId({ threadId: response.threadId });
                                  }
                                  
                                  // Add response
                                  const assistantMessage: Message = { 
                                    role: "assistant", 
                                    content: response.text || "",
                                    toolCalls: response.toolCalls
                                  };
                                  setMessages(prev => [...prev, assistantMessage]);
                                } catch (error) {
                                  console.error("Error confirming:", error);
                                } finally {
                                  setIsLoading(false);
                                  setEditingFoodLog(null);
                                }
                              }}
                              disabled={isLoading}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Yes, log it! 📝
                            </Button>
                            {editingFoodLog === confirmId && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingFoodLog(null);
                                  setEditedFoodItems({ ...editedFoodItems, [confirmId]: args.items });
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground dark:text-gray-400 text-center">
                            If this isn't accurate, just tell me what to change in the chat below
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          }

          // Regular message display
          return (
            <div
              key={index}
              className={cn(
                "flex flex-col gap-2",
                message.role === "user" ? "items-end" : "items-start"
              )}
            >
              {message.role === "user" ? (
                <>
                  {/* Display image separately without background */}
                  {(message.imageUrl || (message.storageId && imageUrls?.[message.storageId])) && (
                    <div>
                      <img 
                        src={message.storageId && imageUrls?.[message.storageId] 
                          ? imageUrls[message.storageId] 
                          : message.imageUrl} 
                        alt="Uploaded food" 
                        className="rounded-lg"
                        style={{ maxHeight: '120px', maxWidth: '120px', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  
                  {/* Display text in a separate bubble if there's content or if it's a photo placeholder */}
                  {(message.content && message.content !== "[Photo uploaded]") && (
                    <div className={cn(
                      "relative max-w-[70%] px-4 py-2.5",
                      "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                      "rounded-2xl rounded-br-sm",
                      "shadow-sm"
                    )}>
                      <div className="text-[15px] leading-relaxed">{message.content}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="max-w-[70%] text-gray-800 dark:text-gray-200">
                  <MarkdownMessage content={message.content} className="text-[15px]" />
                </div>
              )}
            </div>
          );
        })}
        </ClientOnly>
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex space-x-1 p-3">
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
          </div>
        )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      

      {/* Quick Responses for Onboarding */}
      {isOnboarding && currentOnboardingStep && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_10px_rgba(255,255,255,0.05)]" style={{ paddingBottom: "60px" }}>
          <OnboardingQuickResponses
            step={currentOnboardingStep}
            currentInput={input}
            onSelect={async (value) => {
              // All responses are sent directly - weight inputs already include unit
              const userMessage: Message = { 
                role: "user", 
                content: value
              };
              
              setMessages(prev => [...prev, userMessage]);
              setIsLoading(true);

              try {
                const response = await sendMessage({
                  prompt: value,
                  threadId: threadId || undefined,
                });
                
                if (response.threadId && !threadId) {
                  setThreadId(response.threadId);
                  // Save to database for persistence across tabs
                  await saveAgentThreadId({ threadId: response.threadId });
                }

                const assistantMessage: Message = { 
                  role: "assistant", 
                  content: response.text || "",
                  toolCalls: response.toolCalls
                };
                setMessages(prev => [...prev, assistantMessage]);
              } catch (error) {
                console.error("Error sending quick response:", error);
                setMessages(prev => [...prev, {
                  role: "assistant",
                  content: "Sorry, I encountered an error. Please try again."
                }]);
              } finally {
                setIsLoading(false);
              }
            }}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-36 right-8 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-full p-2 shadow-lg transition-all duration-200 transform hover:scale-110 focus:outline-none focus:ring-0 border border-gray-200 dark:border-gray-700"
          style={{ zIndex: 10 }}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
      
      {/* Input Area - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-50 dark:bg-gray-950" style={{ paddingBottom: "76px" }}>
        <div className="mx-auto w-full">
          <form
            onSubmit={handleSubmit}
            className="relative focus:outline-none"
          >
            <div className="relative bg-gray-200 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-3xl shadow-lg px-5 py-4 w-full">
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
                    className="absolute -top-2 -right-2 bg-gray-700 dark:bg-gray-600 text-white rounded-full p-1 shadow-md hover:bg-gray-600 dark:hover:bg-gray-500 focus:outline-none focus:ring-0"
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
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors p-1 focus:outline-none focus:ring-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors p-1 focus:outline-none focus:ring-0"
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
                  className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:outline-none focus:ring-0 text-[15px]"
                  disabled={isLoading}
                  style={{ WebkitAppearance: 'none' }}
                />
                
                {/* Send button */}
                <button
                  type="submit"
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className={cn(
                    "ml-2 rounded-full p-1.5 transition-all focus:outline-none focus:ring-0",
                    (!input.trim() && !selectedImage) || isLoading
                      ? "bg-gray-400 dark:bg-gray-700 text-gray-600 dark:text-gray-500 cursor-not-allowed"
                      : "bg-gray-700 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}