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
    birthDate: v.optional(v.string()), // YYYY-MM-DD format, will replace age field
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
    agentThreadId: v.optional(v.string()), // For persisting chat thread across refreshes
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
    createdAt: v.number(),
    embedding: v.optional(v.array(v.float64()))
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_created", ["userId", "createdAt"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId"]
  }),

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
    createdAt: v.number(),
    embedding: v.optional(v.array(v.float64()))
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_meal_date", ["userId", "meal", "date"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId"]
  }),

  // Session cache for performance (with TTL)
  sessionCache: defineTable({
    userId: v.string(),
    cacheKey: v.string(),
    data: v.string(), // JSON stringified
    expiresAt: v.number(), // timestamp
  })
  .index("by_user_key", ["userId", "cacheKey"])
  .index("by_expires", ["expiresAt"]), // for cleanup
  
  // Chat sessions for better conversation management
  chatSessions: defineTable({
    userId: v.string(),
    startDate: v.string(), // YYYY-MM-DD
    threadId: v.string(),
    messageCount: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
  })
  .index("by_user_date", ["userId", "startDate"])
  .index("by_user_active", ["userId", "isActive"]),

  // Chat history with Bob
  chatHistory: defineTable({
    userId: v.string(),
    role: v.string(), // "user" or "assistant"
    content: v.string(),
    timestamp: v.number(),
    metadata: v.optional(v.object({
      foodLogId: v.optional(v.id("foodLogs")),
      weightLogId: v.optional(v.id("weightLogs")),
      actionType: v.optional(v.string()), // "food_log", "weight_log", "question", etc.
      toolCalls: v.optional(v.any()), // Store tool calls for persistence
      threadId: v.optional(v.string()), // Thread ID for conversation continuity
      storageId: v.optional(v.id("_storage")), // Image storage ID if photo was uploaded
      usage: v.optional(v.object({ // Token usage tracking
        promptTokens: v.number(),
        completionTokens: v.number(),
        totalTokens: v.number()
      }))
    })),
    embedding: v.optional(v.array(v.float64()))
  })
  .index("by_user", ["userId"])
  .index("by_user_timestamp", ["userId", "timestamp"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId", "role"]
  }),

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

  // Photo analyses for food recognition
  photoAnalyses: defineTable({
    userId: v.string(),
    timestamp: v.number(),
    storageId: v.id("_storage"), // Convex storage ID for the photo
    analysis: v.object({
      foods: v.array(v.object({
        name: v.string(),
        quantity: v.string(),
        calories: v.number(),
        protein: v.number(),
        carbs: v.number(),
        fat: v.number(),
        confidence: v.string() // "low", "medium", "high"
      })),
      totalCalories: v.number(),
      totalProtein: v.number(),
      totalCarbs: v.number(),
      totalFat: v.number(),
      overallConfidence: v.string(), // "low", "medium", "high"
      metadata: v.optional(v.object({
        visualDescription: v.string(),
        platingStyle: v.string(),
        portionSize: v.string()
      }))
    }),
    confirmed: v.boolean(),
    loggedFoodId: v.optional(v.id("foodLogs")),
    embedding: v.optional(v.array(v.float64()))
  })
  .index("by_user_date", ["userId", "timestamp"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId"]
  }),

  // File uploads tracking
  files: defineTable({
    userId: v.string(),
    storageId: v.optional(v.id("_storage")),
    uploadUrl: v.optional(v.string()),
    uploadedAt: v.number(),
    metadata: v.optional(v.object({
      type: v.string(),
      purpose: v.string(),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_upload_url", ["uploadUrl"]),
    
  // Conversation summaries for context compression
  conversationSummaries: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    summary: v.object({
      keyPoints: v.array(v.string()), // Important facts learned
      foodPatterns: v.array(v.string()), // Eating habits observed
      userPreferences: v.array(v.string()), // Preferences mentioned
      goals: v.array(v.string()), // Goals or concerns expressed
      contextNotes: v.string(), // General context
    }),
    messageCount: v.number(),
    lastMessageId: v.optional(v.id("chatHistory")),
    createdAt: v.number(),
    updatedAt: v.number(),
    embedding: v.optional(v.array(v.float64()))
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_created", ["userId", "createdAt"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["userId"]
  }),

  // Context cache for performance optimization
  contextCache: defineTable({
    userId: v.string(),
    cacheKey: v.string(), // "coreStats", "profile", "weightTrend", "preferences"
    data: v.any(),
    ttl: v.number(), // Time to live in milliseconds
    expiresAt: v.number(), // Timestamp when cache expires
    invalidateOn: v.array(v.string()), // Events that clear this cache
  })
  .index("by_user_key", ["userId", "cacheKey"])
  .index("by_expiry", ["expiresAt"]),

  // Daily thread tracking
  dailyThreads: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD
    threadId: v.string(), // Thread ID
    messageCount: v.number(),
    firstMessageAt: v.number(),
    lastMessageAt: v.number(),
    isComplete: v.optional(v.boolean()),
    completedAt: v.optional(v.number()),
    summary: v.optional(v.object({
      foodsLogged: v.number(),
      totalCalories: v.number(),
      weightLogged: v.boolean(),
      keyTopics: v.array(v.string()),
    })),
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_thread", ["threadId"]),

  // Pending confirmations for food logging
  pendingConfirmations: defineTable({
    userId: v.string(),
    threadId: v.string(),
    toolCallId: v.string(),
    confirmationData: v.object({
      description: v.string(),
      items: v.array(v.object({
        name: v.string(),
        quantity: v.string(),
        calories: v.number(),
        protein: v.number(),
        carbs: v.number(),
        fat: v.number(),
      })),
      totalCalories: v.number(),
      totalProtein: v.number(),
      totalCarbs: v.number(),
      totalFat: v.number(),
      mealType: v.string(),
      confidence: v.string(),
    }),
    createdAt: v.number(),
    expiresAt: v.number(), // Auto-cleanup after 5 minutes
    status: v.string(), // "pending", "confirmed", "expired"
  })
  .index("by_user_thread", ["userId", "threadId"])
  .index("by_expires", ["expiresAt"])
  .index("by_status", ["status"]),

  // Message summaries for context compression
  messageSummaries: defineTable({
    threadId: v.string(),
    summary: v.string(),
    keyPoints: v.array(v.string()),
    foodsLogged: v.number(),
    caloriesTotal: v.number(),
    messageRange: v.object({
      startIndex: v.number(),
      endIndex: v.number(),
      startTimestamp: v.number(),
      endTimestamp: v.number(),
    }),
    createdAt: v.number(),
  })
  .index("by_thread", ["threadId"]),

  // Confirmed bubble states for persistence across devices
  confirmedBubbles: defineTable({
    userId: v.string(),
    threadId: v.string(),
    messageIndex: v.number(),
    confirmationId: v.string(), // The generated ID for the confirmation
    toolCallId: v.optional(v.string()), // Original tool call ID
    foodDescription: v.string(),
    status: v.string(), // "confirmed" or "rejected"
    confirmedAt: v.number(),
    expiresAt: v.number(), // Auto-cleanup after 7 days
  })
  .index("by_user_thread", ["userId", "threadId"])
  .index("by_expires", ["expiresAt"])
  .index("by_confirmation_id", ["confirmationId"]),
  
  // Goal change history for tracking user progress
  goalHistory: defineTable({
    userId: v.string(),
    previousGoal: v.string(), // "cut", "gain", "maintain"
    newGoal: v.string(), // "cut", "gain", "maintain"
    previousTargetWeight: v.number(),
    newTargetWeight: v.number(),
    currentWeight: v.number(), // Weight at time of goal change
    reason: v.optional(v.string()), // Why they changed goals
    triggeredBy: v.string(), // "user_request", "goal_reached", "bob_suggestion"
    changedAt: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_user_date", ["userId", "changedAt"]),
  
  // Goal achievements tracking
  goalAchievements: defineTable({
    userId: v.string(),
    goalType: v.string(), // "cut", "gain", "maintain"
    targetWeight: v.number(),
    achievedWeight: v.number(), // Weekly average when achieved
    weeklyAverage: v.number(), // The weekly average that triggered achievement
    achievedAt: v.number(),
    bobSuggested: v.boolean(), // Has Bob suggested a new goal?
    newGoalSet: v.optional(v.boolean()), // Did user accept new goal?
    daysAtGoal: v.optional(v.number()), // For maintenance goals
  })
  .index("by_user", ["userId"])
  .index("by_user_triggered", ["userId", "bobSuggested"])
  .index("by_achieved_date", ["achievedAt"]),
});