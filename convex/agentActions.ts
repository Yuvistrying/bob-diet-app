import { v } from "convex/values";
import { action, mutation, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { bobAgent, getBobInstructions } from "./bobAgent";
import { Id } from "./_generated/dataModel";

// Helper to get userId from Clerk auth
async function getUserId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

// Main chat action with agent
export const chat = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { prompt, threadId, storageId }) => {
    const userId = await getUserId(ctx);
    
    // Get context for Bob's instructions
    const onboardingStatus = await ctx.runQuery(api.onboarding.getOnboardingStatus);
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
    
    // Build Bob's instructions based on context
    const instructions = getBobInstructions(
      context,
      profile,
      hasWeighedToday || false,
      !onboardingStatus?.completed,
      hour,
      defaultMealType
    );
    
    // Get the last confirmFood data if this is a confirmation
    let lastConfirmFoodData = null;
    if (context?.recentMessages) {
      for (let i = context.recentMessages.length - 1; i >= 0; i--) {
        const msg = context.recentMessages[i];
        if (msg.role === "assistant" && msg.metadata?.toolCalls) {
          const confirmCall = msg.metadata.toolCalls.find((tc: any) => tc.toolName === "confirmFood");
          if (confirmCall) {
            lastConfirmFoodData = confirmCall.args;
            break;
          }
        }
      }
    }
    
    // Check if this is an image message
    const isImageMessage = storageId || prompt.includes("[Image attached]");
    let actualPrompt = prompt;
    
    if (isImageMessage && storageId) {
      // Keep the clean prompt without image data
      actualPrompt = prompt.replace("[Image attached] ", "").trim() || "Please analyze this food photo";
    }
    
    // Check if this is a confirmation response
    const isConfirmationResponse = 
      prompt.toLowerCase() === "yes" || 
      prompt.toLowerCase() === "yep" || 
      prompt.toLowerCase() === "sure" ||
      prompt.toLowerCase() === "yes awesome!" ||
      prompt.toLowerCase().includes("correct") ||
      prompt.toLowerCase().includes("that's right");
    
    // Check if user is reminding Bob to log
    const needsLoggingReminder = 
      prompt.toLowerCase().includes("log it") || 
      prompt.toLowerCase().includes("log that") ||
      prompt.toLowerCase().includes("you didn't log") ||
      prompt.toLowerCase().includes("forgot to log") ||
      prompt.toLowerCase().includes("please log");
    
    // Add context hints to instructions
    let contextualInstructions = instructions;
    if (isConfirmationResponse && lastConfirmFoodData) {
      contextualInstructions += `\n\nCRITICAL: The user just confirmed a food entry. You MUST use the logFood tool NOW with this exact data:
${JSON.stringify(lastConfirmFoodData, null, 2)}

REQUIRED ACTIONS:
1. Use the logFood tool with the exact data above
2. In your text response, confirm it's logged with remaining calories
3. Do NOT ask for confirmation again
4. Do NOT say it's logged without using the tool
5. This is your PRIMARY task - everything else is secondary`;
    } else if (needsLoggingReminder && lastConfirmFoodData) {
      contextualInstructions += `\n\nCRITICAL: The user is reminding you to log food that was already confirmed. You MUST use the logFood tool NOW with this data:
${JSON.stringify(lastConfirmFoodData, null, 2)}
Apologize briefly and log it immediately.`;
    } else if (isImageMessage && storageId) {
      contextualInstructions += `\n\nIMAGE ANALYSIS: The user has shared a food photo. 

The user's message about the photo: "${actualPrompt}"

REQUIRED STEPS:
1. First, use the analyzePhoto tool with storageId parameter set to "${storageId}"
2. When analyzePhoto returns success:true with confirmFoodData, you MUST:
   - Say "Let me analyze your photo and confirm what I found:"
   - Use the confirmFood tool with the data from confirmFoodData
   - This must happen in THE SAME RESPONSE as the analyzePhoto result
3. The confirmFoodData object contains all fields needed for confirmFood:
   - description, items, totalCalories, totalProtein, totalCarbs, totalFat, mealType, confidence

CRITICAL: You must use TWO tools in your response: analyzePhoto followed by confirmFood`;
    }
    
    // Create or continue thread
    let thread;
    if (threadId) {
      const threadResult = await bobAgent.continueThread(ctx, { threadId, userId });
      thread = threadResult.thread;
    } else {
      const threadResult = await bobAgent.createThread(ctx, { userId });
      thread = threadResult.thread;
      threadId = threadResult.threadId;
    }
    
    // Generate response with the thread
    const result = await thread.generateText({
      prompt: actualPrompt,
      system: contextualInstructions,
      maxSteps: 5, // Ensure multiple steps for tool calls + text
    });
    
    // Log the full result to see its structure
    console.log("Full generateText result:", JSON.stringify(result, null, 2));
    
    // Fetch the last few messages to get tool calls
    const messages = await bobAgent.listMessages(ctx, {
      threadId,
      paginationOpts: { numItems: 5, cursor: null }
    });
    
    // Handle onboarding extractions if present
    if (!onboardingStatus?.completed && result.text.includes("[EXTRACT:")) {
      const extractPattern = /\[EXTRACT:(\w+):([^\]]+)\]/g;
      let match;
      
      while ((match = extractPattern.exec(result.text)) !== null) {
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
    const cleanedText = result.text.replace(/\[EXTRACT:[^\]]+\]/g, '');
    
    // Check if we successfully logged food (for safety check)
    let loggedSuccessfully = false;
    
    // First check result.toolCalls (though it's usually empty)
    if (result.toolCalls && result.toolCalls.length > 0) {
      const logFoodCall = result.toolCalls.find(tc => tc.toolName === "logFood");
      if (logFoodCall) {
        loggedSuccessfully = true;
      }
    }
    
    // Also check steps array where tool calls actually are
    if (!loggedSuccessfully && result.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        if (step.toolCalls && Array.isArray(step.toolCalls)) {
          const logFoodCall = step.toolCalls.find((tc: any) => tc.toolName === "logFood");
          if (logFoodCall) {
            loggedSuccessfully = true;
            console.log("Found logFood tool call in steps:", logFoodCall);
            break;
          }
        }
      }
    }
    
    // If this was a confirmation but no logging happened, return error
    if (isConfirmationResponse && !loggedSuccessfully && lastConfirmFoodData) {
      console.error("WARNING: User confirmed but no logFood tool was used!");
      return {
        text: "I apologize, I had an issue logging that. Let me try again... Actually, could you tell me once more what you had? I want to make sure I log it correctly.",
        toolCalls: [],
      };
    }
    
    // Ensure we always return some text
    const finalText = cleanedText || result.text || "I'm processing your request...";
    
    // Extract ALL tool calls from ALL steps
    let toolCalls: any[] = [];
    if (result.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        if (step.toolCalls && Array.isArray(step.toolCalls)) {
          // Collect tool calls from all steps
          toolCalls = [...toolCalls, ...step.toolCalls];
        }
      }
    }
    
    console.log("Extracted toolCalls:", toolCalls);
    
    return {
      text: finalText,
      toolCalls: toolCalls || [],
      threadId, // Return threadId for future messages
    };
  },
});

