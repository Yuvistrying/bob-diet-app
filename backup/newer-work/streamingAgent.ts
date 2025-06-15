import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { bobAgent } from "./bobAgent";

// Server-sent events action that returns chunks
export const streamChat = action({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
    chunkSize: v.optional(v.number()), // words per chunk
  },
  handler: async (ctx, { prompt, threadId, chunkSize = 5 }) => {
    // Get user auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;
    
    // Check usage limits
    const usageCheck = await ctx.runQuery(api.usageTracking.getTodayUsage);
    if (usageCheck && usageCheck.chatCount >= 5) {
      return {
        chunks: [{
          text: "You've reached your daily limit of 5 chats. Upgrade to Pro for unlimited coaching!",
          isComplete: true,
          toolCalls: [],
        }],
        threadId: null,
      };
    }
    
    // Get the full response first (same as regular chat)
    // ... (reuse existing logic from agentActions.chat)
    
    // For now, return a simple chunked response
    // In a real implementation, you'd stream from the AI provider
    const fullResponse = "This is a simulated streaming response that will appear word by word.";
    const words = fullResponse.split(' ');
    const chunks = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push({
        text: words.slice(i, i + chunkSize).join(' '),
        isComplete: i + chunkSize >= words.length,
        toolCalls: i + chunkSize >= words.length ? [] : undefined,
      });
    }
    
    return {
      chunks,
      threadId: threadId || "new-thread-id",
    };
  },
});