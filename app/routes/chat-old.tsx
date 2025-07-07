"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { useAuth } from "@clerk/react-router";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Button } from "~/app/components/ui/button";
import { Input } from "~/app/components/ui/input";
import { Card, CardContent } from "~/app/components/ui/card";
import { cn } from "~/lib/utils";
import { Paperclip, Send } from "lucide-react";

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL!.replace(
  /.cloud$/,
  ".site",
);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Chat() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery(api.userProfiles.getUserProfile, {});
  const todayStats = useQuery(api.foodLogs.getTodayStats);
  const latestWeight = useQuery(api.weightLogs.getLatestWeight);
  const preferences = useQuery(api.userPreferences.getUserPreferences);
  const onboardingStatus = useQuery(api.onboarding.getOnboardingStatus);
  const sendMessage = useAction(api.ai.chatAction);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (isSignedIn === false) {
      navigate("/sign-in");
    }
  }, [isSignedIn, navigate]);

  // Set initial message based on onboarding status
  useEffect(() => {
    if (onboardingStatus !== undefined) {
      if (!onboardingStatus?.completed) {
        // Start onboarding
        if (messages.length === 0 || messages[0].id !== "onboarding-start") {
          setMessages([
            {
              id: "onboarding-start",
              role: "assistant",
              content:
                "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nFirst up - what should I call you?",
            },
          ]);
        }
      } else if (profile && messages.length === 0) {
        // Regular welcome for returning users
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Hey there, ${profile.name}!\nTell me what you're eating, or attach a photo, I'll figure out the rest.`,
          },
        ]);
      } else if (
        profile &&
        messages.length > 0 &&
        messages[0].id === "onboarding-start"
      ) {
        // Onboarding just completed, show welcome
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: `Awesome! You're all set up, ${profile.name}! 🎉\n\nI'm here to help you ${profile.goal === "cut" ? "lose weight" : profile.goal === "gain" ? "gain muscle" : "maintain your weight"}. Just tell me what you're eating throughout the day, and I'll track everything for you.\n\nLet's start - what did you have for your last meal?`,
          },
        ]);
      }
    }
  }, [onboardingStatus, profile]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isStealthMode = preferences?.displayMode === "stealth";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendMessage({
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.text,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't process that message. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressColor = (value: number, target: number) => {
    const percentage = (value / target) * 100;
    if (percentage < 80) return "bg-yellow-100 text-yellow-800";
    if (percentage <= 100) return "bg-green-100 text-green-800";
    return "bg-red-100 text-red-800";
  };

  const isOnboarding = !onboardingStatus?.completed;

  // Show loading state while checking auth
  if (isSignedIn === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status Cards Grid - Only show after onboarding */}
      {!isOnboarding && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-white">
          {/* Goal Card */}
          <Card className="bg-gray-50">
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Goal</div>
              <div className="font-semibold">
                {profile?.goal === "cut"
                  ? "Cut"
                  : profile?.goal === "gain"
                    ? "Gain"
                    : "Maintain"}
              </div>
            </CardContent>
          </Card>

          {/* Calories Card */}
          <Card
            className={cn(
              todayStats &&
                profile &&
                getProgressColor(
                  todayStats.calories,
                  profile.dailyCalorieTarget,
                ),
            )}
          >
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Daily Calories</div>
              <div className="font-semibold">
                {isStealthMode
                  ? todayStats &&
                    profile &&
                    todayStats.calories > profile.dailyCalorieTarget
                    ? "Over"
                    : "On Track"
                  : `${todayStats?.calories || 0}/${profile?.dailyCalorieTarget || 2000}`}
              </div>
            </CardContent>
          </Card>

          {/* Weight Card */}
          <Card className="bg-green-100 text-green-800">
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">Average Weight</div>
              <div className="font-semibold">
                {latestWeight?.weight || profile?.currentWeight || "—"}{" "}
                {latestWeight?.unit || "kg"}
              </div>
            </CardContent>
          </Card>

          {/* Protein Card */}
          <Card
            className={cn(
              todayStats &&
                profile &&
                getProgressColor(todayStats.protein, profile.proteinTarget),
            )}
          >
            <CardContent className="p-3">
              <div className="text-xs text-gray-600 mb-1">
                Daily Proteins (gr)
              </div>
              <div className="font-semibold">
                {isStealthMode
                  ? todayStats &&
                    profile &&
                    todayStats.protein < profile.proteinTarget * 0.8
                    ? "Need More"
                    : "Good"
                  : `${todayStats?.protein || 0}/${profile?.proteinTarget || 150}`}
              </div>
            </CardContent>
          </Card>

          {/* Carbs Card */}
          {!isStealthMode && (
            <Card
              className={cn(
                todayStats &&
                  profile &&
                  getProgressColor(todayStats.carbs, profile.carbsTarget),
              )}
            >
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
            <Card
              className={cn(
                todayStats &&
                  profile &&
                  getProgressColor(todayStats.fat, profile.fatTarget),
              )}
            >
              <CardContent className="p-3">
                <div className="text-xs text-gray-600 mb-1">
                  Daily Fats (gr)
                </div>
                <div className="font-semibold">
                  {todayStats?.fat || 0}/{profile?.fatTarget || 65}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] px-4 py-2 rounded-2xl text-sm",
                message.role === "user"
                  ? "bg-gray-800 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm",
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t bg-white px-4 py-3">
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
