import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// Create a new photo analysis record
export const createPhotoAnalysis = mutation({
  args: {
    userId: v.string(),
    timestamp: v.number(),
    storageId: v.id("_storage"),
    analysis: v.object({
      foods: v.array(
        v.object({
          name: v.string(),
          quantity: v.string(),
          calories: v.number(),
          protein: v.number(),
          carbs: v.number(),
          fat: v.number(),
          confidence: v.string(),
        }),
      ),
      totalCalories: v.number(),
      totalProtein: v.number(),
      totalCarbs: v.number(),
      totalFat: v.number(),
      overallConfidence: v.string(),
      metadata: v.optional(
        v.object({
          visualDescription: v.string(),
          platingStyle: v.string(),
          portionSize: v.string(),
        }),
      ),
    }),
    confirmed: v.boolean(),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const photoId = await ctx.db.insert("photoAnalyses", args);
    return photoId;
  },
});

// Search for similar photos using vector search
// Note: This is deprecated - use vectorSearch.searchSimilarPhotos instead
export const searchSimilar = query({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, embedding, limit = 5 }) => {
    // Deprecated - vector search requires actions
    // Use api.vectorSearch.searchSimilarPhotos instead
    return [];
  },
});

// Get user's photo history
export const getUserPhotoHistory = query({
  args: {
    limit: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, { limit = 10, startDate, endDate }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    let query = ctx.db
      .query("photoAnalyses")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .order("desc");

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Date.now();

      query = query.filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), start),
          q.lte(q.field("timestamp"), end),
        ),
      );
    }

    const photos = await query.take(limit);
    return photos;
  },
});

// Confirm a photo analysis and log it as food
export const confirmPhotoAnalysis = mutation({
  args: {
    photoId: v.id("photoAnalyses"),
    adjustments: v.optional(
      v.object({
        foods: v.optional(
          v.array(
            v.object({
              name: v.string(),
              quantity: v.string(),
              calories: v.number(),
              protein: v.number(),
              carbs: v.number(),
              fat: v.number(),
            }),
          ),
        ),
        mealType: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { photoId, adjustments }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const photo = await ctx.db.get(photoId);
    if (!photo || photo.userId !== identity.subject) {
      throw new Error("Photo not found or unauthorized");
    }

    // Use adjusted foods if provided, otherwise use original analysis
    const foods = adjustments?.foods || photo.analysis.foods;
    const totals = foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.calories,
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    // Log the food
    const foodLogId = await ctx.runMutation(api.foodLogs.logFood, {
      description: `Photo analysis: ${foods.map((f) => f.name).join(", ")}`,
      foods: foods,
      meal: adjustments?.mealType,
      photoUrl: undefined, // We don't need to pass the URL anymore
      aiEstimated: true,
      confidence: photo.analysis.overallConfidence,
    });

    // Update photo record
    await ctx.db.patch(photoId, {
      confirmed: true,
      loggedFoodId: foodLogId,
    });

    return foodLogId;
  },
});

// Get photo analysis by ID
export const getPhotoAnalysis = query({
  args: { photoId: v.id("photoAnalyses") },
  handler: async (ctx, { photoId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const photo = await ctx.db.get(photoId);
    if (!photo || photo.userId !== identity.subject) {
      return null;
    }

    return photo;
  },
});
