"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/react-router";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Paperclip, Send } from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: any[];
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
  const chatHistory = useQuery(api.chatHistory.getChatHistory, { limit: 50 });
  
  // Convex actions for both AI versions
  const sendMessageV1 = useAction(api.ai.chatAction);
  const sendMessageV2 = useAction(api.agentActions.chat);
  
  // State
  const [messages, setMessages] = useState<Message[]>(() => {
    // Try to load persisted messages
    const saved = localStorage.getItem('chatMessages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [useAgentVersion, setUseAgentVersion] = useState(() => {
    // Persist toggle state in localStorage
    const saved = localStorage.getItem('useAgentVersion');
    return saved === 'true';
  });
  const [agentThreadId, setAgentThreadId] = useState<string | null>(() => {
    // Persist threadId in localStorage
    return localStorage.getItem('agentThreadId');
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isSignedIn === false) {
      navigate("/sign-in");
    }
  }, [isSignedIn, navigate]);

  // Persist toggle state
  useEffect(() => {
    localStorage.setItem('useAgentVersion', useAgentVersion.toString());
  }, [useAgentVersion]);

  // Persist threadId
  useEffect(() => {
    if (agentThreadId) {
      localStorage.setItem('agentThreadId', agentThreadId);
    }
  }, [agentThreadId]);

  // Persist messages
  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  // Load chat history on mount - with proper persistence
  useEffect(() => {
    if (chatHistory && !hasLoadedHistory) {
      // If we have persisted messages and they're more recent, keep them
      const persistedMessages = messages;
      const formattedHistory: Message[] = chatHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        toolCalls: msg.metadata?.toolCalls || undefined
      }));
      
      // If we have more messages persisted than in history, keep the persisted ones
      if (persistedMessages.length > formattedHistory.length) {
        console.log('Keeping persisted messages as they are more recent');
      } else {
        setMessages(formattedHistory);
      }
      
      // Only show welcome message if there's truly no history AND no persisted messages
      if (chatHistory.length === 0 && persistedMessages.length === 0) {
        const isOnboarding = !onboardingStatus?.completed;
        
        if (isOnboarding) {
          setMessages([{
            role: "assistant",
            content: "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nFirst up - what should I call you?",
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
    
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newUserMessage: Message = { role: "user", content: userMessage };
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, newUserMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response;
      
      if (useAgentVersion) {
        // V2: Convex Agent SDK - send prompt with threadId
        response = await sendMessageV2({
          prompt: userMessage,
          threadId: agentThreadId || undefined,
        });
        // Save threadId for future messages
        if (response.threadId && !agentThreadId) {
          setAgentThreadId(response.threadId);
        }
      } else {
        // V1: AI SDK - send full message history
        const messagesForAI = [...messages, newUserMessage].map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
        response = await sendMessageV1({
          messages: messagesForAI,
        });
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

  // Helper functions
  const getProgressColor = (value: number, target: number) => {
    const percentage = (value / target) * 100;
    if (percentage < 80) return "bg-yellow-100 text-yellow-800";
    if (percentage <= 100) return "bg-green-100 text-green-800";
    return "bg-red-100 text-red-800";
  };

  const isOnboarding = !onboardingStatus?.completed;
  const isStealthMode = preferences?.displayMode === "stealth";

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
      <div className="bg-white border-b p-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-semibold">Bob - Your Diet Coach</h1>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="ai-version" className="text-xs text-gray-600">
            AI v1
          </Label>
          <Switch
            id="ai-version"
            checked={useAgentVersion}
            onCheckedChange={setUseAgentVersion}
            className="scale-75"
          />
          <Label htmlFor="ai-version" className="text-xs text-gray-600">
            Agent v2
          </Label>
          {useAgentVersion && (
            <span className="text-xs text-orange-600 ml-2">(Testing)</span>
          )}
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
              <div className="text-xs text-gray-600 mb-1">Average Weight</div>
              <div className="font-semibold">
                {latestWeight?.weight || profile?.currentWeight || "—"} {latestWeight?.unit || "kg"}
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
                        <div className="mt-3 font-medium">
                          Should I log this as your {args.mealType}? 🤔
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
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          );
        })}
        
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

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="border-t bg-white px-4 py-3 flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-gray-500"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isOnboarding ? "Type your answer..." : "Say anything"}
            className="flex-1 border-gray-300"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="bg-gray-800 hover:bg-gray-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}