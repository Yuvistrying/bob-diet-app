import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Keep existing auth table
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),

  // Keep existing subscription tables
  subscriptions: defineTable({
    userId: v.optional(v.string()),
    polarId: v.optional(v.string()),
    polarPriceId: v.optional(v.string()),
    currency: v.optional(v.string()),
    interval: v.optional(v.string()),
    status: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    amount: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    customerCancellationReason: v.optional(v.string()),
    customerCancellationComment: v.optional(v.string()),
    metadata: v.optional(v.any()),
    customFieldData: v.optional(v.any()),
    customerId: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("polarId", ["polarId"]),

  webhookEvents: defineTable({
    type: v.string(),
    polarEventId: v.string(),
    createdAt: v.string(),
    modifiedAt: v.string(),
    data: v.any(),
  })
    .index("type", ["type"])
    .index("polarEventId", ["polarEventId"]),

  // NEW TABLES FOR BOB DIET COACH

  // User profiles with diet goals
  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    currentWeight: v.number(),
    targetWeight: v.number(),
    height: v.number(),
    age: v.number(),
    gender: v.string(), // "male", "female", "other"
    activityLevel: v.string(), // "sedentary", "light", "moderate", "active"
    goal: v.string(), // "cut", "gain", "maintain"
    dailyCalorieTarget: v.number(),
    proteinTarget: v.number(),
    carbsTarget: v.optional(v.number()),
    fatTarget: v.optional(v.number()),
    preferredUnits: v.string(), // "metric" or "imperial"
    timezone: v.string(),
    onboardingCompleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  // User preferences including stealth mode
  userPreferences: defineTable({
    userId: v.string(),
    displayMode: v.string(), // "standard" or "stealth"
    showCalories: v.boolean(),
    showProtein: v.boolean(),
    showCarbs: v.boolean(),
    showFats: v.boolean(),
    language: v.string(),
    darkMode: v.boolean(),
    cuteMode: v.boolean(), // From your UI design!
    reminderSettings: v.object({
      weighInReminder: v.boolean(),
      mealReminders: v.boolean(),
      reminderTimes: v.object({
        weighIn: v.optional(v.string()),
        breakfast: v.optional(v.string()),
        lunch: v.optional(v.string()),
        dinner: v.optional(v.string())
      })
    }),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  // Weight tracking
  weightLogs: defineTable({
    userId: v.string(),
    weight: v.number(),
    unit: v.string(), // "kg" or "lbs"
    date: v.string(), // YYYY-MM-DD format
    time: v.string(), // HH:MM format
    notes: v.optional(v.string()),
    createdAt: v.number()
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_created", ["userId", "createdAt"]),

  // Food logging
  foodLogs: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    time: v.string(), // HH:MM
    meal: v.string(), // "breakfast", "lunch", "dinner", "snack"
    description: v.string(), // Natural language description
    foods: v.array(v.object({
      name: v.string(),
      quantity: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number()
    })),
    totalCalories: v.number(),
    totalProtein: v.number(),
    totalCarbs: v.number(),
    totalFat: v.number(),
    photoUrl: v.optional(v.string()),
    aiEstimated: v.boolean(),
    confidence: v.string(), // "high", "medium", "low"
    createdAt: v.number()
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_meal_date", ["userId", "meal", "date"]),

  // Chat history with Bob
  chatHistory: defineTable({
    userId: v.string(),
    role: v.string(), // "user" or "assistant"
    content: v.string(),
    timestamp: v.number(),
    metadata: v.optional(v.object({
      foodLogId: v.optional(v.id("foodLogs")),
      weightLogId: v.optional(v.id("weightLogs")),
      actionType: v.optional(v.string()) // "food_log", "weight_log", "question", etc.
    }))
  })
  .index("by_user", ["userId"])
  .index("by_user_timestamp", ["userId", "timestamp"]),

  // Usage tracking for freemium
  usageTracking: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    chatCount: v.number(),
    photoAnalysisCount: v.number(),
    opusCallsCount: v.number(),
    sonnetCallsCount: v.number(),
    lastResetAt: v.number()
  }).index("by_user_date", ["userId", "date"]),

  // Calibration history
  calibrationHistory: defineTable({
    userId: v.string(),
    date: v.string(),
    oldCalorieTarget: v.number(),
    newCalorieTarget: v.number(),
    reason: v.string(),
    dataPointsAnalyzed: v.number(),
    confidence: v.string(), // "high", "medium", "low"
    createdAt: v.number()
  }).index("by_user", ["userId"]),

  // Weekly analytics
  weeklyAnalytics: defineTable({
    userId: v.string(),
    weekStartDate: v.string(), // YYYY-MM-DD (Monday)
    avgDailyCalories: v.number(),
    avgDailyProtein: v.number(),
    avgDailyCarbs: v.number(),
    avgDailyFat: v.number(),
    startWeight: v.number(),
    endWeight: v.number(),
    actualWeightChange: v.number(),
    expectedWeightChange: v.number(),
    adherenceScore: v.number(), // 0-100
    createdAt: v.number()
  }).index("by_user_week", ["userId", "weekStartDate"]),

  // Onboarding progress
  onboardingProgress: defineTable({
    userId: v.string(),
    currentStep: v.string(),
    responses: v.any(), // Flexible object for storing partial responses
    completed: v.boolean(),
    startedAt: v.number(),
    completedAt: v.optional(v.number())
  }).index("by_user", ["userId"]),
});