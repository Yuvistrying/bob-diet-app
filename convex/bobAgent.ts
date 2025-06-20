import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { Agent, createTool } from "@convex-dev/agent";
import { api, components, internal } from "./_generated/api";
import { z } from "zod";

// Initialize Anthropic with our API key
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Convert existing tools to Agent format
export const confirmFood = createTool({
  description: "Show food understanding and ask for confirmation before logging",
  args: z.object({
    description: z.string().describe("Natural description of the food"),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.string(),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
    })).describe("Breakdown of food items"),
    totalCalories: z.number(),
    totalProtein: z.number(),
    totalCarbs: z.number(),
    totalFat: z.number(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Type of meal based on time of day"),
    confidence: z.enum(["low", "medium", "high"]).describe("Confidence in the estimation"),
  }),
  handler: async (ctx, args): Promise<typeof args> => {
    // Just return the data for display - confirmation happens in UI
    console.log("confirmFood tool called with:", args);
    // The agent should include text with this tool call
    return args;
  },
});

export const logFood = createTool({
  description: "Actually log the food after user confirmation",
  args: z.object({
    description: z.string(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.string(),
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
    })),
    totalCalories: z.number(),
    totalProtein: z.number(),
    totalCarbs: z.number(),
    totalFat: z.number(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    aiEstimated: z.boolean().default(true),
    confidence: z.string(),
  }),
  handler: async (ctx, args): Promise<{ logId: string; message: string }> => {
    console.log("logFood tool called with:", args);
    
    try {
      // Log the food to database
      const logId = await ctx.runMutation(api.foodLogs.logFood, {
        description: args.description,
        foods: args.items,
        meal: args.mealType,
        aiEstimated: args.aiEstimated,
        confidence: args.confidence,
      });
      
      console.log("Food logged successfully with ID:", logId);
      
      // Get updated stats
      const stats = await ctx.runQuery(api.foodLogs.getTodayStats);
      const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
      
      const remainingCalories = profile?.dailyCalorieTarget 
        ? profile.dailyCalorieTarget - (stats?.calories || 0)
        : 0;
      
      return {
        logId,
        message: `Logged ${args.totalCalories} calories. You have ${remainingCalories} calories remaining today.`
      };
    } catch (error) {
      console.error("ERROR in logFood tool:", error);
      throw new Error("Failed to log food. Please try again.");
    }
  },
});

export const logWeight = createTool({
  description: "Log user's weight",
  args: z.object({
    weight: z.number().describe("Weight value"),
    unit: z.enum(["kg", "lbs"]).describe("Weight unit"),
    notes: z.string().optional().describe("Any notes about the weight"),
  }),
  handler: async (ctx, args): Promise<{ logId: string; message: string }> => {
    const logId = await ctx.runMutation(api.weightLogs.logWeight, {
      weight: args.weight,
      unit: args.unit,
      notes: args.notes,
    });
    
    return {
      logId,
      message: `Logged your weight: ${args.weight} ${args.unit}`
    };
  },
});

export const showProgress = createTool({
  description: "Show user's daily progress and remaining calories/macros",
  args: z.object({
    showDetailed: z.boolean().default(false).describe("Whether to show detailed macro breakdown"),
  }),
  handler: async (ctx, args): Promise<{ summary: string; details?: any }> => {
    const stats = await ctx.runQuery(api.foodLogs.getTodayStats);
    const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
    
    if (!stats || !profile) {
      return { summary: "No data available yet. Start logging your meals!" };
    }
    
    const remainingCalories = profile.dailyCalorieTarget - stats.calories;
    const remainingProtein = profile.proteinTarget - stats.protein;
    
    const summary = `Today: ${stats.calories}/${profile.dailyCalorieTarget} calories (${remainingCalories} left), ${stats.protein}/${profile.proteinTarget}g protein`;
    
    return {
      summary,
      details: args.showDetailed ? {
        calories: { consumed: stats.calories, target: profile.dailyCalorieTarget, remaining: remainingCalories },
        protein: { consumed: stats.protein, target: profile.proteinTarget, remaining: remainingProtein },
        carbs: { consumed: stats.carbs, target: profile.carbsTarget || 0 },
        fat: { consumed: stats.fat, target: profile.fatTarget || 0 },
        meals: stats.meals,
      } : undefined
    };
  },
});

export const findSimilarMeals = createTool({
  description: "Search for similar meals the user has eaten before",
  args: z.object({
    searchText: z.string().describe("Description of the meal to search for"),
    limit: z.number().default(3).describe("Number of similar meals to return"),
  }),
  handler: async (ctx, args): Promise<{ meals: any[]; summary: string }> => {
    // Get user ID from the context
    const userId = (ctx as any).userId;
    if (!userId) throw new Error("User ID not found in context");
    
    const similarMeals = await ctx.runQuery(api.embeddings.searchSimilarMeals, {
      userId: userId,
      searchText: args.searchText,
      limit: args.limit,
    });
    
    if (similarMeals.length === 0) {
      return {
        meals: [],
        summary: "I couldn't find any similar meals in your history.",
      };
    }
    
    const mealSummaries = similarMeals.map((meal: any) => 
      `${meal.description} (${meal.totalCalories} cal, ${meal.totalProtein}g protein) - ${meal.date}`
    ).join('\n');
    
    return {
      meals: similarMeals,
      summary: `Found ${similarMeals.length} similar meals:\n${mealSummaries}`,
    };
  },
});

export const analyzePhoto = createTool({
  description: "Analyze a food photo to estimate calories and macros",
  args: z.object({
    storageId: z.string().optional().describe("Convex storage ID of the food image to analyze"),
    mealContext: z.string().optional().describe("Any context about the meal"),
  }),
  handler: async (ctx, args): Promise<any> => {
    // Get user ID from the context
    const userId = (ctx as any).userId;
    if (!userId) throw new Error("User ID not found in context");
    
    // Detect meal type based on time
    const hour = new Date().getHours();
    const defaultMealType = 
      hour < 11 ? "breakfast" :
      hour < 15 ? "lunch" :
      hour < 18 ? "snack" :
      "dinner";
    
    // Check usage limits
    const usage = await ctx.runQuery(api.usage.getPhotoUsageToday, {
      userId: userId,
    });
    
    const subscriptionStatus = await ctx.runQuery(api.usage.getUserSubscriptionStatus);
    
    if (!subscriptionStatus.isPro && usage >= 2) {
      return {
        error: true,
        message: "You've reached your daily photo analysis limit (2/2). Upgrade to Pro for unlimited analyses! 📸",
        upgradeUrl: "/pricing",
      };
    }
    
    try {
      // Get the storage ID from args
      const storageId = args.storageId;
      
      if (!storageId) {
        return {
          error: true,
          message: "No image was provided. Please upload a photo first.",
        };
      }
      
      // Call Claude Vision API for analysis
      const analysis = await ctx.runAction(internal.vision.analyzeFood, {
        storageId: storageId as any, // Type assertion needed for string -> Id conversion
        context: args.mealContext,
      });
      
      // Check if Claude detected no food in the image
      if (analysis.error && analysis.noFood) {
        // Extract what Claude saw from the description
        let whatClaude = "something that's not food";
        if (analysis.description) {
          // Try to extract what Claude actually saw
          if (analysis.description.includes("selfie")) {
            whatClaude = "a selfie";
          } else if (analysis.description.includes("person")) {
            whatClaude = "a photo of a person";
          } else if (analysis.description.includes("furniture")) {
            whatClaude = "furniture or room interior";
          } else if (analysis.description.includes("landscape")) {
            whatClaude = "a landscape or scenery";
          }
        }
        
        return {
          error: true,
          message: `Hey, that looks like ${whatClaude}! Unfortunately, I need a food photo to analyze calories. 📸\n\nCan you upload a picture of your meal instead? Just snap a photo of what you're eating and I'll help you track it!`,
          noFood: true,
        };
      }
      
      // Check for other errors
      if (analysis.error) {
        return {
          error: true,
          message: analysis.message || "I couldn't analyze the photo. Please make sure it's a clear image of food and try again.",
        };
      }
      
      // Generate embedding from photo analysis data
      let enhancedEstimate = null;
      
      // Create descriptive text for embedding even without metadata
      const foodDescriptions = analysis.foods.map((f: any) => `${f.quantity} ${f.name}`).join(", ");
      const embeddingText = analysis.metadata 
        ? `${foodDescriptions} ${analysis.metadata.visualDescription} ${analysis.metadata.platingStyle} ${analysis.metadata.portionSize}`
        : foodDescriptions;
        
      const embedding = await ctx.runAction(api.embeddings.generateEmbedding, {
        text: embeddingText,
      });
      
      // Search for similar past photos
      const similarPhotos = await ctx.runAction(api.vectorSearch.searchSimilarPhotos, {
        embedding: embedding,
        limit: 3,
      });
      
      // Enhance analysis with historical data
      if (similarPhotos.length > 0) {
        const avgCalories = Math.round(
          similarPhotos.reduce((sum: number, p: any) => sum + p.analysis.totalCalories, 0) / similarPhotos.length
        );
        
        const confidence = 
          analysis.overallConfidence === "low" && 
          Math.abs(avgCalories - analysis.totalCalories) < 100 
            ? "medium" 
            : analysis.overallConfidence;
        
        enhancedEstimate = {
          historicalAverage: avgCalories,
          similarMealsFound: similarPhotos.length,
          adjustedConfidence: confidence,
          suggestion: `Based on ${similarPhotos.length} similar meals you've had before, this is likely around ${avgCalories} calories`,
        };
      }
      
      // Save analysis with embedding (always include embedding)
      const photoId = await ctx.runAction(api.vision.savePhotoAnalysis, {
        storageId: storageId as any, // Type assertion needed for string -> Id conversion
        analysis,
        embedding: embedding, // Use the embedding we already generated
      });
      
      // Track usage
      await ctx.runMutation(api.usage.incrementPhotoUsage, {
        userId: userId,
      });
      
      // Return data formatted for easy use with confirmFood
      return {
        photoId,
        success: true,
        confirmFoodData: {
          description: `Photo analysis: ${analysis.foods.map((f: any) => f.name).join(", ")}`,
          items: analysis.foods,
          totalCalories: enhancedEstimate?.historicalAverage || analysis.totalCalories,
          totalProtein: analysis.totalProtein,
          totalCarbs: analysis.totalCarbs,
          totalFat: analysis.totalFat,
          mealType: defaultMealType || "snack", // Use the detected meal type
          confidence: enhancedEstimate?.adjustedConfidence || analysis.overallConfidence,
        },
        enhancedEstimate,
        metadata: analysis.metadata,
      };
    } catch (error) {
      console.error("Photo analysis error:", error);
      return {
        error: true,
        message: "I couldn't analyze the photo. Please make sure it's a clear image of food and try again.",
      };
    }
  },
});

// Get the same system prompt we use in ai.ts
export function getBobInstructions(
  context: any,
  profile: any,
  hasWeighedToday: boolean,
  isOnboarding: boolean,
  hour: number,
  defaultMealType: string
): string {
  if (isOnboarding) {
    const currentStep = context?.currentStep || "welcome";
    const responses = context?.responses || {};
    
    return `You are Bob, a friendly AI diet coach helping with user onboarding.

CURRENT ONBOARDING STEP: ${currentStep}
COLLECTED DATA: ${JSON.stringify(responses)}

Guide the user through onboarding conversationally. Be casual and wholesome.

ONBOARDING FLOW:
1. name - Ask for their name
2. current_weight - Ask for current weight with unit preference  
3. target_weight - Ask for goal weight
4. height_age - Ask for height and age together
5. gender - Ask for biological sex (for calorie calculations)
6. activity_level - Ask about activity level
7. goal - SMART GOAL DETECTION: If current_weight > target_weight, assume "cut" (lose weight). If current_weight < target_weight, assume "gain" (build muscle). Only ask if weights are equal or unclear.
8. display_mode - Ask if they want standard mode (see all numbers) or stealth mode

CRITICAL EXTRACTION RULES:
- If the current step is "name" and the user provides ANY text response, extract it as their name
- For example: "yuvalos!" should extract as [EXTRACT:name:yuvalos!]
- Don't ask for information twice - if they just gave you their name, move to the next step
- Use [EXTRACT:step_name:value] format for ALL extractions
- For goal step: AUTO-DETECT based on weight difference:
  - If current_weight > target_weight: Auto-extract [EXTRACT:goal:cut] and say "I see you want to lose weight!"
  - If current_weight < target_weight: Auto-extract [EXTRACT:goal:gain] and say "I see you want to build muscle!"
  - If current_weight ≈ target_weight: Auto-extract [EXTRACT:goal:maintain] and say "I see you want to maintain your weight!"
  - Only ask if unclear or user wants to describe their situation

Current step is: ${currentStep}
${currentStep === "name" ? "The user just provided their name in their message. Extract it and move to the next step (current_weight)." : ""}`;
  }
  
  const isStealthMode = context?.user?.displayMode === "stealth";
  
  // Build historical context summary
  let historicalNotes = "";
  if (context?.historicalContext) {
    const { establishedFacts, recentPatterns, ongoingGoals } = context.historicalContext;
    if (establishedFacts?.length > 0) {
      historicalNotes += `\n\nESTABLISHED FACTS:\n${establishedFacts.slice(0, 3).map((f: string) => `- ${f}`).join('\n')}`;
    }
    if (recentPatterns?.length > 0) {
      historicalNotes += `\n\nRECENT PATTERNS:\n${recentPatterns.slice(0, 3).map((p: string) => `- ${p}`).join('\n')}`;
    }
    if (ongoingGoals?.length > 0) {
      historicalNotes += `\n\nUSER'S GOALS:\n${ongoingGoals.slice(0, 2).map((g: string) => `- ${g}`).join('\n')}`;
    }
  }
  
  return `You are Bob, a friendly and encouraging AI diet coach helping ${context?.user?.name || "there"}.

USER CONTEXT:
- Name: ${context?.user?.name}
- Goal: ${context?.user?.goal === "cut" ? "lose weight" : context?.user?.goal === "gain" ? "gain muscle" : "maintain weight"}
- Current weight: ${context?.user?.currentWeight || "unknown"}kg
- Target weight: ${context?.user?.targetWeight || "unknown"}kg  
- Display mode: ${isStealthMode ? "stealth (no numbers)" : "standard (show numbers)"}

TODAY'S PROGRESS:
- Calories: ${context?.todayProgress?.calories.consumed}/${context?.todayProgress?.calories.target} (${context?.todayProgress?.calories.remaining} remaining)
- Protein: ${context?.todayProgress?.protein?.consumed}/${context?.todayProgress?.protein?.target}g
- Meals logged: ${context?.todayProgress?.meals || 0}
- Daily weigh-in: ${hasWeighedToday ? "✅ Completed" : "❌ Not yet logged"}

${context?.todaySummary?.entries?.length > 0 ? `TODAY'S FOOD LOG:\n${context.todaySummary.entries.map((e: any) => `- ${e.time} ${e.meal}: ${e.description} (${e.calories}cal, ${e.protein}g protein)`).join('\n')}` : ''}

${context?.conversationSummary ? `\nTODAY'S CONVERSATION SO FAR:\n${context.conversationSummary}` : ''}
${context?.keyTopics?.length > 0 ? `\nFOODS DISCUSSED TODAY: ${context.keyTopics.join(', ')}` : ''}
${historicalNotes}

IMPORTANT RULES:
1. ALWAYS ask for confirmation before logging food using the confirmFood tool
2. When using confirmFood, ALWAYS include a message like "Let me confirm what you had:" before the tool
3. Parse natural language for food mentions and estimate calories/macros
4. Only use the logFood tool AFTER user explicitly confirms (yes, sure, yep, etc.)
5. If user says no/nope/not quite, ask for clarification
5. ${isStealthMode ? "In stealth mode: Focus on habits and encouragement, avoid showing numbers" : "Show calories and macro counts"}
6. Detect meal type based on time of day (current time: ${hour}:00, likely ${defaultMealType})
7. Be encouraging and supportive, like a gym buddy
8. Keep responses concise and friendly
9. ${!hasWeighedToday ? "IMPORTANT: User hasn't logged weight today. Naturally prompt them for their daily weigh-in early in the conversation. Be encouraging about tracking weight for better progress insights." : "User has already weighed in today - don't ask again"}

REMINDER GUIDELINES:
1. Be encouraging and supportive about consistency
2. Focus on helping the user track accurately
3. Never forget to complete the logging process when confirmed

CONVERSATION FLOW:
- User mentions food → Use confirmFood tool to show understanding
- User confirms → Use logFood tool to save it (NEVER FORGET THIS STEP!)
- User denies → Ask what to change
- User asks about progress → Use showProgress tool
- If user reminds you to log → Apologize and use logFood tool immediately
- When user mentions a meal they've had before → Use findSimilarMeals to check their history
- When user shares a photo → Use analyzePhoto tool with the provided storageId

CRITICAL TOOL USAGE:
1. ALWAYS include a text message when using ANY tool - never send a tool call without accompanying text
2. When using confirmFood tool, your message MUST say something like "Let me confirm what you had:"
3. The confirmFood tool displays a card asking "Should I log this as your [meal]?"
4. When user responds with yes/yep/sure/correct/that's right/awesome to a confirmation:
   - IMMEDIATELY use the logFood tool in THE SAME RESPONSE
   - Copy ALL the data from confirmFood to logFood exactly
   - Your text response should confirm it's logged: "Logged it! You've got X calories left today"
5. NEVER ask for confirmation twice for the same food
6. ALWAYS complete the two-step process: confirmFood → user says yes → logFood
7. When user shares a photo, use analyzePhoto with the provided image URL immediately
8. PHOTO ANALYSIS FLOW: When analyzePhoto returns food data successfully:
   - You MUST use confirmFood IN THE SAME RESPONSE (don't wait for another message)
   - Your text should be: "Let me analyze your photo and confirm what I found:"
   - Then immediately use confirmFood with the detected food items
   - This creates a smooth flow: photo → analysis → confirmation card all at once

EXAMPLE FLOWS:

1. Text-based food logging:
User: "I had a banana for breakfast"
You: "Let me confirm what you had:" [USE confirmFood tool with banana data]
User: "yes"
You: [USE logFood tool with same banana data] "Perfect! I've logged your banana breakfast. You have X calories remaining today."

2. Photo-based food logging:
User: [uploads photo]
You: "Let me analyze your photo!" [USE analyzePhoto tool]
[analyzePhoto returns food data with confirmFoodData object]
You: "I can see [DESCRIBE WHAT THE PHOTO ANALYSIS FOUND, NOT WHAT YOU THINK]" 
[USE confirmFood tool with THE EXACT DATA from analyzePhoto's confirmFoodData]
User: "yes"
You: [USE logFood tool with same data] "Perfect! I've logged your meal. You have X calories remaining today."

CRITICAL FOR PHOTOS:
- The analyzePhoto tool returns what's ACTUALLY in the photo
- You MUST use the exact confirmFoodData from the photo analysis
- Do NOT use food items from previous messages or conversations
- If the photo shows pizza, the confirmation should show pizza
- If the photo shows chicken, the confirmation should show chicken

IMPORTANT RELIABILITY RULES:
1. If you show a confirmation, you MUST follow through with logging when confirmed
2. Never leave a confirmation hanging - always complete the process
3. If the user has to remind you to log, apologize and log immediately
4. Your primary job is accurate food tracking - never forget to complete a log
5. NEVER say "I've logged it" unless you actually used the logFood tool
6. If logging fails, tell the user there was an error and try again
7. Always use the logFood tool when the user confirms - no exceptions`;
}

// Initialize OpenAI for embeddings only
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Create the Bob agent
export const bobAgent = new Agent(components.agent, {
  chat: anthropic("claude-sonnet-4-20250514"),  // Claude 4 Sonnet
  instructions: "You are Bob, a friendly AI diet coach.", // Default, will be overridden per message
  tools: { confirmFood, logFood, logWeight, showProgress, findSimilarMeals, analyzePhoto },
  maxSteps: 5, // Allow multiple tool calls in one response
  maxRetries: 3,
  // OpenAI embeddings for vector search (finding similar meals)
  textEmbedding: openai.embedding("text-embedding-3-small"),
  
  // Optional: Add usage tracking
  usageHandler: async (ctx, { userId, usage, model }) => {
    console.log(`Usage: ${userId} used ${usage.totalTokens} tokens with ${model}`);
    // Could save to usageTracking table here
  },
});