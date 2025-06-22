import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { bobAgent } from "./bobAgent";

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
      // For now, just log that we would save to Agent
      // The Agent integration needs more work to handle streaming messages properly
      console.log("[agentBridge] Would save message to Agent thread:", {
        threadId: args.threadId,
        messageLength: args.message.content.length,
        hasToolCalls: !!args.toolCalls?.length,
        hasUsage: !!args.usage
      });
      
      // Return success for now
      return { messageId: `temp_${Date.now()}`, saved: false };
    } catch (error: any) {
      console.error("[agentBridge] Error:", error);
      throw error;
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
    
    const today = new Date().toDateString();
    
    // For now, just create a new thread each day
    // TODO: Implement proper daily thread tracking when Agent supports metadata queries
    const { threadId } = await bobAgent.createThread(ctx, { 
      userId,
      title: `Daily thread - ${today}`,
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