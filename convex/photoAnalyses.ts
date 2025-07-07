import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Save photo analysis with embeddings
export const savePhotoAnalysis = mutation({
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

// Get photo analysis by storage ID
export const getPhotoAnalysisByStorageId = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const photo = await ctx.db
      .query("photoAnalyses")
      .withIndex("by_user_date", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("storageId"), storageId))
      .first();

    return photo;
  },
});

// Find similar meals across both photo analyses and food logs
export const findSimilarMeals = action({
  args: {
    photoId: v.id("photoAnalyses"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { photoId, limit = 5 },
  ): Promise<{
    similarPhotos: any[];
    similarFoodLogs: any[];
    insights: {
      averageCalories: number;
      calorieRange: { min: number; max: number };
      confidenceBoost: string;
      recommendation: string;
    } | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get the photo analysis
    const photo = await ctx.runQuery(api.photos.getPhotoAnalysis, { photoId });
    if (!photo || !photo.embedding) {
      return {
        similarPhotos: [],
        similarFoodLogs: [],
        insights: null,
      };
    }

    // Search for similar photos
    const similarPhotos = await ctx.runAction(
      api.vectorSearch.searchSimilarPhotos,
      {
        embedding: photo.embedding,
        limit,
      },
    );

    // Search for similar food logs
    const similarFoodLogs = await ctx.runAction(
      api.vectorSearch.searchSimilarMeals,
      {
        searchText: photo.analysis.foods
          .map((f: any) => `${f.quantity} ${f.name}`)
          .join(", "),
        limit,
      },
    );

    // Calculate insights if we have similar items
    let insights = null;
    const allSimilarCalories = [
      ...similarPhotos.map((p: any) => p.analysis.totalCalories),
      ...similarFoodLogs.map((f: any) => f.totalCalories),
    ];

    if (allSimilarCalories.length > 0) {
      const avgCalories = Math.round(
        allSimilarCalories.reduce((sum, cal) => sum + cal, 0) /
          allSimilarCalories.length,
      );
      const minCalories = Math.min(...allSimilarCalories);
      const maxCalories = Math.max(...allSimilarCalories);

      // Determine confidence boost
      let confidenceBoost = "none";
      if (allSimilarCalories.length >= 3) {
        const variance = maxCalories - minCalories;
        if (variance < 100) {
          confidenceBoost = "high";
        } else if (variance < 200) {
          confidenceBoost = "medium";
        } else {
          confidenceBoost = "low";
        }
      }

      // Generate recommendation
      let recommendation = "";
      if (Math.abs(photo.analysis.totalCalories - avgCalories) > 100) {
        if (photo.analysis.totalCalories > avgCalories) {
          recommendation = `Consider reducing portion size. Similar meals averaged ${avgCalories} calories.`;
        } else {
          recommendation = `This might be underestimated. Similar meals averaged ${avgCalories} calories.`;
        }
      } else {
        recommendation = `Good estimate! This aligns well with your history.`;
      }

      insights = {
        averageCalories: avgCalories,
        calorieRange: { min: minCalories, max: maxCalories },
        confidenceBoost,
        recommendation,
      };
    }

    return {
      similarPhotos: similarPhotos.filter((p: any) => p._id !== photoId), // Exclude self
      similarFoodLogs,
      insights,
    };
  },
});
