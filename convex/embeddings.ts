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
    console.log("[generateEmbedding] Generating embedding for text:", text.substring(0, 100) + "...");
    
    const model = openai.embedding("text-embedding-3-small");
    const result = await model.doEmbed({ values: [text] });
    const embedding = result.embeddings[0];
    
    console.log("[generateEmbedding] Successfully generated embedding with", embedding.length, "dimensions");
    
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

// Update weight log with embedding
export const updateWeightLogEmbedding = mutation({
  args: {
    weightLogId: v.id("weightLogs"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { weightLogId, embedding }) => {
    await ctx.db.patch(weightLogId, { embedding });
  },
});

// Update conversation summary with embedding
export const updateSummaryEmbedding = mutation({
  args: {
    summaryId: v.id("conversationSummaries"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, { summaryId, embedding }) => {
    await ctx.db.patch(summaryId, { embedding });
  },
});

// Search similar food logs using vector search
// Note: This is deprecated - use vectorSearch.searchSimilarMeals instead
export const searchSimilarMeals = query({
  args: {
    userId: v.string(),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, searchText, limit = 5 }) => {
    // Deprecated - vector search requires actions
    // Use api.vectorSearch.searchSimilarMeals instead
    return [];
  },
});

// Search chat history using vector search
// Note: This is deprecated - use vectorSearch.searchChatHistory instead
export const searchChatHistory = query({
  args: {
    userId: v.string(),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, searchText, limit = 10 }) => {
    // Deprecated - vector search requires actions
    // Use api.vectorSearch.searchChatHistory instead
    return [];
  },
});

// Helper to generate and store embeddings for new entries
export const embedNewFoodLog = action({
  args: {
    foodLogId: v.id("foodLogs"),
    description: v.string(),
  },
  handler: async (ctx, { foodLogId, description }) => {
    console.log("[embedNewFoodLog] Starting embedding for food log:", foodLogId, "with description:", description);
    
    // Generate embedding
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: description,
    });
    
    // Store embedding
    await ctx.runMutation(api.embeddings.updateFoodLogEmbedding, {
      foodLogId,
      embedding,
    });
    
    console.log("[embedNewFoodLog] Successfully embedded food log:", foodLogId);
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

export const embedWeightLogNote = action({
  args: {
    weightLogId: v.id("weightLogs"),
    weight: v.number(),
    unit: v.string(),
    date: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, { weightLogId, weight, unit, date, notes }) => {
    // Create descriptive text including weight context
    const embeddingText = `Weight log ${date}: ${weight} ${unit}. Notes: ${notes}`;
    
    // Generate embedding
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: embeddingText,
    });
    
    // Store embedding
    await ctx.runMutation(api.embeddings.updateWeightLogEmbedding, {
      weightLogId,
      embedding,
    });
  },
});

export const embedConversationSummary = action({
  args: {
    summaryId: v.id("conversationSummaries"),
    date: v.string(),
    summary: v.object({
      keyPoints: v.array(v.string()),
      foodPatterns: v.array(v.string()),
      userPreferences: v.array(v.string()),
      goals: v.array(v.string()),
      contextNotes: v.string(),
    }),
  },
  handler: async (ctx, { summaryId, date, summary }) => {
    // Create comprehensive text from all summary fields
    const embeddingText = [
      `Daily summary for ${date}:`,
      summary.keyPoints.length > 0 ? `Key points: ${summary.keyPoints.join('. ')}` : '',
      summary.foodPatterns.length > 0 ? `Food patterns: ${summary.foodPatterns.join('. ')}` : '',
      summary.userPreferences.length > 0 ? `Preferences: ${summary.userPreferences.join('. ')}` : '',
      summary.goals.length > 0 ? `Goals: ${summary.goals.join('. ')}` : '',
      summary.contextNotes ? `Context: ${summary.contextNotes}` : ''
    ].filter(Boolean).join(' ');
    
    // Generate embedding
    const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
      text: embeddingText,
    });
    
    // Store embedding
    await ctx.runMutation(api.embeddings.updateSummaryEmbedding, {
      summaryId,
      embedding,
    });
  },
});