import { httpRouter } from "convex/server";
import { paymentWebhook } from "./subscriptions";
import { httpAction } from "./_generated/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { api } from "./_generated/api";

export const chat = httpAction(async (ctx, req) => {
  // Extract the `messages` from the body of the request
  const { messages } = await req.json();

  // Check if we have the API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  // Get the last user message
  const lastUserMessage = messages[messages.length - 1];
  const userMessage = lastUserMessage?.content || "";

  // Get user context for Bob
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  // Check if user has completed onboarding
  const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
  
  // If no profile, Bob should guide through onboarding
  if (!profile) {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages,
      system: `You are Bob, a friendly AI diet coach. The user hasn't completed onboarding yet. 
      Guide them warmly: "Hey there! I'm Bob, your personal diet coach 🏋️‍♂️ Before we start tracking your nutrition, I need to learn a bit about you. What's your name?"
      Keep responses short, warm, and encouraging.`,
    });

    return result.toDataStreamResponse({
      headers: {
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5174",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        Vary: "origin",
      },
    });
  }

  // Get chat context
  const context = await ctx.runQuery(api.chatHistory.getChatContext);

  // Build system prompt with user context
  const systemPrompt = `You are Bob, a friendly AI diet coach helping ${context?.user.name || "there"}.
  
User Profile:
  - Goal: ${context?.user.goal || "maintain"}
  - Current weight: ${context?.user.currentWeight || "unknown"}kg
  - Display mode: ${context?.user.displayMode || "standard"}
  
Today's Progress:
  - Calories: ${context?.todayProgress.calories.consumed}/${context?.todayProgress.calories.target} (${context?.todayProgress.calories.remaining} remaining)
  - Protein: ${context?.todayProgress.protein.consumed}/${context?.todayProgress.protein.target}g
  - Meals logged: ${context?.todayProgress.meals}
  
IMPORTANT: When the user mentions food or weight:
  - For food: Acknowledge what they ate and estimate calories/macros. Be encouraging!
  - For weight: Acknowledge the weight and provide supportive feedback based on their goal.
  - If display mode is "stealth", avoid showing numbers - focus on positive reinforcement.
  
Personality: Casual, supportive gym buddy. Use emojis sparingly. Keep responses concise.`;

  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    messages,
    system: systemPrompt,
    async onFinish({ text }) {
      // After streaming, process the message for logging
      try {
        // Save the conversation
        await ctx.runMutation(api.chatHistory.saveUserMessage, {
          content: userMessage,
        });
        
        await ctx.runMutation(api.chatHistory.saveBobMessage, {
          content: text,
        });

        // Check if this was a food or weight mention and log it
        const lowerMessage = userMessage.toLowerCase();
        
        // Simple food detection
        if (lowerMessage.includes("ate") || lowerMessage.includes("had") || 
            lowerMessage.includes("eating") || lowerMessage.includes("breakfast") ||
            lowerMessage.includes("lunch") || lowerMessage.includes("dinner")) {
          // Log as food with AI estimation
          await ctx.runMutation(api.foodLogs.logFood, {
            description: userMessage,
            foods: [{
              name: userMessage,
              quantity: "1 serving",
              calories: 300, // Default estimate
              protein: 20,
              carbs: 30,
              fat: 10
            }],
            aiEstimated: true,
            confidence: "medium"
          });
        }
        
        // Simple weight detection
        if ((lowerMessage.includes("weight") || lowerMessage.includes("weigh")) && 
            /\d+/.test(userMessage)) {
          const weightMatch = userMessage.match(/(\d+\.?\d*)/);
          if (weightMatch) {
            await ctx.runMutation(api.weightLogs.logWeight, {
              weight: parseFloat(weightMatch[1]),
              unit: "kg"
            });
          }
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    },
  });

  return result.toDataStreamResponse({
    headers: {
      "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5174",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      Vary: "origin",
    },
  });
});

const http = httpRouter();

http.route({
  path: "/api/chat",
  method: "POST",
  handler: chat,
});

http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

http.route({
  path: "/api/auth/webhook",
  method: "POST",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5173",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

http.route({
  path: "/payments/webhook",
  method: "POST",
  handler: paymentWebhook,
});

// Log that routes are configured
console.log("HTTP routes configured");

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
