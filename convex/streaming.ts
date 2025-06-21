import { v } from "convex/values";
import { query, mutation, internalAction } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { bobAgent, getBobInstructions } from "./bobAgent";
import { api, internal } from "./_generated/api";
import type { PaginationResult } from "convex/server";
import type { MessageDoc } from "@convex-dev/agent";

// Query for listing thread messages with streaming support
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    // Note: vStreamArgs is not available yet in Convex Agent
    // This is a placeholder for future streaming support
  },
  handler: async (ctx, { threadId, paginationOpts }): Promise<PaginationResult<MessageDoc>> => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // TODO: Add authorization check for thread access
    // await authorizeThreadAccess(ctx, threadId);
    
    // Get paginated messages
    const paginated = await bobAgent.listMessages(ctx, { threadId, paginationOpts });
    
    // Note: syncStreams is not available yet in Convex Agent
    // When true streaming is supported, we'll add it here
    
    // Return paginated result
    return paginated;
  },
});

// Mutation for sending messages asynchronously (for streaming)
export const streamStoryAsynchronously = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { prompt, threadId, storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // Save user message with optional image
    let messageContent: any = prompt;
    if (storageId) {
      // Get the storage URL for the image
      const url = await ctx.storage.getUrl(storageId);
      if (url) {
        messageContent = [
          { type: "image", image: url },
          { type: "text", text: prompt }
        ];
      }
    }
    
    const { messageId } = await bobAgent.saveMessage(ctx, {
      threadId,
      userId,
      message: {
        role: "user",
        content: messageContent,
      },
      metadata: undefined,
    });
    
    // Schedule the async generation
    await ctx.scheduler.runAfter(0, internal.streaming.generateStreamingResponse, {
      threadId,
      promptMessageId: messageId,
      userId,
      storageId,
    });
    
    return { messageId, threadId };
  },
});

// Internal action to generate streaming response
export const generateStreamingResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { threadId, promptMessageId, userId, storageId }) => {
    try {
      // Get context and profile
      const [profile, preferences, onboardingStatus, minimalContext, hasWeighedToday] = await Promise.all([
        ctx.runQuery(api.userProfiles.getUserProfile, { userId }),
        ctx.runQuery(api.userPreferences.getUserPreferences),
        ctx.runQuery(api.onboarding.getOnboardingStatus),
        ctx.runQuery(api.chatHistory.getTodayThreadContext),
        ctx.runQuery(api.weightLogs.hasLoggedWeightToday),
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
      let instructions = getBobInstructions(
        context,
        profile,
        hasWeighedToday || false,
        !onboardingStatus?.completed,
        hour,
        defaultMealType
      );
      
      // Add photo analysis instructions if needed
      if (storageId) {
        instructions += `\n\nURGENT: NEW PHOTO UPLOADED! 
        
YOU MUST IMMEDIATELY:
1. Use the analyzePhoto tool RIGHT NOW with this exact parameter:
   {
     "storageId": "${storageId}"
   }
2. This is a BRAND NEW photo - forget all previous food discussions
3. The user just uploaded a NEW image that needs analysis
4. You CANNOT see the image directly - you MUST use analyzePhoto to know what's in it
5. DO NOT reference any previous photos or foods

YOUR FIRST ACTION MUST BE:
Call analyzePhoto with storageId "${storageId}"

After analyzePhoto returns:
- Describe what the analysis found
- Use confirmFood with the exact data returned
- Wait for user confirmation before logging

REMEMBER: You have NOT analyzed this photo yet. Use analyzePhoto NOW!`;
      }
      
      // Continue thread and generate response
      const { thread } = await bobAgent.continueThread(ctx, { threadId, userId });
      
      // Generate text with streaming support
      // Note: When Convex Agent supports true streaming, this will stream tokens
      await thread.generateText({ 
        promptMessageId,
        system: instructions,
        maxSteps: 3,
      });
    } catch (error) {
      console.error("Error generating streaming response:", error);
      throw error;
    }
  },
});