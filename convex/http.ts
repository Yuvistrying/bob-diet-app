import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { api } from "./_generated/api";
import { paymentWebhook } from "./subscriptions";
import { bobAgent, getBobInstructions } from "./bobAgent";

// Define tools for Bob
const tools = {
  confirmFood: tool({
    description: "Show food understanding and ask for confirmation before logging",
    parameters: z.object({
      description: z.string().describe("Natural description of the food"),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
      })).describe("Breakdown of food items"),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Type of meal based on time of day"),
      confidence: z.enum(["low", "medium", "high"]).describe("Confidence in the estimation"),
    }),
  }),
  
  logFood: tool({
    description: "Actually log the food after user confirmation",
    parameters: z.object({
      description: z.string(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fat: z.number(),
      })),
      totalCalories: z.number(),
      totalProtein: z.number(),
      totalCarbs: z.number(),
      totalFat: z.number(),
      mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      aiEstimated: z.boolean().default(true),
      confidence: z.string(),
    }),
  }),
  
  logWeight: tool({
    description: "Log user's weight",
    parameters: z.object({
      weight: z.number().describe("Weight value"),
      unit: z.enum(["kg", "lbs"]).describe("Weight unit"),
      notes: z.string().optional().describe("Any notes about the weight"),
    }),
  }),
  
  showProgress: tool({
    description: "Show user's daily progress and remaining calories/macros",
    parameters: z.object({
      showDetailed: z.boolean().default(false).describe("Whether to show detailed macro breakdown"),
    }),
  }),
};

export const chat = httpAction(async (ctx, req) => {
  try {
    console.log("HTTP Chat endpoint called");
    console.log("Authorization header:", req.headers.get("Authorization"));
    
    // Extract messages from request
    const { messages } = await req.json();

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5174",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5174",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // Get chat context
    const context = await ctx.runQuery(api.chatHistory.getChatContext);
    const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
    const onboardingStatus = await ctx.runQuery(api.onboarding.getOnboardingStatus);
    
    // Check if user is in onboarding
    const isOnboarding = !onboardingStatus?.completed;
    
    // Get current time for meal type detection
    const now = new Date();
    const hour = now.getHours();
    const defaultMealType = 
      hour < 11 ? "breakfast" :
      hour < 15 ? "lunch" :
      hour < 18 ? "snack" :
      "dinner";

    // Build system prompt
    let systemPrompt: string;
    
    if (isOnboarding) {
      const currentStep = onboardingStatus?.currentStep || "welcome";
      const responses = onboardingStatus?.responses || {};
      
      systemPrompt = `You are Bob, a friendly AI diet coach helping with user onboarding.

CURRENT ONBOARDING STEP: ${currentStep}
COLLECTED DATA: ${JSON.stringify(responses)}

Guide the user through onboarding conversationally. Be casual and wholesome.

ONBOARDING FLOW:
1. name - Ask for their name
2. current_weight - Ask for current weight with unit preference  
3. target_weight - Ask for goal weight
4. height_age - Ask for height (cm) and age
5. gender - Ask for biological sex (for calorie calculations)
6. activity_level - Ask about activity level
7. goal - Ask about their goal (cut/maintain/gain)
8. display_mode - Ask if they want standard mode (see all numbers) or stealth mode

Extract information naturally and use [EXTRACT:step_name:value] format.`;
    } else {
      const isStealthMode = context?.user.displayMode === "stealth";
      
      systemPrompt = `You are Bob, a friendly and encouraging AI diet coach helping ${context?.user.name || "there"}.

USER CONTEXT:
- Name: ${context?.user.name}
- Goal: ${context?.user.goal === "cut" ? "lose weight" : context?.user.goal === "gain" ? "gain muscle" : "maintain weight"}
- Current weight: ${context?.user.currentWeight || "unknown"}kg
- Target weight: ${context?.user.targetWeight || "unknown"}kg  
- Display mode: ${isStealthMode ? "stealth (no numbers)" : "standard (show numbers)"}

TODAY'S PROGRESS:
- Calories: ${context?.todayProgress.calories.consumed}/${context?.todayProgress.calories.target} (${context?.todayProgress.calories.remaining} remaining)
- Protein: ${context?.todayProgress.protein.consumed}/${context?.todayProgress.protein.target}g
- Meals logged: ${context?.todayProgress.meals}

IMPORTANT RULES:
1. ALWAYS ask for confirmation before logging food using the confirmFood tool
2. Parse natural language for food mentions and estimate calories/macros
3. Only use the logFood tool AFTER user explicitly confirms (yes, sure, yep, etc.)
4. If user says no/nope/not quite, ask for clarification
5. ${isStealthMode ? "In stealth mode: Focus on habits and encouragement, avoid showing numbers" : "Show calories and macro counts"}
6. Detect meal type based on time of day (current time: ${hour}:00, likely ${defaultMealType})
7. Be encouraging and supportive, like a gym buddy
8. Keep responses concise and friendly

CONVERSATION FLOW:
- User mentions food → Use confirmFood tool to show understanding
- User confirms → Use logFood tool to save it
- User denies → Ask what to change
- User asks about progress → Use showProgress tool`;
    }

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Process the chat with tools
    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages,
      system: systemPrompt,
      tools,
      maxSteps: 5,
      async onStepFinish({ toolCalls, toolResults, text, finishReason, usage }) {
        // Process tool calls
        for (const toolCall of toolCalls) {
          console.log("Tool called:", toolCall.toolName, toolCall.args);
          
          if (toolCall.toolName === "logFood") {
            // Actually log the food to database
            const args = toolCall.args as any;
            await ctx.runMutation(api.foodLogs.logFood, {
              description: args.description,
              foods: args.items,
              meal: args.mealType,
              aiEstimated: true,
              confidence: args.confidence,
            });
          } else if (toolCall.toolName === "logWeight") {
            // Log weight
            const args = toolCall.args as any;
            await ctx.runMutation(api.weightLogs.logWeight, {
              weight: args.weight,
              unit: args.unit,
              notes: args.notes,
            });
          }
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
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5174",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }
});

const http = httpRouter();

// Main chat endpoint
http.route({
  path: "/api/chat",
  method: "POST",
  handler: chat,
});

// CORS preflight
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:5174",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-stainless-lang, x-stainless-package-version, x-stainless-os, x-stainless-arch, x-stainless-runtime, x-stainless-runtime-version",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

// Webhook endpoint for Polar payment events
http.route({
  path: "/webhooks/polar",
  method: "POST",
  handler: paymentWebhook,
});

// New streaming endpoint for Convex Agent
http.route({
  path: "/api/agent/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { prompt, threadId, storageId, streamMode } = body;
    
    // Get auth from header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    try {
      // Get user identity
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Not authenticated");
      }
      const userId = identity.subject;
      
      // Check if this is a confirmation response
      const isConfirmationResponse = 
        prompt.toLowerCase() === "yes" || 
        prompt.toLowerCase() === "yep" || 
        prompt.toLowerCase() === "sure" ||
        prompt.toLowerCase() === "yes awesome!" ||
        prompt.toLowerCase().includes("correct") ||
        prompt.toLowerCase().includes("that's right");
      
      // Get or create daily session
      const session: any = await ctx.runMutation(api.chatSessions.getOrCreateDailySession, {
        forceKeepThread: isConfirmationResponse
      });
      if (!session) throw new Error("Failed to create session");
      
      // Use session's threadId if no threadId provided
      const finalThreadId = threadId || session.threadId;
      
      // Get context (simplified for streaming)
      const [onboardingStatus, profile, hasWeighedToday, minimalContext, preferences] = await Promise.all([
        ctx.runQuery(api.onboarding.getOnboardingStatus),
        ctx.runQuery(api.userProfiles.getUserProfile, {}),
        ctx.runQuery(api.weightLogs.hasLoggedWeightToday),
        ctx.runQuery(api.chatHistory.getTodayThreadContext),
        ctx.runQuery(api.userPreferences.getUserPreferences)
      ]);
      
      // Build context
      const context = {
        user: {
          name: profile?.name || "there",
          goal: profile?.goal || "maintain",
          currentWeight: profile?.currentWeight,
          targetWeight: profile?.targetWeight,
          displayMode: preferences?.displayMode || "standard",
        },
        todayProgress: minimalContext?.todaySummary ? {
          calories: {
            consumed: minimalContext.todaySummary.caloriesConsumed,
            target: profile?.dailyCalorieTarget || 2000,
            remaining: (profile?.dailyCalorieTarget || 2000) - minimalContext.todaySummary.caloriesConsumed,
          },
          meals: minimalContext.todaySummary.mealsLogged,
          protein: {
            consumed: minimalContext.todaySummary.proteinConsumed,
            target: profile?.proteinTarget || 150,
          },
        } : null,
      };
      
      // Get current time for meal type detection
      const now = new Date();
      const hour = now.getHours();
      const defaultMealType = 
        hour < 11 ? "breakfast" :
        hour < 15 ? "lunch" :
        hour < 18 ? "snack" :
        "dinner";
      
      // Build instructions
      const instructions = getBobInstructions(
        context,
        profile,
        hasWeighedToday || false,
        !onboardingStatus?.completed,
        hour,
        defaultMealType
      );
      
      // Save user message
      await ctx.runMutation(api.chatHistory.saveUserMessage, {
        content: prompt,
        metadata: { 
          actionType: storageId ? "photo_analysis" : "text",
          threadId: finalThreadId,
          storageId: storageId || undefined
        }
      });
      
      // Create or continue thread
      let thread;
      let activeThreadId = finalThreadId;
      if (activeThreadId) {
        const threadResult: any = await bobAgent.continueThread(ctx, { threadId: activeThreadId, userId });
        thread = threadResult.thread;
      } else {
        const threadResult = await bobAgent.createThread(ctx, { userId });
        thread = threadResult.thread;
        activeThreadId = threadResult.threadId;
      }
      
      // For now, just use the existing non-streaming approach
      // TODO: Implement actual streaming with Convex Agent when supported
      const result: any = await thread.generateText({
        prompt: storageId ? "I just uploaded a NEW food photo. Please analyze this NEW image." : prompt,
        system: instructions,
        maxSteps: 3,
      });
      
      // Extract tool calls from steps
      let toolCalls: any[] = [];
      if (result.steps && Array.isArray(result.steps)) {
        for (const step of result.steps) {
          if (step.toolCalls && Array.isArray(step.toolCalls)) {
            toolCalls = [...toolCalls, ...step.toolCalls];
          }
        }
      }
      
      // Clean text if onboarding
      let cleanedText = result.text || "";
      if (!onboardingStatus?.completed && cleanedText.includes("[EXTRACT:")) {
        const extractPattern = /\[EXTRACT:(\w+):([^\]]+)\]/g;
        let match;
        
        while ((match = extractPattern.exec(cleanedText)) !== null) {
          const [_, step, value] = match;
          await ctx.runMutation(api.onboarding.saveOnboardingProgress, {
            step,
            response: value
          });
        }
        
        cleanedText = cleanedText.replace(/\[EXTRACT:[^\]]+\]/g, '');
      }
      
      // Save Bob's response
      await ctx.runMutation(api.chatHistory.saveBobMessage, {
        content: cleanedText,
        metadata: {
          actionType: storageId ? "photo_analysis_response" : "general_chat",
          threadId: activeThreadId,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        }
      });
      
      // Create SSE response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send the complete response as a single event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            text: cleanedText,
            toolCalls: toolCalls,
            threadId: activeThreadId
          })}\n\n`));
          
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (error) {
      console.error('HTTP action error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }),
});

export default http;