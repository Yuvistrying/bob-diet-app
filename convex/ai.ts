import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";

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

export const chatAction = action({
  args: {
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if we have the API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Get the last user message
    const lastUserMessage = args.messages[args.messages.length - 1];
    const userMessage = lastUserMessage?.content || "";

    // Save user message immediately (only if not empty)
    if (userMessage && userMessage.trim()) {
      await ctx.runMutation(api.chatHistory.saveUserMessage, {
        content: userMessage,
      });
    }

    // Check onboarding status
    const onboardingStatus = await ctx.runQuery(api.onboarding.getOnboardingStatus);
    const isOnboarding = !onboardingStatus?.completed;

    // Get chat context
    const context = await ctx.runQuery(api.chatHistory.getChatContext);
    const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
    const hasWeighedToday = await ctx.runQuery(api.weightLogs.hasLoggedWeightToday);

    // Get current time for meal type detection
    const now = new Date();
    const hour = now.getHours();
    const defaultMealType = 
      hour < 11 ? "breakfast" :
      hour < 15 ? "lunch" :
      hour < 18 ? "snack" :
      "dinner";

    // Build system prompt based on onboarding status
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
- Daily weigh-in: ${hasWeighedToday ? "✅ Completed" : "❌ Not yet logged"}

MEAL STATUS:
- Breakfast: ${mealStatus?.mealStatus.breakfast.logged ? "✅ Logged" : mealStatus?.mealStatus.breakfast.isPast ? "❌ Missed" : "⏰ Pending"}
- Lunch: ${mealStatus?.mealStatus.lunch.logged ? "✅ Logged" : mealStatus?.mealStatus.lunch.isPast ? "❌ Missed" : "⏰ Pending"}
- Dinner: ${mealStatus?.mealStatus.dinner.logged ? "✅ Logged" : mealStatus?.mealStatus.dinner.isPast ? "❌ Missed" : "⏰ Pending"}
- Completion: ${mealStatus?.completionPercentage || 0}%

IMPORTANT RULES:
1. ALWAYS ask for confirmation before logging food using the confirmFood tool
2. Parse natural language for food mentions and estimate calories/macros
3. Only use the logFood tool AFTER user explicitly confirms (yes, sure, yep, etc.)
4. If user says no/nope/not quite, ask for clarification
5. ${isStealthMode ? "In stealth mode: Focus on habits and encouragement, avoid showing numbers" : "Show calories and macro counts"}
6. Detect meal type based on time of day (current time: ${hour}:00, likely ${defaultMealType})
7. Be encouraging and supportive, like a gym buddy
8. Keep responses concise and friendly
9. ${!hasWeighedToday ? "IMPORTANT: User hasn't logged weight today. Naturally prompt them for their daily weigh-in early in the conversation. Be encouraging about tracking weight for better progress insights." : "User has already weighed in today - don't ask again"}

REMINDER GUIDELINES:
1. Be encouraging and supportive about consistency
2. Focus on helping the user track accurately
3. Never forget to complete the logging process when confirmed

CONVERSATION FLOW:
- User mentions food → Use confirmFood tool to show understanding
- User confirms → Use logFood tool to save it (NEVER FORGET THIS STEP!)
- User denies → Ask what to change
- User asks about progress → Use showProgress tool
- If user reminds you to log → Apologize and use logFood tool immediately

CRITICAL TOOL USAGE:
1. When using confirmFood tool, keep your message very short (e.g., "Let me confirm what you had:")
2. The confirmFood tool displays a card asking "Should I log this as your [meal]?"
3. When user responds with yes/yep/sure/correct/that's right/awesome to a confirmation:
   - IMMEDIATELY use the logFood tool in THE SAME RESPONSE
   - Copy ALL the data from confirmFood to logFood exactly
   - Your text response should confirm it's logged: "Logged it! You've got X calories left today"
4. NEVER ask for confirmation twice for the same food
5. ALWAYS complete the two-step process: confirmFood → user says yes → logFood

EXAMPLE FLOW:
User: "I had a banana for breakfast"
You: "Let me confirm what you had:" [USE confirmFood tool with banana data]
User: "yes"
You: [USE logFood tool with same banana data] "Perfect! I've logged your banana breakfast. You have X calories remaining today."

IMPORTANT RELIABILITY RULES:
1. If you show a confirmation, you MUST follow through with logging when confirmed
2. Never leave a confirmation hanging - always complete the process
3. If the user has to remind you to log, apologize and log immediately
4. Your primary job is accurate food tracking - never forget to complete a log
5. NEVER say "I've logged it" unless you actually used the logFood tool
6. If logging fails, tell the user there was an error and try again
7. Always use the logFood tool when the user confirms - no exceptions`;
    }

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Filter out any empty messages and ensure valid format
    const validMessages = args.messages
      .filter(m => m.content && m.content.trim() !== "")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content.trim(),
      }));
    
    // Check if this is a confirmation response to a previous confirmFood
    const lastValidUserMessage = validMessages[validMessages.length - 1];
    const previousAssistantMessage = validMessages.length > 1 ? validMessages[validMessages.length - 2] : null;
    
    // Get the last confirmFood data from recent messages
    let lastConfirmFoodData = null;
    if (context?.recentMessages) {
      console.log(`Checking ${context.recentMessages.length} recent messages for confirmFood data`);
      for (let i = context.recentMessages.length - 1; i >= 0; i--) {
        const msg = context.recentMessages[i];
        if (msg.role === "assistant" && msg.metadata?.toolCalls) {
          const confirmCall = msg.metadata.toolCalls.find((tc: any) => tc.toolName === "confirmFood");
          if (confirmCall) {
            lastConfirmFoodData = confirmCall.args;
            console.log("Found previous confirmFood data:", JSON.stringify(lastConfirmFoodData));
            break;
          }
        }
      }
    }
    
    const isConfirmationResponse = lastValidUserMessage && 
      lastValidUserMessage.role === "user" &&
      (lastValidUserMessage.content.toLowerCase() === "yes" || 
       lastValidUserMessage.content.toLowerCase() === "yep" || 
       lastValidUserMessage.content.toLowerCase() === "sure" ||
       lastValidUserMessage.content.toLowerCase() === "yes awesome!" ||
       lastValidUserMessage.content.toLowerCase().includes("correct") ||
       lastValidUserMessage.content.toLowerCase().includes("that's right"));
    
    // Add context hint to system prompt if this is a confirmation
    let contextHint = "";
    if (isConfirmationResponse && lastConfirmFoodData) {
      contextHint = `\n\nCRITICAL: The user just confirmed a food entry. You MUST use the logFood tool NOW with this exact data:
${JSON.stringify(lastConfirmFoodData, null, 2)}

REQUIRED ACTIONS:
1. Use the logFood tool with the exact data above
2. In your text response, confirm it's logged with remaining calories
3. Do NOT ask for confirmation again
4. Do NOT say it's logged without using the tool
5. This is your PRIMARY task - everything else is secondary`;
    }
    
    // Also check for reminders about logging
    const needsLoggingReminder = lastValidUserMessage && 
      lastValidUserMessage.role === "user" &&
      (lastValidUserMessage.content.toLowerCase().includes("log it") || 
       lastValidUserMessage.content.toLowerCase().includes("log that") ||
       lastValidUserMessage.content.toLowerCase().includes("you didn't log") ||
       lastValidUserMessage.content.toLowerCase().includes("forgot to log") ||
       lastValidUserMessage.content.toLowerCase().includes("please log"));
    
    if (needsLoggingReminder && lastConfirmFoodData) {
      contextHint = `\n\nCRITICAL: The user is reminding you to log food that was already confirmed. You MUST use the logFood tool NOW with this data:
${JSON.stringify(lastConfirmFoodData, null, 2)}
Apologize briefly and log it immediately.`;
    }

    // Use generateText for now (non-streaming but with tools)
    const { text, toolCalls, toolResults } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages: validMessages,
      system: systemPrompt + contextHint,
      tools,
      maxSteps: 5,
    });

    // Process tool calls
    if (toolCalls && toolCalls.length > 0) {
      console.log(`Processing ${toolCalls.length} tool calls`);
      for (const toolCall of toolCalls) {
        console.log("Tool called:", toolCall.toolName, JSON.stringify(toolCall.args));
        
        if (toolCall.toolName === "logFood") {
          // Actually log the food to database
          const args = toolCall.args as any;
          console.log("Logging food to database:", args.description);
          try {
            const logId = await ctx.runMutation(api.foodLogs.logFood, {
              description: args.description,
              foods: args.items,
              meal: args.mealType,
              aiEstimated: true,
              confidence: args.confidence,
            });
            console.log("Food logged successfully with ID:", logId);
            
            // Verify the log was created
            const verifyLog = await ctx.runQuery(api.foodLogs.getTodayStats);
            console.log("Verification - Today's stats after logging:", verifyLog);
            
            // Store success flag for response
            toolCall.success = true;
            toolCall.logId = logId;
          } catch (error) {
            console.error("ERROR: Failed to log food:", error);
            toolCall.success = false;
            toolCall.error = error;
          }
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
    } else {
      console.log("No tool calls in this response");
    }

    // Handle onboarding extractions if present
    if (isOnboarding && text.includes("[EXTRACT:")) {
      const extractPattern = /\[EXTRACT:(\w+):([^\]]+)\]/g;
      let match;
      
      while ((match = extractPattern.exec(text)) !== null) {
        const [_, step, value] = match;
        
        // Parse the value based on step
        let parsedValue: any = value;
        
        if (step === "current_weight" || step === "target_weight") {
          const weightMatch = value.match(/(\d+(?:\.\d+)?)\s*(kg|lbs|pounds?)?/i);
          if (weightMatch) {
            parsedValue = {
              weight: parseFloat(weightMatch[1]),
              unit: weightMatch[2]?.toLowerCase().startsWith('lb') ? 'lbs' : 'kg'
            };
          }
        } else if (step === "height_age") {
          const heightMatch = value.match(/(\d+)\s*cm/i);
          const ageMatch = value.match(/(\d+)\s*(?:years?|yr)?/i);
          parsedValue = {
            height: heightMatch ? parseInt(heightMatch[1]) : null,
            age: ageMatch ? parseInt(ageMatch[1]) : null
          };
        }
        
        // Save the onboarding progress
        await ctx.runMutation(api.onboarding.saveOnboardingProgress, {
          step,
          response: parsedValue
        });
      }
    }
    
    // Remove extraction markers from the response
    const cleanedText = text.replace(/\[EXTRACT:[^\]]+\]/g, '');
    
    // Save Bob's message (only if not empty)
    if (cleanedText && cleanedText.trim()) {
      await ctx.runMutation(api.chatHistory.saveBobMessage, {
        content: cleanedText,
        metadata: {
          actionType: toolCalls && toolCalls.length > 0 ? "tool_response" : "chat_response",
          toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined
        }
      });
    }

    // Check if we successfully logged food
    let loggedSuccessfully = false;
    if (toolCalls && toolCalls.length > 0) {
      const logFoodCall = toolCalls.find(tc => tc.toolName === "logFood");
      if (logFoodCall && logFoodCall.success) {
        loggedSuccessfully = true;
      }
    }
    
    // If this was a confirmation response but no logging happened, force an error message
    if (isConfirmationResponse && !loggedSuccessfully && lastConfirmFoodData) {
      console.error("WARNING: User confirmed but no logFood tool was used!");
      return {
        text: "I apologize, I had an issue logging that. Let me try again... Actually, could you tell me once more what you had? I want to make sure I log it correctly.",
        toolCalls: toolCalls || [],
        toolResults: toolResults || []
      };
    }
    
    // Return response with tool information
    return { 
      text: cleanedText || "I've logged that for you! 👍",
      toolCalls: toolCalls || [],
      toolResults: toolResults || []
    };
  },
});