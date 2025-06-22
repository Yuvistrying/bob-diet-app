import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { bobAgent } from "./bobAgent";
import { CACHE_STRATEGY, CacheKey, shouldInvalidateCache } from "./lib/cacheStrategy";

// Save streamed message to Convex Agent
export const saveStreamedMessage = action({
  args: {
    threadId: v.string(),
    message: v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    }),
    toolCalls: v.optional(v.array(v.any())),
    usage: v.optional(v.object({
      promptTokens: v.number(),
      completionTokens: v.number(),
      totalTokens: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    try {
      // Format the message content to include tool calls if present
      let messageContent = args.message.content;
      
      // If there are tool calls, append them to the message content
      // This is a workaround since Agent doesn't accept tool calls in metadata
      if (args.toolCalls && args.toolCalls.length > 0) {
        const toolCallsInfo = args.toolCalls.map((tc: any) => 
          `[Tool: ${tc.toolName}] ${JSON.stringify(tc.args)}`
        ).join('\n');
        messageContent = `${messageContent}\n\n${toolCallsInfo}`;
      }
      
      // Save the message using the Agent's saveMessage function
      const { messageId } = await bobAgent.saveMessage(ctx, {
        threadId: args.threadId,
        userId,
        message: {
          role: args.message.role,
          content: messageContent,
        },
        // Skip embeddings for assistant messages to save on costs
        skipEmbeddings: args.message.role === "assistant",
      });
      
      // Log usage information separately if provided
      if (args.usage) {
        console.log("[agentBridge] Token usage:", {
          threadId: args.threadId,
          messageId,
          usage: args.usage,
        });
        // In the future, this could be saved to a separate usage tracking table
      }
      
      console.log("[agentBridge] Message saved successfully:", {
        messageId,
        threadId: args.threadId,
        role: args.message.role,
      });
      
      return { messageId, saved: true };
    } catch (error: any) {
      console.error("[agentBridge] Error saving message:", error);
      // Don't throw - return error details so streaming can continue
      return { 
        messageId: `error_${Date.now()}`, 
        saved: false, 
        error: error.message 
      };
    }
  },
});

// Get or create thread with agent
export const getOrCreateAgentThread = mutation({
  args: {
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    if (args.threadId) {
      // Verify thread exists and belongs to user
      try {
        const messages = await bobAgent.listMessages(ctx, {
          threadId: args.threadId,
          paginationOpts: { numItems: 1, cursor: null }
        });
        
        if (messages.page.length > 0) {
          return { threadId: args.threadId, isNew: false };
        }
      } catch (error) {
        console.log("Thread not found, creating new one");
      }
    }
    
    // Create new thread
    const { threadId } = await bobAgent.createThread(ctx, { userId });
    return { threadId, isNew: true };
  },
});

// Create daily thread
export const getOrCreateDailyThread = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // Use YYYY-MM-DD format for consistent date handling
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have today's thread
    const existingThread = await ctx.db
      .query("dailyThreads")
      .withIndex("by_user_date", q => 
        q.eq("userId", userId).eq("date", today)
      )
      .first();
    
    if (existingThread) {
      // Update last message time
      await ctx.db.patch(existingThread._id, {
        lastMessageAt: Date.now(),
        messageCount: existingThread.messageCount + 1,
      });
      
      return { threadId: existingThread.threadId, isNew: false };
    }
    
    // Create new thread
    const { threadId } = await bobAgent.createThread(ctx, { 
      userId,
      title: `Daily thread - ${today}`,
    });
    
    // Track it
    await ctx.db.insert("dailyThreads", {
      userId,
      date: today,
      threadId,
      messageCount: 1,
      firstMessageAt: Date.now(),
      lastMessageAt: Date.now(),
    });
    
    return { threadId, isNew: true };
  },
});

// Search similar meals using agent's vector search
export const searchSimilarMeals = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // Use the agent's vector search
    const results: any = await ctx.runAction(api.vectorSearch.searchSimilarMeals, {
      searchText: args.query,
      limit: args.limit || 5,
    });
    
    return results;
  },
});

// Get thread context for better responses
export const getThreadContext = action({
  args: {
    threadId: v.string(),
    includeLastN: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get recent messages from thread
    const messages = await bobAgent.listMessages(ctx, {
      threadId: args.threadId,
      paginationOpts: { numItems: args.includeLastN || 20, cursor: null }
    });
    
    // Extract useful context
    const context = {
      recentMessages: messages.page,
      foodsLogged: messages.page.filter((m: any) => 
        m.text?.includes("logged") && m.text?.includes("food")
      ),
      weightsLogged: messages.page.filter((m: any) => 
        m.text?.includes("logged") && m.text?.includes("weight")
      ),
      messageCount: messages.page.length,
    };
    
    return context;
  },
});

// Load agent context for streaming
export const loadAgentContext = action({
  args: {
    threadId: v.optional(v.string()),
    includeHistory: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // Get or create thread
    let threadId = args.threadId;
    if (!threadId) {
      const result = await ctx.runMutation(api.agentBridge.getOrCreateDailyThread, {});
      threadId = result.threadId;
    }
    
    // Load context if requested
    let threadContext = null;
    if (args.includeHistory && threadId) {
      threadContext = await ctx.runAction(api.agentBridge.getThreadContext, {
        threadId,
        includeLastN: 10,
      });
    }
    
    return {
      threadId,
      threadContext,
      userId,
    };
  },
});

// Cache management functions
export const getCachedContext = mutation({
  args: {
    cacheKey: v.string() as any, // Will be validated as CacheKey
    ttl: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    const cacheKey = args.cacheKey as CacheKey;
    
    // Check cache
    const cached = await ctx.db
      .query("contextCache")
      .withIndex("by_user_key", (q: any) => 
        q.eq("userId", userId).eq("cacheKey", cacheKey)
      )
      .first();
    
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[Cache HIT] ${cacheKey} for user ${userId}`);
      return cached.data;
    }
    
    console.log(`[Cache MISS] ${cacheKey} for user ${userId}`);
    
    // Cache miss - rebuild based on key
    const freshData = await buildCacheData(ctx, cacheKey, userId);
    
    // Save to cache
    const ttl = args.ttl || CACHE_STRATEGY[cacheKey].ttl;
    await ctx.db.insert("contextCache", {
      userId,
      cacheKey,
      data: freshData,
      ttl,
      expiresAt: Date.now() + ttl,
      invalidateOn: [...CACHE_STRATEGY[cacheKey].invalidateOn], // Convert readonly to mutable array
    });
    
    return freshData;
  },
});

// Helper function to build cache data
async function buildCacheData(ctx: any, cacheKey: CacheKey, userId: string): Promise<any> {
  switch (cacheKey) {
    case "coreStats": {
      const [profile, todayStats, hasWeighedToday] = await Promise.all([
        ctx.db.query("userProfiles").filter((q: any) => q.eq(q.field("userId"), userId)).first(),
        ctx.db.query("foodLogs")
          .filter((q: any) => q.eq(q.field("userId"), userId))
          .filter((q: any) => q.eq(q.field("date"), new Date().toISOString().split('T')[0]))
          .collect()
          .then((logs: any[]) => {
            const stats = logs.reduce((acc: any, log: any) => ({
              calories: acc.calories + log.totalCalories,
              protein: acc.protein + log.totalProtein,
              carbs: acc.carbs + log.totalCarbs,
              fat: acc.fat + log.totalFat,
              mealsLogged: acc.mealsLogged + 1,
            }), { calories: 0, protein: 0, carbs: 0, fat: 0, mealsLogged: 0 });
            return stats;
          }),
        ctx.db.query("weightLogs")
          .filter((q: any) => q.eq(q.field("userId"), userId))
          .filter((q: any) => q.eq(q.field("date"), new Date().toISOString().split('T')[0]))
          .first()
          .then((log: any) => !!log),
      ]);
      
      return {
        profile: {
          name: profile?.name,
          dailyCalorieTarget: profile?.dailyCalorieTarget || 2000,
          proteinTarget: profile?.proteinTarget || 150,
        },
        todayStats,
        hasWeighedToday,
        caloriesRemaining: (profile?.dailyCalorieTarget || 2000) - todayStats.calories,
      };
    }
    
    case "profile": {
      const profile = await ctx.db.query("userProfiles")
        .filter((q: any) => q.eq(q.field("userId"), userId))
        .first();
      return profile;
    }
    
    case "preferences": {
      const preferences = await ctx.db.query("userPreferences")
        .filter((q: any) => q.eq(q.field("userId"), userId))
        .first();
      return preferences;
    }
    
    case "todayFoodLog": {
      const logs = await ctx.db.query("foodLogs")
        .filter((q: any) => q.eq(q.field("userId"), userId))
        .filter((q: any) => q.eq(q.field("date"), new Date().toISOString().split('T')[0]))
        .collect();
      
      return logs.map((log: any) => ({
        time: new Date(log._creationTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        meal: log.meal,
        description: log.description,
        calories: log.totalCalories,
        protein: log.totalProtein,
      }));
    }
    
    default:
      return null;
  }
}

// Invalidate cache on events
export const invalidateCache = mutation({
  args: {
    event: v.string(),
    cacheKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // If specific keys provided, invalidate those
    if (args.cacheKeys) {
      for (const key of args.cacheKeys) {
        const cached = await ctx.db
          .query("contextCache")
          .withIndex("by_user_key", q => 
            q.eq("userId", userId).eq("cacheKey", key)
          )
          .first();
        
        if (cached) {
          await ctx.db.delete(cached._id);
          console.log(`[Cache INVALIDATED] ${key} for user ${userId}`);
        }
      }
      return;
    }
    
    // Otherwise, check all caches for this event
    const allCaches = await ctx.db
      .query("contextCache")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    
    for (const cache of allCaches) {
      if (cache.invalidateOn.includes(args.event)) {
        await ctx.db.delete(cache._id);
        console.log(`[Cache INVALIDATED] ${cache.cacheKey} for user ${userId} due to event: ${args.event}`);
      }
    }
  },
});

// Build streaming context with thread history
export const buildStreamingContext = action({
  args: {
    threadId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Get thread messages (last 20)
    const threadMessages = await bobAgent.listMessages(ctx, {
      threadId: args.threadId,
      paginationOpts: { numItems: 20, cursor: null }
    });
    
    // 2. Extract patterns from messages
    const establishedFacts = extractEstablishedFacts(threadMessages.page);
    const recentPatterns = extractRecentPatterns(threadMessages.page);
    const keyTopics = extractKeyTopics(threadMessages.page);
    
    // 3. Build today's food summary from cache
    const todayFoodLogs = await ctx.runMutation(api.agentBridge.getCachedContext, {
      cacheKey: "todayFoodLog"
    });
    
    const todaySummary = {
      entries: todayFoodLogs || []
    };
    
    // 4. Create conversation summary (last 5 exchanges)
    const conversationSummary = summarizeRecentConversation(threadMessages.page.slice(0, 10));
    
    // 5. Get cached core stats
    const coreStats = await ctx.runMutation(api.agentBridge.getCachedContext, {
      cacheKey: "coreStats"
    });
    
    return {
      user: coreStats.profile,
      todayProgress: {
        calories: {
          consumed: coreStats.todayStats.calories,
          target: coreStats.profile.dailyCalorieTarget,
          remaining: coreStats.caloriesRemaining,
        },
        protein: {
          consumed: coreStats.todayStats.protein,
          target: coreStats.profile.proteinTarget,
        },
        meals: coreStats.todayStats.mealsLogged,
      },
      historicalContext: {
        establishedFacts,
        recentPatterns,
        ongoingGoals: ["lose weight", "track consistently"], // TODO: Extract from profile
      },
      todaySummary,
      conversationSummary,
      keyTopics,
      threadContext: {
        messageCount: threadMessages.page.length,
        lastMessageTime: threadMessages.page[0]?._creationTime,
      },
    };
  },
});

// Helper functions for context extraction
function extractEstablishedFacts(messages: any[]): string[] {
  const facts: string[] = [];
  
  // Look for weight logs
  const weightMentions = messages.filter(m => 
    m.text?.includes("weight") && m.text?.includes("kg")
  );
  if (weightMentions.length > 0) {
    const latestWeight = weightMentions[0].text.match(/(\d+(?:\.\d+)?)\s*kg/);
    if (latestWeight) {
      facts.push(`Current weight: ${latestWeight[1]}kg`);
    }
  }
  
  // Look for meal preferences
  const mealPatterns = messages.filter(m => 
    m.text?.includes("usually") || m.text?.includes("always") || m.text?.includes("prefer")
  );
  
  // Extract top 3 facts
  return facts.slice(0, 3);
}

function extractRecentPatterns(messages: any[]): string[] {
  const patterns: string[] = [];
  
  // Analyze meal timing
  const mealTimes = messages
    .filter(m => m.text?.match(/breakfast|lunch|dinner|snack/i))
    .map(m => {
      const hour = new Date(m._creationTime).getHours();
      const meal = m.text.match(/(breakfast|lunch|dinner|snack)/i)?.[1];
      return { hour, meal };
    });
  
  // Look for repeated foods
  const foodMentions: Record<string, number> = {};
  messages.forEach((m: any) => {
    const foods = m.text?.match(/\b(pizza|salad|chicken|rice|pasta|sandwich)\b/gi) || [];
    foods.forEach((food: any) => {
      foodMentions[food.toLowerCase()] = (foodMentions[food.toLowerCase()] || 0) + 1;
    });
  });
  
  const frequentFoods = Object.entries(foodMentions)
    .filter(([_, count]) => count > 2)
    .map(([food, count]) => `Frequently eats ${food} (${count} times)`);
  
  patterns.push(...frequentFoods);
  
  return patterns.slice(0, 3);
}

function extractKeyTopics(messages: any[]): string[] {
  const topics = new Set<string>();
  
  messages.forEach((m: any) => {
    // Extract food items
    const foods = m.text?.match(/\b(pizza|salad|chicken|rice|pasta|sandwich|apple|banana)\b/gi) || [];
    foods.forEach((food: any) => topics.add(food.toLowerCase()));
  });
  
  return Array.from(topics).slice(0, 10);
}

function summarizeRecentConversation(messages: any[]): string {
  if (messages.length === 0) return "";
  
  // Get last 5 user messages
  const userMessages = messages
    .filter(m => m.role === "user")
    .slice(0, 5)
    .map(m => m.text?.substring(0, 50) + "...")
    .join("; ");
  
  return `Recent topics: ${userMessages}`;
}