import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

// Initialize Anthropic client
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Analyze food image using Claude Vision
export const analyzeFood = internalAction({
  args: {
    storageId: v.id("_storage"),
    context: v.optional(v.string()),
  },
  handler: async (ctx, { storageId, context }) => {
    try {
      // Get the URL from storage
      const imageUrl = await ctx.storage.getUrl(storageId);
      if (!imageUrl) {
        throw new Error("Image not found in storage");
      }
      
      // Use Claude's vision capabilities with the Vercel AI SDK
      const { text } = await generateText({
        model: anthropic("claude-3-5-sonnet-20241022"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: imageUrl,
              },
              {
                type: "text",
                text: `You are a nutrition expert. Analyze this food image and provide detailed nutritional information.
                ${context ? `Additional context: ${context}` : ''}
                
                Provide a JSON response with this exact structure:
                {
                  "foods": [
                    {
                      "name": "food item name",
                      "quantity": "estimated portion size",
                      "calories": number,
                      "protein": number (grams),
                      "carbs": number (grams),
                      "fat": number (grams),
                      "confidence": "low" | "medium" | "high"
                    }
                  ],
                  "totalCalories": number,
                  "totalProtein": number,
                  "totalCarbs": number,
                  "totalFat": number,
                  "overallConfidence": "low" | "medium" | "high",
                  "metadata": {
                    "visualDescription": "brief description of what you see",
                    "platingStyle": "home-cooked" | "restaurant" | "fast-food" | "packaged",
                    "portionSize": "small" | "medium" | "large"
                  }
                }
                
                Be conservative with estimates. If unsure, provide lower confidence scores.`,
              },
            ],
          },
        ],
      });

      // Log the raw response for debugging
      console.log("Claude Vision response:", text);
      
      // Check if Claude detected no food in the image
      const noFoodIndicators = [
        "don't see any food",
        "no food items",
        "without any food",
        "not a food",
        "doesn't contain food",
        "can't identify any food"
      ];
      
      const lowerText = text.toLowerCase();
      const isNoFoodResponse = noFoodIndicators.some(indicator => lowerText.includes(indicator));
      
      if (isNoFoodResponse) {
        // Return a structured error response with what Claude saw
        return {
          error: true,
          noFood: true,
          description: text,
          message: "No food detected in image"
        };
      }
      
      // Parse the response
      try {
        // Extract JSON from the response text
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return analysis;
        } else {
          console.error("No JSON found in response:", text);
          // Return generic error if we can't parse but it's not a "no food" response
          return {
            error: true,
            message: "Could not analyze the image. Please try again with a clearer photo.",
            rawResponse: text
          };
        }
      } catch (parseError) {
        console.error("Failed to parse Claude's response:", parseError);
        console.error("Raw response was:", text);
        return {
          error: true,
          message: "Could not analyze the image. Please try again.",
          rawResponse: text
        };
      }
    } catch (error) {
      console.error("Vision API error:", error);
      // Return a generic error response instead of throwing
      return {
        error: true,
        message: "Failed to analyze image. Please try again.",
        systemError: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

// Save photo analysis to database
export const savePhotoAnalysis = action({
  args: {
    storageId: v.id("_storage"),
    analysis: v.object({
      foods: v.array(v.object({
        name: v.string(),
        quantity: v.string(),
        calories: v.number(),
        protein: v.number(),
        carbs: v.number(),
        fat: v.number(),
        confidence: v.string(),
      })),
      totalCalories: v.number(),
      totalProtein: v.number(),
      totalCarbs: v.number(),
      totalFat: v.number(),
      overallConfidence: v.string(),
      metadata: v.optional(v.object({
        visualDescription: v.string(),
        platingStyle: v.string(),
        portionSize: v.string(),
      })),
    }),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, { storageId, analysis, embedding }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const photoId = await ctx.runMutation(internal.vision.insertPhotoAnalysisMutation, {
      userId: identity.subject,
      timestamp: Date.now(),
      storageId,
      analysis,
      confirmed: false,
      embedding,
    });

    return photoId;
  },
});

// Internal mutation to insert photo analysis
export const insertPhotoAnalysisMutation = internalMutation({
  args: {
    userId: v.string(),
    timestamp: v.number(),
    storageId: v.id("_storage"),
    analysis: v.any(),
    confirmed: v.boolean(),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const photoId = await ctx.db.insert("photoAnalyses", args);
    return photoId;
  },
});

// Search for similar photos using vector search
export const searchSimilarPhotos = action({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { embedding, limit = 5 }): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const results = await ctx.runAction(api.vectorSearch.searchSimilarPhotos, {
      embedding,
      limit,
    });

    return results;
  },
});