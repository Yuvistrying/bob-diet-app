import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Get today's nutrition stats
export const getTodayStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const today = new Date().toISOString().split("T")[0];

    const todayLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .collect();

    return todayLogs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.totalCalories,
        protein: acc.protein + log.totalProtein,
        carbs: acc.carbs + log.totalCarbs,
        fat: acc.fat + log.totalFat,
        meals: acc.meals + 1,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
    );
  },
});

// Get today's food logs (used by cache)
export const getTodayFoodLogs = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const today = new Date().toISOString().split("T")[0];

    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .collect();

    // Sort by time
    return logs.sort((a, b) => a.time.localeCompare(b.time));
  },
});

// Get today's logs (alias for streaming route)
export const getTodayLogs = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const today = new Date().toISOString().split("T")[0];

    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .order("asc")
      .collect();

    return logs;
  },
});

// Get food logs for a specific date
export const getFoodLogsByDate = query({
  args: {
    date: v.string(), // YYYY-MM-DD format
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = args.userId || identity.subject;

    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", args.date),
      )
      .collect();

    // Sort by time
    return logs.sort((a, b) => a.time.localeCompare(b.time));
  },
});

// Get today's macro summary
export const getTodayMacros = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const today = new Date().toISOString().split("T")[0];

    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", identity.subject).eq("date", today),
      )
      .collect();

    // Sum up all macros
    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + log.totalCalories,
        protein: acc.protein + log.totalProtein,
        carbs: acc.carbs + log.totalCarbs,
        fat: acc.fat + log.totalFat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    // Get user's targets
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    return {
      consumed: totals,
      targets: profile
        ? {
            calories: profile.dailyCalorieTarget,
            protein: profile.proteinTarget,
            carbs: profile.carbsTarget || 0,
            fat: profile.fatTarget || 0,
          }
        : null,
      remaining: profile
        ? {
            calories: profile.dailyCalorieTarget - totals.calories,
            protein: profile.proteinTarget - totals.protein,
            carbs: (profile.carbsTarget || 0) - totals.carbs,
            fat: (profile.fatTarget || 0) - totals.fat,
          }
        : null,
    };
  },
});

// Log food from chat
export const logFood = mutation({
  args: {
    description: v.string(),
    foods: v.array(
      v.object({
        name: v.string(),
        quantity: v.string(),
        calories: v.number(),
        protein: v.number(),
        carbs: v.number(),
        fat: v.number(),
      }),
    ),
    meal: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    aiEstimated: v.boolean(),
    confidence: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().slice(0, 5); // HH:MM format

    // Determine meal based on time if not provided
    let meal = args.meal;
    if (!meal) {
      const hour = now.getHours();
      if (hour < 11) meal = "breakfast";
      else if (hour < 15) meal = "lunch";
      else if (hour < 20) meal = "dinner";
      else meal = "snack";
    }

    // Calculate totals
    const totals = args.foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.calories,
        protein: acc.protein + food.protein,
        carbs: acc.carbs + food.carbs,
        fat: acc.fat + food.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    const foodLogId = await ctx.db.insert("foodLogs", {
      userId: identity.subject,
      date,
      time,
      meal,
      description: args.description,
      foods: args.foods,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFat: totals.fat,
      photoUrl: args.photoUrl,
      aiEstimated: args.aiEstimated,
      confidence: args.confidence,
      createdAt: Date.now(),
    });

    // Note: Embedding is generated in the streaming route with richer context
    // Removed duplicate embedding generation here

    // Note: No cache invalidation needed - stream-v2 uses direct queries

    return foodLogId;
  },
});

// Update a food log
export const updateFoodLog = mutation({
  args: {
    logId: v.id("foodLogs"),
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== identity.subject) {
      throw new Error("Food log not found or unauthorized");
    }

    const updates: any = {};

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.foods) {
      updates.foods = args.foods;
      // Recalculate totals
      const totals = args.foods.reduce(
        (acc, food) => ({
          calories: acc.calories + food.calories,
          protein: acc.protein + food.protein,
          carbs: acc.carbs + food.carbs,
          fat: acc.fat + food.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

      updates.totalCalories = totals.calories;
      updates.totalProtein = totals.protein;
      updates.totalCarbs = totals.carbs;
      updates.totalFat = totals.fat;
    }

    await ctx.db.patch(args.logId, updates);
  },
});

// Delete a food log
export const deleteFoodLog = mutation({
  args: { logId: v.id("foodLogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== identity.subject) {
      throw new Error("Food log not found or unauthorized");
    }

    await ctx.db.delete(args.logId);
  },
});

// Get food logs for date range (for analytics)
export const getFoodLogsRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // This is a simplified version - in production you'd want pagination
    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate),
        ),
      )
      .collect();

    return logs;
  },
});

// Get weekly food statistics
export const getWeeklyStats = query({
  args: {
    weekStartDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Get user profile for calorie target
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) return null;

    // Calculate week end date (6 days after start)
    const startDate = new Date(args.weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const weekEndDate = endDate.toISOString().split("T")[0];

    // Get all food logs for the week
    const logs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.gte(q.field("date"), args.weekStartDate),
          q.lte(q.field("date"), weekEndDate),
        ),
      )
      .collect();

    // Calculate statistics
    const totalCalories = logs.reduce((sum, log) => sum + log.totalCalories, 0);
    const daysWithLogs = new Set(logs.map((log) => log.date)).size;
    const averageCalories = daysWithLogs > 0 ? totalCalories / daysWithLogs : 0;

    // Count meals logged (assuming 3 meals per day)
    const mealsLogged = logs.length;

    // Calculate expected weight change based on deficit/surplus
    const dailyDeficit = profile.dailyCalorieTarget - averageCalories;
    const weeklyDeficit = dailyDeficit * 7;
    const expectedWeightChange = -(weeklyDeficit / 7700); // 7700 cal = 1kg

    return {
      totalCalories,
      averageCalories: Math.round(averageCalories),
      mealsLogged,
      daysWithLogs,
      expectedWeightChange: Math.round(expectedWeightChange * 100) / 100,
    };
  },
});
