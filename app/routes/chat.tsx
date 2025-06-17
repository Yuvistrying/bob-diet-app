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
  
  // Convex queries
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const chatHistory = useQuery(api.chatHistory.getChatHistory, { limit: 20 }); // Reduced for performance
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
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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



  // Load chat history on mount
  useEffect(() => {
    if (chatHistory && !hasLoadedHistory) {
      const formattedHistory: Message[] = chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        // Don't load old confirmFood tool calls from history - they've already been acted upon
        toolCalls: msg.metadata?.toolCalls?.filter((tc: any) => 
          tc.toolName !== "confirmFood"
        ) || undefined
      }));
      
      // Set messages from database history
      setMessages(formattedHistory);
      
      // Only show welcome message if there's truly no history
      if (chatHistory.length === 0) {
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
  }, [chatHistory, onboardingStatus, profile, hasLoadedHistory]);

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
    if (percentage < 80) return "bg-yellow-100 text-yellow-800";
    if (percentage <= 100) return "bg-green-100 text-green-800";
    return "bg-red-100 text-red-800";
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
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render chat if not signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <div>
          <h1 className="font-semibold">Bob - Your Diet Coach</h1>
          {sessionStats && (
            <p className="text-xs text-gray-500">
              {sessionStats.isToday ? 
                `Today's chat (${sessionStats.messageCount} messages)` : 
                "New daily chat will start automatically"}
            </p>
          )}
          {/* DEBUG: Show profile data */}
          {process.env.NODE_ENV === "development" && profile && (
            <p className="text-xs text-gray-400 mt-1">
              Name: {profile.name} | Age: {profile.age} | Height: {profile.height}cm | Target: {profile.targetWeight}kg
            </p>
          )}
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
              className="text-xs text-gray-500"
            >
              🔄 Reset Onboarding
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
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
          >
            New Chat
          </Button>
        </div>
      </div>


      {/* Status Cards Grid - Only show after onboarding - Always visible */}
      {!isOnboarding && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-white flex-shrink-0">
          {/* Goal Card */}
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Goal</div>
              <div className="font-semibold">
                {profile?.goal === "cut" ? "Cut" : profile?.goal === "gain" ? "Gain" : "Maintain"}
              </div>
              {profile?.targetWeight && (
                <div className="text-xs text-gray-500 mt-1">
                  Target: {profile.targetWeight} {profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calories Card */}
          <Card className={cn(todayStats && profile && getProgressColor(todayStats.calories, profile.dailyCalorieTarget))}>
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Daily Calories</div>
              <div className="font-semibold">
                {isStealthMode ? (
                  todayStats && profile && todayStats.calories > profile.dailyCalorieTarget ? "Over" : "On Track"
                ) : (
                  `${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000}`
                )}
              </div>
            </CardContent>
          </Card>

          {/* Weight Card */}
          <Card className="bg-green-100 text-green-800">
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Current Weight</div>
              <div className="font-semibold">
                {latestWeight?.weight || profile?.currentWeight || "—"} {latestWeight?.unit || profile?.preferredUnits === "imperial" ? "lbs" : "kg"}
              </div>
            </CardContent>
          </Card>

          {/* Protein Card */}
          <Card className={cn(todayStats && profile && getProgressColor(todayStats.protein, profile.proteinTarget))}>
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Daily Proteins (gr)</div>
              <div className="font-semibold">
                {isStealthMode ? (
                  todayStats && profile && todayStats.protein < profile.proteinTarget * 0.8 ? "Need More" : "Good"
                ) : (
                  `${todayStats?.protein || 0}/${profile?.proteinTarget || 150}`
                )}
              </div>
            </CardContent>
          </Card>

          {/* Carbs Card */}
          {!isStealthMode && (
            <Card className={cn(todayStats && profile?.carbsTarget && getProgressColor(todayStats.carbs, profile.carbsTarget))}>
              <CardContent className="p-3">
                <div className="text-xs text-gray-600 mb-1">Daily Carbs</div>
                <div className="font-semibold">
                  {todayStats?.carbs || 0}/{profile?.carbsTarget || 200}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fats Card */}
          {!isStealthMode && (
            <Card className={cn(todayStats && profile?.fatTarget && getProgressColor(todayStats.fat, profile.fatTarget))}>
              <CardContent className="p-3">
                <div className="text-xs text-gray-600 mb-1">Daily Fats (gr)</div>
                <div className="font-semibold">
                  {todayStats?.fat || 0}/{profile?.fatTarget || 65}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Chat Messages - Scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <ClientOnly>
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
                    <div className="max-w-[80%] px-4 py-2 rounded-2xl text-sm bg-gray-100 text-gray-800 rounded-bl-sm">
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                  
                  {/* Food confirmation card */}
                  <div className="flex justify-start">
                    <Card className="max-w-[80%] bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="font-medium mb-2">Got it! Let me confirm what you had:</div>
                        <div className="space-y-1">
                          {args.items.map((item: any, i: number) => (
                            <div key={i} className="text-sm">
                              • {item.name} ({item.quantity}) - {item.calories} cal
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <div className="font-medium">
                            Total: {args.totalCalories} calories
                          </div>
                          {!isStealthMode && (
                            <div className="text-xs text-gray-600">
                              {args.totalProtein}g protein • {args.totalCarbs}g carbs • {args.totalFat}g fat
                            </div>
                          )}
                        </div>
                        <div className="mt-3 space-y-3">
                          <div className="font-medium">
                            Should I log this as your {args.mealType}? 🤔
                          </div>
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
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
                            Yes, log it!
                          </Button>
                          <p className="text-xs text-gray-600 text-center">
                            If this isn't accurate, just tell me what to change in the chat below
                          </p>
                        </div>
                      </CardContent>
                    </Card>
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
              <div
                className={cn(
                  "max-w-[80%] px-4 py-2 rounded-2xl text-sm",
                  message.role === "user"
                    ? "bg-gray-800 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                )}
              >
                {message.imageUrl && message.imageUrl !== "[Photo uploaded]" && (
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded food" 
                    className="max-w-full rounded-lg mb-2"
                    style={{ maxHeight: '200px' }}
                  />
                )}
                {message.imageUrl === "[Photo uploaded]" && message.role === "user" && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Camera className="h-4 w-4" />
                    <span>Photo uploaded</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          );
        })}
        </ClientOnly>
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Responses for Onboarding */}
      {isOnboarding && currentOnboardingStep && (
        <div className="border-t bg-gray-50 px-4 py-3">
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
        className="border-t bg-white px-4 py-3 flex-shrink-0"
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
              className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1"
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
            className="text-gray-500"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-gray-500"
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
            className="flex-1 border-gray-300"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="bg-gray-800 hover:bg-gray-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}