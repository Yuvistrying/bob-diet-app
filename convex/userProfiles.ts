import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Get user profile
export const getUserProfile = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = args.userId || identity.subject;

    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
  },
});

// Create or update user profile
export const upsertUserProfile = mutation({
  args: {
    name: v.string(),
    currentWeight: v.number(),
    targetWeight: v.number(),
    height: v.number(),
    age: v.number(),
    gender: v.string(),
    activityLevel: v.string(),
    goal: v.string(),
    preferredUnits: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;
    const now = Date.now();

    // Calculate daily targets based on user data
    const bmr = calculateBMR({
      weight: args.currentWeight,
      height: args.height,
      age: args.age,
      gender: args.gender,
    });

    const tdee = calculateTDEE(bmr, args.activityLevel);
    const { calories, protein } = calculateTargets(
      tdee,
      args.goal,
      args.currentWeight,
    );

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    const profileData = {
      userId,
      ...args,
      dailyCalorieTarget: calories,
      proteinTarget: protein,
      carbsTarget: Math.round((calories * 0.4) / 4), // 40% from carbs
      fatTarget: Math.round((calories * 0.3) / 9), // 30% from fat
      onboardingCompleted: true,
      updatedAt: now,
    };

    let profileId;
    if (existing) {
      await ctx.db.patch(existing._id, profileData);
      profileId = existing._id;
    } else {
      profileId = await ctx.db.insert("userProfiles", {
        ...profileData,
        createdAt: now,
      });
    }

    // Clear cached context since profile data has changed
    // Clear cached context when profile is updated
    await ctx.runMutation(api.sessionCache.clearSessionCacheKey, {
      cacheKey: "chat_context",
    });

    return profileId;
  },
});

// Helper functions for calculations
function calculateBMR({
  weight,
  height,
  age,
  gender,
}: {
  weight: number;
  height: number;
  age: number;
  gender: string;
}) {
  // Mifflin-St Jeor Equation
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === "male" ? base + 5 : base - 161;
}

function calculateTDEE(bmr: number, activityLevel: string) {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  return bmr * (multipliers[activityLevel as keyof typeof multipliers] || 1.2);
}

function calculateTargets(tdee: number, goal: string, weight: number) {
  let calories = tdee;

  if (goal === "cut") {
    calories = tdee - 500; // 500 calorie deficit for ~1lb/week loss
  } else if (goal === "gain") {
    calories = tdee + 300; // 300 calorie surplus for lean gains
  }

  // Protein: 0.8-1g per lb of body weight
  const proteinGrams = Math.round(weight * 2.2 * 0.9); // kg to lbs * 0.9

  return {
    calories: Math.round(calories),
    protein: proteinGrams,
  };
}

// Update specific profile fields
export const updateProfileField = mutation({
  args: {
    field: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      [args.field]: args.value,
      updatedAt: Date.now(),
    });

    // If the name field is being updated, also update it in the users table
    if (args.field === "name" && typeof args.value === "string") {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
        .first();

      if (user) {
        await ctx.db.patch(user._id, {
          name: args.value,
        });
      }
    }

    // Clear cached context since profile data has changed
    // Clear cached context when profile is created/updated
    await ctx.runMutation(api.sessionCache.clearSessionCacheKey, {
      cacheKey: "chat_context",
    });
  },
});
