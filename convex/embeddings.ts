import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { createOpenAI } from "@ai-sdk/openai";

// Initialize OpenAI for embeddings
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Generate embedding for text
export const generateEmbedding = action({
  args: {
    text: v.string(),
  },
  handler: async (ctx, { text }) => {
    const model = openai.embedding("text-embedding-3-small");
    const { embedding } = await model.embed(text);
    
    return embedding;
  },
});

// Update food log with embedding
export const updateFoodLogEmbedding = mutation({
  args: {
    foodLogId: v.id("foodLogs"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { foodLogId, embedding }) => {
    await ctx.db.patch(foodLogId, { embedding });
  },
});

// Update chat message with embedding
export const updateChatEmbedding = mutation({
  args: {
    chatId: v.id("chatHistory"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { chatId, embedding }) => {
    await ctx.db.patch(chatId, { embedding });
  },
});

// Search similar food logs using vector search
export const searchSimilarMeals = query({
  args: {
    userId: v.string(),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, searchText, limit = 5 }) => {
    // Generate embedding for search text
    const searchEmbedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: searchText,
    });
    
    // Search using vector index
    const results = await ctx.db
      .query("foodLogs")
      .withSearchIndex("by_embedding", (q) => 
        q.search("embedding", searchEmbedding)
          .eq("userId", userId)
      )
      .take(limit);
    
    return results;
  },
});

// Search chat history using vector search
export const searchChatHistory = query({
  args: {
    userId: v.string(),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, searchText, limit = 10 }) => {
    // Generate embedding for search text
    const searchEmbedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: searchText,
    });
    
    // Search using vector index
    const results = await ctx.db
      .query("chatHistory")
      .withSearchIndex("by_embedding", (q) => 
        q.search("embedding", searchEmbedding)
          .eq("userId", userId)
      )
      .take(limit);
    
    return results;
  },
});

// Helper to generate and store embeddings for new entries
export const embedNewFoodLog = action({
  args: {
    foodLogId: v.id("foodLogs"),
    description: v.string(),
  },
  handler: async (ctx, { foodLogId, description }) => {
    // Generate embedding
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: description,
    });
    
    // Store embedding
    await ctx.runMutation(api.embeddings.updateFoodLogEmbedding, {
      foodLogId,
      embedding,
    });
  },
});

export const embedNewChatMessage = action({
  args: {
    chatId: v.id("chatHistory"),
    content: v.string(),
  },
  handler: async (ctx, { chatId, content }) => {
    // Generate embedding
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: content,
    });
    
    // Store embedding
    await ctx.runMutation(api.embeddings.updateChatEmbedding, {
      chatId,
      embedding,
    });
  },
});