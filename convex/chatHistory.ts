import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// Get chat history for user (limited for performance)
export const getChatHistory = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { messages: [], hasMore: false, total: 0 };
    
    // Default to 20 messages for performance
    const limit = args.limit || 20;
    const offset = args.offset || 0;
    
    // Get total count for pagination
    const allMessages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", identity.subject))
      .collect();
    
    // Get paginated messages
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit + offset);
    
    // Skip the offset and take the limit
    const paginatedMessages = messages.slice(offset, offset + limit);
    
    // Return in chronological order with metadata
    return {
      messages: paginatedMessages.reverse(),
      hasMore: allMessages.length > (offset + limit),
      total: allMessages.length
    };
  },
});

// Get today's chat messages
export const getTodayChats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.gte(q.field("timestamp"), todayStart.getTime()))
      .collect();
    
    return messages;
  },
});

// Save user message
export const saveUserMessage = mutation({
  args: {
    content: v.string(),
    metadata: v.optional(v.object({
      actionType: v.optional(v.string()),
      threadId: v.optional(v.string()),
      storageId: v.optional(v.id("_storage")),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const chatId = await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: "user",
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
    
    // Generate embedding asynchronously
    ctx.scheduler.runAfter(0, api.embeddings.embedNewChatMessage, {
      chatId,
      content: args.content,
    });
    
    return chatId;
  },
});

// Save Bob's response
export const saveBobMessage = mutation({
  args: {
    content: v.string(),
    metadata: v.optional(v.object({
      foodLogId: v.optional(v.id("foodLogs")),
      weightLogId: v.optional(v.id("weightLogs")),
      actionType: v.optional(v.string()),
      toolCalls: v.optional(v.any()),
      threadId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const chatId = await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: "assistant",
      content: args.content,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
    
    // Generate embedding asynchronously
    ctx.scheduler.runAfter(0, api.embeddings.embedNewChatMessage, {
      chatId,
      content: args.content,
    });
    
    return chatId;
  },
});

// Clear chat history (optional feature)
export const clearChatHistory = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const messages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    return { deleted: messages.length };
  },
});

// Get chat context for Bob (last few messages + user data)
export const getChatContext = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const userId = identity.subject;
    const today = new Date().toISOString().split('T')[0];
    
    // Run all queries in parallel for better performance
    const [profile, preferences, todayLogs, latestWeight, recentMessages] = await Promise.all([
      // Get user profile
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      
      // Get user preferences
      ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      
      // Get today's food logs
      ctx.db
        .query("foodLogs")
        .withIndex("by_user_date", (q) => 
          q.eq("userId", userId).eq("date", today)
        )
        .collect(),
      
      // Get latest weight
      ctx.db
        .query("weightLogs")
        .withIndex("by_user_created", q => q.eq("userId", userId))
        .order("desc")
        .first(),
      
      // Get recent messages for context (limit to last 5 for token efficiency)
      ctx.db
        .query("chatHistory")
        .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
        .order("desc")
        .take(5)
    ]);
    
    // Calculate today's macros
    const todayMacros = todayLogs.reduce((acc, log) => ({
      calories: acc.calories + log.totalCalories,
      protein: acc.protein + log.totalProtein,
      carbs: acc.carbs + log.totalCarbs,
      fat: acc.fat + log.totalFat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    // Determine which meals have been logged today
    const mealTypes = todayLogs.map(log => log.meal);
    const mealStatus = {
      breakfast: mealTypes.includes("breakfast"),
      lunch: mealTypes.includes("lunch"),
      dinner: mealTypes.includes("dinner"),
      snacks: mealTypes.includes("snack"),
    };
    
    return {
      user: {
        name: profile?.name || "there",
        goal: profile?.goal || "maintain",
        currentWeight: latestWeight?.weight || profile?.currentWeight,
        targetWeight: profile?.targetWeight,
        displayMode: preferences?.displayMode || "standard",
      },
      todayProgress: {
        calories: {
          consumed: todayMacros.calories,
          target: profile?.dailyCalorieTarget || 2000,
          remaining: (profile?.dailyCalorieTarget || 2000) - todayMacros.calories,
        },
        protein: {
          consumed: todayMacros.protein,
          target: profile?.proteinTarget || 150,
          remaining: (profile?.proteinTarget || 150) - todayMacros.protein,
        },
        meals: todayLogs.length,
      },
      mealStatus: mealStatus,
      recentMessages: recentMessages.reverse(),
    };
  },
});

// Get contextually relevant chat history using semantic search
export const getRelevantChatContext = action({
  args: {
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchText, limit = 5 }): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const relevantChats = await ctx.runAction(api.vectorSearch.searchChatHistory, {
      searchText,
      limit,
    });
    
    return relevantChats;
  },
});

// Get minimal context for today's thread (optimized for token usage)
export const getTodayThreadContext = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const userId = identity.subject;
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    // Get only essential data for today
    const [allTodayMessages, lastConfirmFood, todayLogs] = await Promise.all([
      // Get ALL messages from today for compression
      ctx.db
        .query("chatHistory")
        .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
        .filter((q) => q.gte(q.field("timestamp"), todayStart))
        .collect(),
      
      // Get the most recent unconfirmed food (if any)
      ctx.db
        .query("chatHistory")
        .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
        .order("desc")
        .filter((q) => 
          q.and(
            q.eq(q.field("role"), "assistant"),
            q.neq(q.field("metadata.toolCalls"), undefined)
          )
        )
        .take(5),
      
      // Today's food logs with details
      ctx.db
        .query("foodLogs")
        .withIndex("by_user_date", (q) => 
          q.eq("userId", userId).eq("date", today)
        )
        .collect()
        .then(logs => ({
          count: logs.length,
          totalCalories: logs.reduce((sum, log) => sum + log.totalCalories, 0),
          totalProtein: logs.reduce((sum, log) => sum + log.totalProtein, 0),
          meals: [...new Set(logs.map(log => log.meal))],
          // Include simplified log entries
          entries: logs.map(log => ({
            meal: log.meal,
            description: log.description.substring(0, 100),
            calories: log.totalCalories,
            protein: log.totalProtein,
            time: log.time,
          })),
        })),
    ]);
    
    // Find last unconfirmed food
    const pendingConfirmation = lastConfirmFood?.find(msg => 
      msg.metadata?.toolCalls?.some((tc: any) => tc.toolName === "confirmFood")
    );
    
    // Compress today's conversation intelligently
    const messageCount = allTodayMessages.length;
    let compressedContext = {
      recentMessages: [] as any[],
      conversationSummary: null as string | null,
      keyTopics: [] as string[],
    };
    
    if (messageCount <= 6) {
      // If 6 or fewer messages, include all (but truncated)
      compressedContext.recentMessages = allTodayMessages.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 200),
        hasToolCall: !!msg.metadata?.toolCalls?.length,
      }));
    } else {
      // Keep last 5 messages in full detail
      const recentMessages = allTodayMessages.slice(-5);
      compressedContext.recentMessages = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 200),
        hasToolCall: !!msg.metadata?.toolCalls?.length,
      }));
      
      // Compress older messages into summary
      const olderMessages = allTodayMessages.slice(0, -5);
      
      // Extract key topics from older messages
      const foodMentions = olderMessages.filter(m => 
        m.content.toLowerCase().includes('food') ||
        m.content.toLowerCase().includes('ate') ||
        m.content.toLowerCase().includes('meal') ||
        m.metadata?.toolCalls?.some((tc: any) => 
          tc.toolName === "logFood" || tc.toolName === "confirmFood"
        )
      );
      
      const weightMentions = olderMessages.filter(m => 
        m.content.toLowerCase().includes('weight') ||
        m.content.toLowerCase().includes('weigh') ||
        m.metadata?.toolCalls?.some((tc: any) => tc.toolName === "logWeight")
      );
      
      // Build conversation summary
      const summaryParts = [];
      if (foodMentions.length > 0) {
        summaryParts.push(`Discussed ${foodMentions.length} food items earlier today`);
      }
      if (weightMentions.length > 0) {
        summaryParts.push(`Logged weight`);
      }
      
      // Extract any specific foods mentioned
      const foodNames = new Set<string>();
      olderMessages.forEach(msg => {
        if (msg.metadata?.toolCalls) {
          msg.metadata.toolCalls.forEach((tc: any) => {
            if (tc.toolName === "confirmFood" || tc.toolName === "logFood") {
              tc.args?.items?.forEach((item: any) => {
                foodNames.add(item.name);
              });
            }
          });
        }
      });
      
      if (foodNames.size > 0) {
        compressedContext.keyTopics = Array.from(foodNames).slice(0, 5);
      }
      
      if (summaryParts.length > 0) {
        compressedContext.conversationSummary = summaryParts.join(". ");
      }
    }
    
    return {
      ...compressedContext,
      messageCount,
      pendingFood: pendingConfirmation?.metadata ? {
        data: pendingConfirmation.metadata.toolCalls?.find((tc: any) => tc.toolName === "confirmFood")?.args,
        messageId: pendingConfirmation._id,
      } : null,
      todaySummary: {
        mealsLogged: todayLogs.count,
        caloriesConsumed: todayLogs.totalCalories,
        proteinConsumed: todayLogs.totalProtein,
        mealTypes: todayLogs.meals,
        entries: todayLogs.entries,
      },
    };
  },
});