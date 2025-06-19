import { v } from "convex/values";
import { action, mutation, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { bobAgent, getBobInstructions } from "./bobAgent";
import type { Id } from "./_generated/dataModel";

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
  handler: async (ctx, { prompt, threadId, storageId }): Promise<any> => {
    const userId = await getUserId(ctx);
    
    // Check if this is a confirmation response (keep session if so)
    const isConfirmationResponse = 
      prompt.toLowerCase() === "yes" || 
      prompt.toLowerCase() === "yep" || 
      prompt.toLowerCase() === "sure" ||
      prompt.toLowerCase() === "yes awesome!" ||
      prompt.toLowerCase().includes("correct") ||
      prompt.toLowerCase().includes("that's right");
    
    // Get or create daily session (keep thread if confirming food)
    const session: any = await ctx.runMutation(api.chatSessions.getOrCreateDailySession, {
      forceKeepThread: isConfirmationResponse
    });
    if (!session) throw new Error("Failed to create session");
    
    // Use session's threadId if no threadId provided
    if (!threadId && session.threadId) {
      threadId = session.threadId;
    }
    
    // Try to get cached context first
    const contextCacheKey = "chat_context_minimal";
    const cachedContext = await ctx.runQuery(api.sessionCache.getSessionCache, { 
      cacheKey: contextCacheKey 
    });
    
    let onboardingStatus, minimalContext, historicalSummary, profile, hasWeighedToday;
    
    if (cachedContext && !storageId) { // Don't use cache for photo uploads
      // Use cached data
      ({ onboardingStatus, minimalContext, historicalSummary, profile, hasWeighedToday } = cachedContext);
    } else {
      // Get minimal context for today + compressed historical summary
      [onboardingStatus, minimalContext, historicalSummary, profile, hasWeighedToday] = await Promise.all([
        ctx.runQuery(api.onboarding.getOnboardingStatus),
        ctx.runQuery(api.chatHistory.getTodayThreadContext), // NEW: Minimal today context
        ctx.runQuery(api.conversationSummary.compressHistoricalContext), // NEW: Compressed history
        ctx.runQuery(api.userProfiles.getUserProfile, {}),
        ctx.runQuery(api.weightLogs.hasLoggedWeightToday)
      ]);
      
      // Cache the context (5 minute TTL)
      await ctx.runMutation(api.sessionCache.setSessionCache, {
        cacheKey: contextCacheKey,
        data: {
          onboardingStatus,
          minimalContext,
          historicalSummary,
          profile,
          hasWeighedToday
        },
        ttlSeconds: 300
      });
    }
    
    // Build full context from minimal + historical
    const context = {
      user: {
        name: profile?.name || "there",
        goal: profile?.goal || "maintain",
        currentWeight: profile?.currentWeight,
        targetWeight: profile?.targetWeight,
        displayMode: profile?.displayMode || "standard",
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
      recentMessages: minimalContext?.recentMessages || [],
      conversationSummary: minimalContext?.conversationSummary,
      keyTopics: minimalContext?.keyTopics || [],
      todaySummary: minimalContext?.todaySummary,
      historicalContext: historicalSummary,
    };
    
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
    if (isConfirmationResponse && minimalContext?.pendingFood) {
      lastConfirmFoodData = minimalContext.pendingFood.data;
    }
    
    // Save user message to chat history
    await ctx.runMutation(api.chatHistory.saveUserMessage, {
      content: prompt,
      metadata: { 
        actionType: storageId ? "photo_analysis" : "text",
        threadId,
        storageId: storageId || undefined
      }
    });
    
    // Check if this is an image message
    const isImageMessage = storageId || prompt.includes("[Image attached]");
    let actualPrompt = prompt;
    
    if (isImageMessage && storageId) {
      // Keep the clean prompt without image data
      actualPrompt = prompt.replace("[Image attached] ", "").trim() || "Please analyze this food photo";
      // Clear context cache for photo analysis to ensure fresh data
      await ctx.runMutation(api.sessionCache.clearSessionCacheKey, {
        cacheKey: "chat_context"
      });
    }
    
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
      contextualInstructions += `\n\nIMAGE ANALYSIS: The user has shared a NEW food photo. 

CRITICAL INSTRUCTIONS:
1. IGNORE all previous food conversations - this is a NEW photo
2. Use the analyzePhoto tool with storageId: "${storageId}"
3. Wait for the analyzePhoto result which will contain the ACTUAL food in the photo
4. When analyzePhoto returns with confirmFoodData, you MUST:
   - Describe what the PHOTO ANALYSIS found in your message
   - Use confirmFood tool to show the food for user confirmation
   - Do NOT log the food yet - wait for user to confirm
   - Do NOT make up your own food items
   - Do NOT use food items from previous conversations
5. IMPORTANT: Do NOT use logFood until the user confirms (says yes/yep/sure)

FLOW:
1. analyzePhoto → Get food data
2. confirmFood → Show to user for confirmation  
3. WAIT for user response
4. Only use logFood AFTER user confirms

The photo analysis will tell you what food is actually in the image.`;
    }
    
    // Create or continue thread
    let thread;
    let isNewThread = false;
    if (threadId) {
      const threadResult: any = await bobAgent.continueThread(ctx, { threadId, userId });
      thread = threadResult.thread;
    } else {
      const threadResult = await bobAgent.createThread(ctx, { userId });
      thread = threadResult.thread;
      threadId = threadResult.threadId;
      isNewThread = true;
    }
    
    // Update session with thread ID if new
    if (isNewThread && session._id) {
      await ctx.runMutation(api.chatSessions.updateSessionThreadId, {
        sessionId: session._id,
        threadId: threadId!,
      });
    }
    
    // Generate response with the thread
    const result: any = await thread.generateText({
      prompt: actualPrompt,
      system: contextualInstructions,
      maxSteps: 3, // Reduced for faster responses while still allowing tool calls
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
        
        if (step === "name") {
          // Clean and trim the name value, removing quotes if present
          parsedValue = value.trim().replace(/^["']|["']$/g, '');
          console.log(`Extracted name: "${parsedValue}" from value: "${value}"`);
        } else if (step === "current_weight" || step === "target_weight") {
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
        } else if (step === "gender") {
          // Normalize gender values
          const lowerValue = value.toLowerCase().trim();
          if (lowerValue.includes("male") && !lowerValue.includes("female")) {
            parsedValue = "male";
          } else if (lowerValue.includes("female") || lowerValue.includes("woman")) {
            parsedValue = "female";
          } else {
            parsedValue = "other";
          }
          console.log(`Extracted gender: "${parsedValue}" from value: "${value}"`);
        } else if (step === "activity_level") {
          // Normalize activity level
          const lowerValue = value.toLowerCase().trim();
          if (lowerValue.includes("sedentary") || lowerValue.includes("little")) {
            parsedValue = "sedentary";
          } else if (lowerValue.includes("light")) {
            parsedValue = "light";
          } else if (lowerValue.includes("moderate")) {
            parsedValue = "moderate";
          } else if (lowerValue.includes("active") || lowerValue.includes("very")) {
            parsedValue = "active";
          } else {
            parsedValue = value.trim();
          }
        } else if (step === "goal") {
          // Normalize goal
          const lowerValue = value.toLowerCase().trim();
          if (lowerValue.includes("lose") || lowerValue.includes("cut")) {
            parsedValue = "cut";
          } else if (lowerValue.includes("gain") || lowerValue.includes("bulk")) {
            parsedValue = "gain";
          } else if (lowerValue.includes("maintain")) {
            parsedValue = "maintain";
          } else {
            parsedValue = value.trim();
          }
        } else if (step === "display_mode") {
          // Normalize display mode
          const lowerValue = value.toLowerCase().trim();
          if (lowerValue.includes("stealth") || lowerValue.includes("hide")) {
            parsedValue = "stealth";
          } else {
            parsedValue = "standard";
          }
        }
        
        // Save the onboarding progress
        console.log(`Saving onboarding progress - Step: ${step}, Value: ${JSON.stringify(parsedValue)}`);
        await ctx.runMutation(api.onboarding.saveOnboardingProgress, {
          step,
          response: parsedValue
        });
      }
    }
    
    // Remove extraction markers from the response
    const cleanedText: string = result.text.replace(/\[EXTRACT:[^\]]+\]/g, '');
    
    // Check if we successfully logged food (for safety check)
    let loggedSuccessfully = false;
    
    // First check result.toolCalls (though it's usually empty)
    if (result.toolCalls && result.toolCalls.length > 0) {
      const logFoodCall = result.toolCalls.find((tc: any) => tc.toolName === "logFood");
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
    const finalText: string = cleanedText || result.text || "I'm processing your request...";
    
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
    
    const responseMetadata = {
      actionType: storageId ? "photo_analysis_response" : "general_chat",
      threadId,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      // Add food or weight log IDs if they were created
      foodLogId: toolCalls?.find((tc: any) => tc.toolName === "logFood")?.result?.logId,
      weightLogId: toolCalls?.find((tc: any) => tc.toolName === "logWeight")?.result?.logId,
    };
    
    // Save Bob's response to chat history
    await ctx.runMutation(api.chatHistory.saveBobMessage, {
      content: finalText,
      metadata: responseMetadata
    });
    
    const response: any = {
      text: finalText,
      toolCalls: toolCalls || [],
      threadId, // Return threadId for future messages
    };
    
    // Response caching removed - using database session cache instead
    
    return response;
  },
});

