import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

type BobResponse = {
  message: string;
  action: string | null;
  data: any;
  metadata: any;
};

type FoodEstimate = {
  foods: Array<{
    name: string;
    quantity: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidence: string;
  mealType: string;
};

type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Main Bob chat action with all integrations
export const chat = action({
  args: {
    message: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    response: string;
    action: string | null;
    showUpgrade?: boolean;
    data?: any;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check usage limits
    const canChat = await ctx.runQuery(api.usageTracking.checkUsageLimit, {
      usageType: args.imageUrl ? "photoAnalysis" : "chat",
    });

    if (!canChat.allowed) {
      return {
        response: canChat.message,
        showUpgrade: canChat.showUpgrade,
        action: null,
      };
    }

    // Get chat context
    const context = await ctx.runQuery(api.chatHistory.getChatContext);
    if (!context) throw new Error("Could not load context");

    // Save user message
    await ctx.runMutation(api.chatHistory.saveUserMessage, {
      content: args.message,
      metadata: { actionType: args.imageUrl ? "photo_analysis" : "text" },
    });

    // Track usage
    await ctx.runMutation(api.usageTracking.trackUsage, {
      usageType: args.imageUrl ? "photoAnalysis" : "chat",
      modelUsed: args.imageUrl ? "opus" : "sonnet",
    });

    // Process the message with Bob's logic
    const bobResponse = await processBobMessage(
      ctx,
      args.message,
      context,
      args.imageUrl,
    );

    // Save Bob's response
    await ctx.runMutation(api.chatHistory.saveBobMessage, {
      content: bobResponse.message,
      metadata: bobResponse.metadata,
    });

    return {
      response: bobResponse.message,
      action: bobResponse.action,
      data: bobResponse.data,
    };
  },
});

// Bob's message processing logic
async function processBobMessage(
  ctx: ActionCtx,
  message: string,
  context: any,
  imageUrl?: string,
): Promise<BobResponse> {
  const lowerMessage = message.toLowerCase();

  // Check for weight logging intent
  if (lowerMessage.includes("weight") || lowerMessage.includes("weigh")) {
    const weightMatch = message.match(/(\d+\.?\d*)\s*(kg|lbs|pounds|kilos)?/i);
    if (weightMatch) {
      const weight = parseFloat(weightMatch[1]);
      const unit = weightMatch[2]?.toLowerCase().includes("lb") ? "lbs" : "kg";

      const logId = await ctx.runMutation(api.weightLogs.logWeight, {
        weight,
        unit,
      });

      return {
        message: `Great! I've logged your weight as ${weight} ${unit}. ${getWeightFeedback(weight, context.user.currentWeight, context.user.goal)}`,
        action: "weight_logged",
        data: { logId, weight, unit },
        metadata: { weightLogId: logId, actionType: "weight_log" },
      };
    }
  }

  // Check for food logging intent
  if (isFoodDescription(message) || imageUrl) {
    let foodEstimate;

    if (imageUrl) {
      // TODO: Implement Claude Vision API for photo analysis
      foodEstimate = await analyzePhotoFood(imageUrl);
    } else {
      foodEstimate = await estimateFoodFromDescription(message);
    }

    // Log the food
    const logId = await ctx.runMutation(api.foodLogs.logFood, {
      description: message,
      foods: foodEstimate.foods,
      photoUrl: imageUrl,
      aiEstimated: true,
      confidence: foodEstimate.confidence,
    });

    const response = formatFoodResponse(foodEstimate, context);

    return {
      message: response,
      action: "food_logged",
      data: { logId, ...foodEstimate },
      metadata: { foodLogId: logId, actionType: "food_log" },
    };
  }

  // General coaching response
  return {
    message: getCoachingResponse(message, context),
    action: null,
    data: null,
    metadata: { actionType: "general_chat" },
  };
}

// Helper functions
function isFoodDescription(message: string): boolean {
  const foodKeywords = [
    "ate",
    "had",
    "eating",
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "meal",
    "food",
    "drink",
    "drank",
  ];
  const lower = message.toLowerCase();
  return foodKeywords.some((keyword) => lower.includes(keyword));
}

function getWeightFeedback(
  current: number,
  previous: number | undefined,
  goal: string,
): string {
  if (!previous) return "Keep tracking daily for best results!";

  const change = current - previous;

  if (goal === "cut" && change < 0) {
    return "You're making progress! Keep up the great work! 💪";
  } else if (goal === "gain" && change > 0) {
    return "Nice gains! You're moving in the right direction! 🎯";
  } else if (goal === "maintain" && Math.abs(change) < 0.5) {
    return "Perfect maintenance! You're right on track! ⚖️";
  }

  return "Remember, weight fluctuates daily. Focus on the weekly trend!";
}

function formatFoodResponse(estimate: FoodEstimate, context: any): string {
  const { user, todayProgress } = context;

  if (user.displayMode === "stealth") {
    return `Got it! I've logged your ${estimate.mealType || "meal"}. You're doing great with your choices today! ${todayProgress.meals + 1} meals logged so far. 🎯`;
  }

  const remaining = todayProgress.calories.remaining - estimate.totalCalories;

  return `Perfect! I've logged:
${estimate.foods.map((f: any) => `• ${f.name}: ${f.calories} cal, ${f.protein}g protein`).join("\n")}

Total: ${estimate.totalCalories} calories, ${estimate.totalProtein}g protein
You have ${remaining} calories remaining today. ${remaining > 0 ? "On track! 🎯" : "Consider a lighter next meal 🥗"}`;
}

function getCoachingResponse(message: string, context: any): string {
  const { user, todayProgress } = context;
  const lower = message.toLowerCase();

  // Greetings
  if (
    lower.includes("hello") ||
    lower.includes("hi") ||
    lower.includes("hey")
  ) {
    return `Hey ${user.name}! How's your day going? Have you logged your meals yet? You've had ${todayProgress.meals} meals today.`;
  }

  // Progress check
  if (lower.includes("how am i doing") || lower.includes("progress")) {
    if (user.displayMode === "stealth") {
      return `You're doing great today! ${todayProgress.meals} meals logged and you're making healthy choices. Keep it up! 🌟`;
    }
    return `You're at ${todayProgress.calories.consumed}/${todayProgress.calories.target} calories and ${todayProgress.protein.consumed}/${todayProgress.protein.target}g protein. ${todayProgress.calories.remaining > 0 ? "Right on track!" : "You've hit your target!"}`;
  }

  // Default helpful response
  return "I'm here to help with your nutrition! You can tell me what you ate, log your weight, or ask about your progress. What would you like to do?";
}

// Food estimation logic (simplified - in production this would use AI)
async function estimateFoodFromDescription(
  description: string,
): Promise<FoodEstimate> {
  // This is a simplified version - in production, you'd use Claude to analyze the description
  const estimates: Record<string, Macros> = {
    croissant: { calories: 280, protein: 5, carbs: 32, fat: 15 },
    "chicken breast": { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    salad: { calories: 150, protein: 5, carbs: 10, fat: 10 },
    rice: { calories: 200, protein: 4, carbs: 45, fat: 0.5 },
    pasta: { calories: 350, protein: 12, carbs: 65, fat: 2 },
  };

  // Find matching food
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  const foods = [];

  for (const [food, macros] of Object.entries(estimates)) {
    if (description.toLowerCase().includes(food)) {
      foods.push({
        name: food,
        quantity: "1 serving",
        ...macros,
      });
      totalCalories += macros.calories;
      totalProtein += macros.protein;
      totalCarbs += macros.carbs;
      totalFat += macros.fat;
    }
  }

  // Default if no match
  if (foods.length === 0) {
    foods.push({
      name: description,
      quantity: "1 serving",
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
    });
    totalCalories = 300;
    totalProtein = 20;
    totalCarbs = 30;
    totalFat = 10;
  }

  return {
    foods,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    confidence: "medium",
    mealType: guessMealType(),
  };
}

async function analyzePhotoFood(imageUrl: string): Promise<FoodEstimate> {
  // TODO: Implement Claude Vision API
  // For now, return a mock response
  return {
    foods: [
      {
        name: "Mixed meal from photo",
        quantity: "1 serving",
        calories: 450,
        protein: 30,
        carbs: 45,
        fat: 15,
      },
    ],
    totalCalories: 450,
    totalProtein: 30,
    totalCarbs: 45,
    totalFat: 15,
    confidence: "high",
    mealType: guessMealType(),
  };
}

function guessMealType(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}
