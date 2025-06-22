import { v } from "convex/values";
import { mutation, query, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

// Get or create daily summary
export const getDailySummary = query({
  args: {
    date: v.optional(v.string()), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const targetDate = args.date || new Date().toISOString().split('T')[0];
    
    return await ctx.db
      .query("conversationSummaries")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", identity.subject).eq("date", targetDate)
      )
      .first();
  },
});

// Save or update daily summary
export const saveDailySummary = mutation({
  args: {
    date: v.string(),
    summary: v.object({
      keyPoints: v.array(v.string()), // Important facts learned
      foodPatterns: v.array(v.string()), // Eating habits observed
      userPreferences: v.array(v.string()), // Preferences mentioned
      goals: v.array(v.string()), // Goals or concerns expressed
      contextNotes: v.string(), // General context
    }),
    messageCount: v.number(),
    lastMessageId: v.optional(v.id("chatHistory")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const existing = await ctx.db
      .query("conversationSummaries")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", identity.subject).eq("date", args.date)
      )
      .first();
    
    let summaryId: any;
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary,
        messageCount: args.messageCount,
        lastMessageId: args.lastMessageId,
        updatedAt: Date.now(),
      });
      summaryId = existing._id;
    } else {
      summaryId = await ctx.db.insert("conversationSummaries", {
        userId: identity.subject,
        date: args.date,
        summary: args.summary,
        messageCount: args.messageCount,
        lastMessageId: args.lastMessageId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    
    // Generate embedding asynchronously
    ctx.scheduler.runAfter(0, api.embeddings.embedConversationSummary, {
      summaryId,
      date: args.date,
      summary: args.summary,
    });
  },
});

// Get historical context (last 7 days of summaries)
export const getHistoricalContext = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const daysToFetch = args.days || 7;
    const dates: string[] = [];
    
    // Generate dates for the last N days
    for (let i = 1; i <= daysToFetch; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    // Fetch summaries for these dates
    const summaries = await Promise.all(
      dates.map(date => 
        ctx.db
          .query("conversationSummaries")
          .withIndex("by_user_date", (q) => 
            q.eq("userId", identity.subject).eq("date", date)
          )
          .first()
      )
    );
    
    return summaries.filter(Boolean);
  },
});

// Generate summary from messages (internal action for Claude)
export const generateDailySummary = internalAction({
  args: {
    userId: v.string(),
    date: v.string(),
    messages: v.array(v.object({
      role: v.string(),
      content: v.string(),
      metadata: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args): Promise<any> => {
    if (args.messages.length === 0) {
      return null;
    }
    
    // Format messages for Claude
    const conversationText = args.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');
    
    // Use Claude to generate summary
    const prompt = `Analyze this conversation between a user and their AI diet coach Bob. Extract key information that would be useful for future conversations.

Conversation:
${conversationText}

Please provide a structured summary with:
1. Key Points: Important facts about the user (weight, goals, health conditions, etc.)
2. Food Patterns: Eating habits, preferences, allergies, typical meals
3. User Preferences: How they like to track, communication style, specific requests
4. Goals: What they're trying to achieve, concerns they've expressed
5. Context Notes: Any other relevant context for future conversations

Format as JSON with these exact keys: keyPoints, foodPatterns, userPreferences, goals, contextNotes
Each should be an array of strings except contextNotes which is a single string.`;

    try {
      // This would call Claude via the Agent SDK
      // For now, we'll create a basic summary structure
      const summary: {
        keyPoints: string[];
        foodPatterns: string[];
        userPreferences: string[];
        goals: string[];
        contextNotes: string;
      } = {
        keyPoints: [],
        foodPatterns: [],
        userPreferences: [],
        goals: [],
        contextNotes: "Daily conversation summary",
      };
      
      // Extract food logs mentioned
      const foodMentions = args.messages.filter(m => 
        m.metadata?.toolCalls?.some((tc: any) => 
          tc.toolName === "logFood" || tc.toolName === "confirmFood"
        )
      );
      
      if (foodMentions.length > 0) {
        summary.foodPatterns = [`Logged ${foodMentions.length} meals today`];
      }
      
      // Save the summary without lastMessageId for now
      await ctx.runMutation(api.conversationSummary.saveDailySummary, {
        date: args.date,
        summary,
        messageCount: args.messages.length,
      });
      
      return summary;
    } catch (error) {
      console.error("Error generating summary:", error);
      return null;
    }
  },
});

// Compress historical summaries into a single context string
export const compressHistoricalContext = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // Get last 7 days of summaries
    const summaries = await ctx.runQuery(api.conversationSummary.getHistoricalContext, {
      days: 7
    });
    
    if (summaries.length === 0) return null;
    
    // Combine summaries into a compressed format
    const compressed = {
      recentPatterns: [] as string[],
      establishedFacts: [] as string[],
      ongoingGoals: [] as string[],
    };
    
    // Deduplicate and organize information
    const allKeyPoints = new Set<string>();
    const allPatterns = new Set<string>();
    const allGoals = new Set<string>();
    
    summaries.forEach((summary: Doc<"conversationSummaries"> | null) => {
      summary?.summary.keyPoints.forEach((p: string) => allKeyPoints.add(p));
      summary?.summary.foodPatterns.forEach((p: string) => allPatterns.add(p));
      summary?.summary.goals.forEach((g: string) => allGoals.add(g));
    });
    
    compressed.establishedFacts = Array.from(allKeyPoints);
    compressed.recentPatterns = Array.from(allPatterns);
    compressed.ongoingGoals = Array.from(allGoals);
    
    return compressed;
  },
});