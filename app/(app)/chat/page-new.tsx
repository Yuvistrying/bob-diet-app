"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Card, CardContent } from "~/app/components/ui/card";
import { cn } from "~/lib/utils";
import { Camera, ArrowUp, X, Check, Settings, PenSquare, ChevronDown } from "lucide-react";
import { ClientOnly } from "~/app/components/ClientOnly";
import { OnboardingQuickResponses } from "~/app/components/OnboardingQuickResponses";
import { ProfileEditModal } from "~/app/components/ProfileEditModal";
import { MarkdownMessage } from "~/app/components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
  imageUrl?: string;
  storageId?: string;
}

export default function Chat() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  
  // State
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
  
  // Convex mutations/actions
  const sendMessage = useAction(api.agentActions.chat);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const storeFileId = useMutation(api.files.storeFileId);
  const saveAgentThreadId = useMutation(api.userPreferences.saveAgentThreadId);
  const startNewChatSession = useMutation(api.chatSessions.startNewChatSession);
  const getOrCreateDailySession = useMutation(api.chatSessions.getOrCreateDailySession);

  // Get image URLs for messages with storage IDs
  const storageIdsFromMessages = messages
    .filter(msg => msg.storageId)
    .map(msg => msg.storageId as Id<"_storage">);
    
  const imageUrls = useQuery(
    api.files.getMultipleImageUrls, 
    storageIdsFromMessages.length > 0 
      ? { storageIds: storageIdsFromMessages }
      : "skip"
  );

  // Redirect if not signed in
  useEffect(() => {
    if (!isSignedIn) {
      router.push("/sign-in");
    }
  }, [isSignedIn, router]);

  // Clear old localStorage data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chatMessages');
      localStorage.removeItem('agentThreadId');
      localStorage.removeItem('threadId');
    }
  }, []);

  // Load thread ID from preferences
  useEffect(() => {
    if (preferences?.agentThreadId && !threadId) {
      setThreadId(preferences.agentThreadId);
    }
  }, [preferences, threadId]);

  // Load chat history
  useEffect(() => {
    if (chatHistory && !hasLoadedHistory) {
      const formattedMessages = chatHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        toolCalls: msg.metadata?.toolCalls,
        storageId: msg.metadata?.storageId,
      }));
      setMessages(formattedMessages);
      setHasLoadedHistory(true);
    }
  }, [chatHistory, hasLoadedHistory]);

  // Update message image URLs when they're loaded
  useEffect(() => {
    if (imageUrls) {
      setMessages(prev => prev.map(msg => {
        if (msg.storageId && imageUrls[msg.storageId]) {
          return { ...msg, imageUrl: imageUrls[msg.storageId] };
        }
        return msg;
      }));
    }
  }, [imageUrls]);

  // Scroll handling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollToBottom(!isNearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    // Handle image upload if present
    let storageId = null;
    if (selectedImage) {
      try {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedImage.type },
          body: selectedImage,
        });
        
        if (!response.ok) {
          throw new Error("Failed to upload image");
        }
        
        const { storageId: uploadedStorageId } = await response.json();
        storageId = uploadedStorageId;
        
        await storeFileId({ storageId: uploadedStorageId });
        
        userMessage.storageId = storageId;
        userMessage.content = userMessage.content || "Please analyze this food photo";
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    }

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSelectedImage(null);
    setImagePreview(null);
    setIsLoading(true);

    try {
      const result = await sendMessage({
        prompt: userMessage.content,
        threadId: threadId || undefined,
        storageId: storageId || undefined
      });
      
      if (result.threadId && !threadId) {
        setThreadId(result.threadId);
        await saveAgentThreadId({ threadId: result.threadId });
      }
      
      const assistantMessage: Message = {
        role: "assistant",
        content: result.text,
        toolCalls: result.toolCalls,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmFoodLog = async (toolCall: any) => {
    const foodData = toolCall.args;
    setConfirmedFoodLogs(prev => new Set([...prev, toolCall.toolCallId]));
    
    // Trigger a confirmation message
    const confirmationMessage: Message = {
      role: "user",
      content: "Yes, that's correct!",
    };
    
    setMessages(prev => [...prev, confirmationMessage]);
    setIsLoading(true);
    
    try {
      const result = await sendMessage({
        prompt: "Yes, that's correct!",
        threadId: threadId || undefined,
      });
      
      const assistantMessage: Message = {
        role: "assistant",
        content: result.text,
        toolCalls: result.toolCalls,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error confirming food:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickResponse = (response: string) => {
    setInput(response);
    const form = document.querySelector('form');
    if (form) {
      form.requestSubmit();
    }
  };

  const needsOnboarding = onboardingStatus === false || !profile;
  const showHeader = !needsOnboarding && todayStats;

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Please sign in to use the chat.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="flex flex-col h-full">
        {/* Header with stats */}
        {showHeader && (
          <div className="bg-background border-b">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-semibold">Chat with Bob</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/settings")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center p-2 bg-muted/50 rounded-lg">
                  <div className="font-semibold">{todayStats.calories}</div>
                  <div className="text-xs text-muted-foreground">calories</div>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded-lg">
                  <div className="font-semibold">{todayStats.protein}g</div>
                  <div className="text-xs text-muted-foreground">protein</div>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded-lg">
                  <div className="font-semibold">{latestWeight?.weight || '--'}</div>
                  <div className="text-xs text-muted-foreground">lbs</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground mt-8">
              <p className="text-lg font-medium mb-2">
                {needsOnboarding 
                  ? "👋 Hi! I'm Bob, your AI diet coach."
                  : `Welcome back${profile?.name ? `, ${profile.name}` : ''}!`}
              </p>
              <p>
                {needsOnboarding 
                  ? "Let's get started by learning about your goals."
                  : "How can I help you today?"}
              </p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg p-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.imageUrl && (
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded" 
                    className="mb-2 rounded max-w-full h-auto"
                  />
                )}
                {message.role === "assistant" ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
                
                {/* Tool calls */}
                {message.toolCalls?.map((toolCall: any, tcIndex: number) => {
                  if (toolCall.toolName === "confirmFood" && toolCall.args) {
                    const foodData = toolCall.args;
                    const isConfirmed = confirmedFoodLogs.has(toolCall.toolCallId);
                    
                    return (
                      <Card key={`${index}-${tcIndex}`} className="mt-3">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold capitalize">{foodData.meal || 'Food'}</h4>
                            {!isConfirmed && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600"
                                onClick={() => confirmFoodLog(toolCall)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {isConfirmed && (
                              <span className="text-green-600 text-sm flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                Logged
                              </span>
                            )}
                          </div>
                          
                          <ul className="text-sm space-y-1">
                            {foodData.items?.map((item: any, idx: number) => (
                              <li key={idx}>
                                {item.name} - {item.calories}cal
                                {item.protein && ` • ${item.protein}g protein`}
                              </li>
                            ))}
                          </ul>
                          
                          {foodData.totalCalories && (
                            <div className="mt-2 pt-2 border-t text-sm">
                              <div className="flex justify-between">
                                <span>Total:</span>
                                <span className="font-medium">{foodData.totalCalories} calories</span>
                              </div>
                              {foodData.totalProtein && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  P: {foodData.totalProtein}g • C: {foodData.totalCarbs}g • F: {foodData.totalFat}g
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <Button
            size="icon"
            variant="secondary"
            className="fixed bottom-24 right-4 rounded-full shadow-lg"
            onClick={scrollToBottom}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}

        {/* Quick responses for onboarding */}
        {needsOnboarding && messages.length < 2 && (
          <OnboardingQuickResponses onSelect={handleQuickResponse} />
        )}

        {/* Input form */}
        <div className="border-t p-4">
          {imagePreview && (
            <div className="relative inline-block mb-2">
              <img 
                src={imagePreview} 
                alt="Selected" 
                className="h-20 w-20 object-cover rounded"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={removeImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </Button>
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={needsOnboarding ? "Tell me about yourself..." : "Ask me anything..."}
              disabled={isLoading}
              className="flex-1"
            />
            
            <Button type="submit" size="icon" disabled={isLoading || (!input.trim() && !selectedImage)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {/* Profile edit modal */}
        {showProfileEdit && profile && (
          <ProfileEditModal
            profile={profile}
            onClose={() => setShowProfileEdit(false)}
            onUpdate={async (data) => {
              // Handle profile update
              setShowProfileEdit(false);
            }}
          />
        )}
      </div>
    </ClientOnly>
  );
}