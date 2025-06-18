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
import { Camera, Paperclip, Send, X, Check, Settings } from "lucide-react";
import { ClientOnly } from "~/components/ClientOnly";
import { OnboardingQuickResponses } from "~/components/OnboardingQuickResponses";
import { ProfileEditModal } from "~/components/ProfileEditModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  imageUrl?: string;
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
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Convex queries
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const chatHistory = useQuery(api.chatHistory.getChatHistory, { 
    limit: 20, 
    offset: messageOffset 
  });
  const sessionStats = useQuery(api.chatSessions.getSessionStats);
  
  // Convex action for Agent SDK
  const sendMessage = useAction(api.agentActions.chat);
  
  // Convex mutations for file upload
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const storeFileId = useMutation(api.files.storeFileId);
  const resetOnboarding = useMutation(api.onboarding.resetOnboarding);
  const forceCompleteOnboarding = useMutation(api.onboardingFix.forceCompleteOnboarding);
  
  // Convex mutation to save thread ID
  const saveAgentThreadId = useMutation(api.userPreferences.saveAgentThreadId);
  const startNewChatSession = useMutation(api.chatSessions.startNewChatSession);

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
    }
  }, []);

  // Load thread ID from preferences
  useEffect(() => {
    if (preferences?.agentThreadId && !threadId) {
      setThreadId(preferences.agentThreadId);
    }
  }, [preferences?.agentThreadId]);

  // Check if we need a new session for today
  useEffect(() => {
    const checkDailySession = async () => {
      if (sessionStats && !sessionStats.isToday) {
        // Session is from a previous day, create new one
        try {
          await startNewChatSession();
          // Clear messages for fresh start
          setMessages([{
            role: "assistant",
            content: `Good morning ${profile?.name || "there"}! 🌅 Starting fresh for today. What can I help you with?`,
          }]);
          setThreadId(null);
        } catch (error) {
          console.error("Error creating daily session:", error);
        }
      }
    };
    
    checkDailySession();
  }, [sessionStats?.isToday]);



  // Load chat history on mount
  useEffect(() => {
    if (chatHistory && !hasLoadedHistory && messageOffset === 0) {
      const messages = chatHistory.messages || [];
      const formattedHistory: Message[] = messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        // Don't load old confirmFood tool calls from history - they've already been acted upon
        toolCalls: msg.metadata?.toolCalls?.filter((tc: any) => 
          tc.toolName !== "confirmFood"
        ) || undefined
      }));
      
      // Set messages from database history
      setMessages(formattedHistory);
      
      // Update hasMore state
      setHasMoreMessages(chatHistory.hasMore || false);
      
      // Only show welcome message if there's truly no history
      if (messages.length === 0) {
        const isOnboarding = !onboardingStatus?.completed;
        
        if (isOnboarding) {
          setMessages([{
            role: "assistant",
            content: "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
          }]);
        } else if (profile) {
          setMessages([{
            role: "assistant",
            content: `Welcome back, ${profile.name}! 💪\n\nTell me what you're eating, or attach a photo, and I'll track it for you.`,
          }]);
        }
      }
      setHasLoadedHistory(true);
    }
  }, [chatHistory, onboardingStatus, profile, hasLoadedHistory, messageOffset]);

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
      imageUrl: imagePreview || undefined
    };
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, newUserMessage]);
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
          
          finalMessage = `[Image attached] ${userMessage || "Please analyze this food photo"}`;
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

  // Load more messages
  const loadMoreMessages = async () => {
    if (!hasMoreMessages || isLoadingMore) return;
    
    setIsLoadingMore(true);
    const newOffset = messageOffset + 20;
    setMessageOffset(newOffset);
    
    // Wait for the query to update with new offset
    // The useEffect will handle appending the messages
  };

  // Handle loading more messages when offset changes
  useEffect(() => {
    if (chatHistory && messageOffset > 0) {
      const newMessages = chatHistory.messages || [];
      if (newMessages.length > 0) {
        const formattedHistory: Message[] = newMessages.map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
          toolCalls: msg.metadata?.toolCalls?.filter((tc: any) => 
            tc.toolName !== "confirmFood"
          ) || undefined
        }));
        
        // Prepend older messages to the beginning
        setMessages(prev => [...formattedHistory, ...prev]);
        
        // Update hasMore state
        if (chatHistory.hasMore !== undefined) {
          setHasMoreMessages(chatHistory.hasMore);
        }
      }
      setIsLoadingMore(false);
    }
  }, [chatHistory, messageOffset]);

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
    if (percentage < 80) return "text-muted-foreground";
    if (percentage <= 100) return "text-foreground";
    return "text-muted-foreground";
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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="border-b p-4 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="font-semibold text-lg">Bob - Diet Coach</h1>
        </div>
        <div className="flex gap-2">
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
            className="text-sm"
            variant="outline"
            size="sm"
          >
            New Chat
          </Button>
        </div>
      </div>


      {/* Status Cards Grid - Only show after onboarding - Always visible */}
      {!isOnboarding && (
        <div className="grid grid-cols-3 gap-2 p-3 border-b flex-shrink-0">
          {/* Goal Card */}
          <Card>
            <CardContent className="p-2 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">🎯 Goal</div>
              <div className="text-lg font-semibold font-mono">
                {profile?.goal === "cut" ? "Cut" : profile?.goal === "gain" ? "Gain" : "Maintain"}
              </div>
              {profile?.targetWeight && (
                <div className="text-xs text-muted-foreground font-mono">
                  {profile.targetWeight} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Weight Card */}
          <Card>
            <CardContent className="p-2 text-center">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">⚖️ Current</div>
              <div className="text-lg font-semibold font-mono">
                {latestWeight?.weight || profile?.currentWeight || "—"}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {latestWeight?.unit || (profile?.preferredUnits === "imperial" ? "lbs" : "kg")}
              </div>
            </CardContent>
          </Card>

          {/* Nutrition Card */}
          <Card>
            <CardContent className="p-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono text-center mb-1">🔥 Nutrition</div>
              <div className="space-y-0.5">
                {/* Calories - Always show */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono">Cals</span>
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
                    <span className="text-xs font-mono">Protein</span>
                    <span className={cn("text-xs font-semibold font-mono", todayStats && profile ? getProgressColor(todayStats.protein, profile.proteinTarget) : "")}>
                      {isStealthMode ? (
                        todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 ? "Low" : "OK"
                      ) : (
                        `${todayStats?.protein || 0}/${profile?.proteinTarget || 150}g`
                      )}
                    </span>
                  </div>
                )}
                
                {/* Carbs - Show based on preference */}
                {!isStealthMode && preferences?.showCarbs !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">Carbs</span>
                    <span className={cn("text-xs font-semibold font-mono", todayStats && profile?.carbsTarget ? getProgressColor(todayStats.carbs, profile.carbsTarget) : "")}>
                      {todayStats?.carbs || 0}/{profile?.carbsTarget || 200}g
                    </span>
                  </div>
                )}
                
                {/* Fats - Show based on preference */}
                {!isStealthMode && preferences?.showFats !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono">Fats</span>
                    <span className={cn("text-xs font-semibold font-mono", todayStats && profile?.fatTarget ? getProgressColor(todayStats.fat, profile.fatTarget) : "")}>
                      {todayStats?.fat || 0}/{profile?.fatTarget || 65}g
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chat Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto bg-gray-100 px-3 py-3 pb-20 space-y-3">
        <ClientOnly>
          {/* Load More Button */}
          {hasMoreMessages && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadMoreMessages}
                disabled={isLoadingMore}
                className="text-sm px-4 py-2 bg-background text-muted-foreground border rounded-full hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {isLoadingMore ? "Loading..." : "Load older messages"}
              </button>
            </div>
          )}
          
          <div ref={messagesTopRef} />
          
          {messages.map((message, index) => {
          // Handle messages with tool calls (like confirmFood)
          if (message.toolCalls && message.toolCalls.length > 0) {
            const confirmFoodCall = message.toolCalls.find(tc => tc.toolName === "confirmFood");
            if (confirmFoodCall) {
              const args = confirmFoodCall.args;
              return (
                <div key={index} className="space-y-4">
                  {/* Bob's message */}
                  <div className="flex justify-start">
                    <div className="max-w-[70%] text-sm text-gray-600">
                      <div className="leading-relaxed">{message.content}</div>
                    </div>
                  </div>
                  
                  {/* Food confirmation card */}
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-muted/50 border border-border">
                        <div className="font-medium mb-2">Got it! Let me confirm what you had: 📝</div>
                        <div className="space-y-1">
                          {args.items.map((item: any, i: number) => (
                            <div key={i} className="text-sm font-mono">
                              • {item.name} ({item.quantity}) - {item.calories} cal
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <div className="font-medium font-mono">
                            Total: {args.totalCalories} calories
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-muted-foreground mt-1 font-mono">
                              {args.totalProtein}g protein • {args.totalCarbs}g carbs • {args.totalFat}g fat
                            </div>
                          )}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="text-sm">
                            Should I log this as your {args.mealType}? 🤔
                          </div>
                          <Button
                            className="w-full"
                            variant="default"
                            onClick={async () => {
                              // Add user message
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
                              }
                            }}
                            disabled={isLoading}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Yes, log it! 📝
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">
                            If this isn't accurate, just tell me what to change in the chat below
                          </p>
                        </div>
                    </div>
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
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "user" ? (
                <div className={cn(
                  "max-w-[70%] px-4 py-2",
                  "bg-gray-300 text-gray-800",
                  "rounded-2xl rounded-br-sm",
                  "shadow-sm"
                )}>
                  {message.imageUrl && message.imageUrl !== "[Photo uploaded]" && (
                    <img 
                      src={message.imageUrl} 
                      alt="Uploaded food" 
                      className="max-w-full rounded-lg mb-2"
                      style={{ maxHeight: '200px' }}
                    />
                  )}
                  {message.imageUrl === "[Photo uploaded]" && message.role === "user" && (
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Camera className="h-4 w-4" />
                      <span>Photo uploaded</span>
                    </div>
                  )}
                  <div className="text-sm leading-relaxed">{message.content}</div>
                </div>
              ) : (
                <div className="max-w-[70%] text-sm text-gray-800">
                  <div className="leading-relaxed">{message.content}</div>
                </div>
              )}
            </div>
          );
        })}
        </ClientOnly>
        
        {isLoading && (
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

      {/* Quick Responses for Onboarding */}
      {isOnboarding && currentOnboardingStep && (
        <div className="border-t bg-muted/30 px-4 py-3">
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

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="border-t px-4 py-3 pb-20 flex-shrink-0"
      >
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img 
              src={imagePreview} 
              alt="Selected food" 
              className="h-20 rounded-lg"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
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
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isOnboarding ? "Type your answer..." : selectedImage ? "Add context (optional)" : "Say anything"}
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={(!input.trim() && !selectedImage) || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}