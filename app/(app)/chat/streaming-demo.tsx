"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { cn } from "~/lib/utils";
import { ArrowUp, X, Check, Square, Loader2 } from "lucide-react";
import { useStreamingChat } from "~/app/hooks/useStreamingChat";
import { MarkdownMessage } from "~/app/components/MarkdownMessage";

export default function StreamingChatDemo() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [confirmedFoodLogs, setConfirmedFoodLogs] = useState<Set<string>>(new Set());
  
  // Convex queries
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const saveAgentThreadId = useMutation(api.userPreferences.saveAgentThreadId);
  
  // Use streaming chat hook
  const {
    messages,
    isStreaming,
    threadId,
    sendMessage,
    stopStreaming,
    setThreadId
  } = useStreamingChat({
    onComplete: async (newThreadId) => {
      if (newThreadId && !threadId) {
        await saveAgentThreadId({ threadId: newThreadId });
      }
    },
    onToolCall: (toolCall) => {
      console.log('Tool called:', toolCall);
    }
  });
  
  // Redirect if not signed in
  useEffect(() => {
    if (isSignedIn === false) {
      router.push("/sign-in");
    }
  }, [isSignedIn, router]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    const userInput = input.trim();
    setInput("");
    
    // Send message with streaming
    await sendMessage(userInput, threadId || undefined);
  };
  
  const getConfirmationId = (args: any) => {
    const foodNames = args.items?.map((item: any) => item.name).join('-') || '';
    return `${args.mealType}-${args.totalCalories}-${foodNames}`;
  };
  
  if (isSignedIn === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!isSignedIn) return null;
  
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-black">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
              Bob - Streaming Demo 🚀
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time streaming responses
            </p>
          </div>
          {todayStats && profile && (
            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              {todayStats.calories}/{profile.dailyCalorieTarget} cal
            </div>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => {
            // Handle tool calls
            if (message.toolCalls && message.toolCalls.length > 0) {
              const confirmFoodCall = message.toolCalls.find(tc => tc.toolName === "confirmFood");
              if (confirmFoodCall) {
                const args = confirmFoodCall.args;
                const confirmId = getConfirmationId(args);
                const isConfirmed = confirmedFoodLogs.has(confirmId);
                
                return (
                  <div key={index} className="space-y-4">
                    {/* Assistant message */}
                    <div className="flex justify-start">
                      <div className="max-w-[70%]">
                        <MarkdownMessage content={message.content} />
                      </div>
                    </div>
                    
                    {/* Confirmation card */}
                    <div className="flex justify-start">
                      <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
                        {isConfirmed ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <Check className="h-4 w-4" />
                            <span className="font-medium">Logged {args.mealType} • {args.totalCalories} calories</span>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium mb-2">Got it! Let me confirm:</div>
                            <div className="space-y-1 text-sm mb-3">
                              {args.items.map((item: any, i: number) => (
                                <div key={i}>• {item.name} {item.quantity} - {item.calories} cal</div>
                              ))}
                            </div>
                            <div className="font-medium mb-3">
                              Total: {args.totalCalories} calories
                            </div>
                            <Button
                              className="w-full"
                              onClick={async () => {
                                setConfirmedFoodLogs(prev => new Set(prev).add(confirmId));
                                await sendMessage("yes", threadId || undefined);
                              }}
                              disabled={isStreaming}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Yes, log it!
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            }
            
            // Regular message
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
                    "max-w-[70%] px-4 py-2.5 rounded-2xl",
                    message.role === "user"
                      ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      : ""
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="relative">
                      <MarkdownMessage content={message.content} />
                      {message.isStreaming && (
                        <span className="inline-block w-1 h-4 bg-gray-400 dark:bg-gray-600 animate-pulse ml-1" />
                      )}
                    </div>
                  ) : (
                    <div>{message.content}</div>
                  )}
                </div>
              </div>
            );
          })}
          
          {isStreaming && messages[messages.length - 1]?.content === "" && (
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
      
      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-black">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Bob anything..."
              className="w-full px-4 py-3 pr-12 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="absolute right-2 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={cn(
                  "absolute right-2 p-2 rounded-full transition-colors",
                  input.trim()
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}