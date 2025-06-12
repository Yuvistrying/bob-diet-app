import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

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

    // Check onboarding status
    const onboardingStatus = await ctx.runQuery(api.onboarding.getOnboardingStatus);
    const isOnboarding = !onboardingStatus?.completed;

    // Get chat context
    const context = await ctx.runQuery(api.chatHistory.getChatContext);

    // Build system prompt based on onboarding status
    let systemPrompt: string;
    
    if (isOnboarding) {
      const currentStep = onboardingStatus?.currentStep || "welcome";
      const responses = onboardingStatus?.responses || {};
      
      systemPrompt = `You are Bob, a friendly AI diet coach helping with user onboarding.

CURRENT ONBOARDING STEP: ${currentStep}
COLLECTED DATA: ${JSON.stringify(responses)}

Your job is to guide the user through onboarding conversationally. Be casual and wholesome.

ONBOARDING FLOW:
1. name - Ask for their name (if not collected)
2. current_weight - Ask for current weight with unit preference
3. target_weight - Ask for goal weight  
4. height_age - Ask for height (cm) and age
5. gender - Ask for biological sex (for calorie calculations)
6. activity_level - Ask about activity level (sedentary/light/moderate/active)
7. goal - Ask about their goal (cut/maintain/gain)
8. display_mode - Ask if they want standard mode (see all numbers) or stealth mode (focus on habits)

Based on the current step and what they say, extract the information naturally. 
Be encouraging and use emojis. Keep it conversational, not like a form.

IMPORTANT: After each response from the user, you must include extraction data in your response.
Format: [EXTRACT:step_name:value]

Example:
User: "I'm Sarah"
Response: "Nice to meet you, Sarah! 🙌 [EXTRACT:name:Sarah] Let's get you set up. What's your current weight?"`;
    } else {
      systemPrompt = `You are Bob, a friendly AI diet coach helping ${context?.user.name || "there"}.
  
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
    }

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Generate response
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      messages: args.messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      system: systemPrompt,
    });

    // Handle onboarding extractions
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
    
    // Save the conversation
    await ctx.runMutation(api.chatHistory.saveUserMessage, {
      content: userMessage,
    });
    
    // Remove extraction markers from the response
    const cleanedText = text.replace(/\[EXTRACT:[^\]]+\]/g, '');
    
    await ctx.runMutation(api.chatHistory.saveBobMessage, {
      content: cleanedText,
    });

    // Process food/weight mentions after onboarding
    if (!isOnboarding) {
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
    }

    return { text: cleanedText };
  },
});