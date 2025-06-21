import { v } from "convex/values";
import { action } from "./_generated/server";
import { internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Action to search similar meals using vector embeddings
export const searchSimilarMeals = action({
  args: {
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchText, limit = 5 }): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Generate embedding for search text
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: searchText,
    });
    
    // Use internal query to perform vector search
    const results = await ctx.runQuery(internal.vectorSearch.vectorSearchFoodLogs, {
      userId: identity.subject,
      embedding,
      limit,
    });
    
    return results;
  },
});

// Action to search chat history using vector embeddings
export const searchChatHistory = action({
  args: {
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { searchText, limit = 10 }): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Generate embedding for search text
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: searchText,
    });
    
    // Use internal query to perform vector search
    const results = await ctx.runQuery(internal.vectorSearch.vectorSearchChatHistory, {
      userId: identity.subject,
      embedding,
      limit,
    });
    
    return results;
  },
});

// Action to search similar photos using vector embeddings
export const searchSimilarPhotos = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { embedding, limit = 5 }): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    // Use internal query to perform vector search
    const results = await ctx.runQuery(internal.vectorSearch.vectorSearchPhotos, {
      userId: identity.subject,
      embedding,
      limit,
    });
    
    return results;
  },
});

// Internal queries for vector search (these have access to vector indexes)
export const vectorSearchFoodLogs = internalQuery({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, { userId, embedding, limit }) => {
    // Temporarily return empty array until vector search is properly configured
    // TODO: Implement proper vector search when Convex supports it
    return [];
    
    // Original implementation for reference:
    // const results = await ctx.db
    //   .query("foodLogs")
    //   .withSearchIndex("by_embedding", (q: any) => 
    //     q
    //       .search("embedding", embedding)
    //       .eq("userId", userId)
    //   )
    //   .take(limit);
    // 
    // return results;
  },
});

export const vectorSearchChatHistory = internalQuery({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, { userId, embedding, limit }) => {
    // Temporarily return empty array until vector search is properly configured
    // TODO: Implement proper vector search when Convex supports it
    return [];
    
    // Original implementation for reference:
    // const results = await ctx.db
    //   .query("chatHistory")
    //   .withSearchIndex("by_embedding", (q: any) => 
    //     q
    //       .search("embedding", embedding)
    //       .eq("userId", userId)
    //   )
    //   .take(limit);
    // 
    // return results;
  },
});

export const vectorSearchPhotos = internalQuery({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, { userId, embedding, limit }) => {
    // Temporarily return empty array until vector search is properly configured
    // TODO: Implement proper vector search when Convex supports it
    return [];
    
    // Original implementation for reference:
    // const results = await ctx.db
    //   .query("photoAnalyses")
    //   .withSearchIndex("by_embedding", (q: any) => 
    //     q
    //       .search("embedding", embedding)
    //       .eq("userId", userId)
    //   )
    //   .take(limit);
    // 
    // return results;
  },
});