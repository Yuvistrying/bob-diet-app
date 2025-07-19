import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Tool for Bob to collect user's name
export const collectUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    // Update or create profile with name
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        name: args.name,
        updatedAt: Date.now(),
      });
    } else {
      // Create minimal profile with just name
      await ctx.db.insert("userProfiles", {
        userId,
        name: args.name,
        // Set defaults for required fields
        currentWeight: 0,
        targetWeight: 0,
        height: 0,
        age: 30,
        gender: "other",
        activityLevel: "moderate",
        goal: "maintain",
        dailyCalorieTarget: 2000,
        proteinTarget: 150,
        preferredUnits: "metric",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboardingCompleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Also update users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { name: args.name });
    }

    return { success: true };
  },
});

// Tool for Bob to collect birth date
export const collectBirthDate = mutation({
  args: {
    birthDate: v.string(), // YYYY-MM-DD format
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    // Calculate age from birth date
    const today = new Date();
    const birth = new Date(args.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    await ctx.db.patch(profile._id, {
      birthDate: args.birthDate,
      age: age,
      updatedAt: Date.now(),
    });

    return { success: true, age };
  },
});

// Tool for Bob to collect current weight
export const collectCurrentWeight = mutation({
  args: {
    weight: v.number(),
    unit: v.string(), // "kg" or "lbs"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    // Convert to kg if needed for storage
    const weightInKg =
      args.unit === "lbs" ? args.weight * 0.453592 : args.weight;

    await ctx.db.patch(profile._id, {
      currentWeight: weightInKg,
      preferredUnits: args.unit === "lbs" ? "imperial" : "metric",
      updatedAt: Date.now(),
    });

    // Also log this as initial weight
    await ctx.db.insert("weightLogs", {
      userId: identity.subject,
      weight: args.weight,
      unit: args.unit,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toTimeString().slice(0, 5),
      notes: "Initial weight",
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Tool for Bob to update user's goal
export const updateUserGoal = mutation({
  args: {
    goal: v.string(), // "cut", "gain", "maintain"
    targetWeight: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    // Save to goal history
    await ctx.db.insert("goalHistory", {
      userId: identity.subject,
      previousGoal: profile.goal,
      newGoal: args.goal,
      previousTargetWeight: profile.targetWeight,
      newTargetWeight: args.targetWeight || profile.targetWeight,
      currentWeight: profile.currentWeight,
      reason: args.reason,
      triggeredBy: "user_request",
      changedAt: Date.now(),
    });

    // Update profile
    const updates: any = {
      goal: args.goal,
      updatedAt: Date.now(),
    };

    if (args.targetWeight !== undefined) {
      updates.targetWeight = args.targetWeight;
    }

    // Recalculate calorie targets based on new goal
    const bmr = calculateBMR(profile);
    const tdee = bmr * getActivityMultiplier(profile.activityLevel);

    let dailyCalories = tdee;
    if (args.goal === "cut") dailyCalories = tdee - 500;
    else if (args.goal === "gain") dailyCalories = tdee + 300;

    updates.dailyCalorieTarget = Math.round(dailyCalories);

    await ctx.db.patch(profile._id, updates);

    return { success: true, newCalorieTarget: updates.dailyCalorieTarget };
  },
});

// Tool for Bob to collect height
export const collectHeight = mutation({
  args: {
    height: v.number(), // in cm
    unit: v.string(), // "cm" or "ft"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    // Convert to cm if needed
    const heightInCm = args.unit === "ft" ? args.height * 30.48 : args.height;

    await ctx.db.patch(profile._id, {
      height: heightInCm,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Tool for Bob to collect gender
export const collectGender = mutation({
  args: {
    gender: v.string(), // "male", "female", "other"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      gender: args.gender,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Tool for Bob to collect activity level
export const collectActivityLevel = mutation({
  args: {
    activityLevel: v.string(), // "sedentary", "light", "moderate", "active"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      activityLevel: args.activityLevel,
      updatedAt: Date.now(),
    });

    // Recalculate targets with new activity level
    await recalculateTargets(ctx, profile._id);

    return { success: true };
  },
});

// Tool for Bob to mark setup as complete
export const markSetupComplete = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!profile) throw new Error("Profile not found");

    // Check if we have minimum required data
    if (!profile.name || !profile.currentWeight || !profile.height) {
      throw new Error("Missing required profile data");
    }

    // Calculate final targets if needed
    await recalculateTargets(ctx, profile._id);

    // Mark as complete
    await ctx.db.patch(profile._id, {
      onboardingCompleted: true,
      updatedAt: Date.now(),
    });

    // Create default preferences if they don't exist
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();

    if (!prefs) {
      await ctx.db.insert("userPreferences", {
        userId: identity.subject,
        displayMode: "standard",
        showCalories: true,
        showProtein: true,
        showCarbs: true,
        showFats: true,
        language: "en",
        darkMode: false,
        cuteMode: false,
        reminderSettings: {
          weighInReminder: true,
          mealReminders: false,
          reminderTimes: {
            weighIn: "08:00",
          },
        },
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Helper functions
function calculateBMR(profile: any): number {
  const { currentWeight, height, age, gender } = profile;

  if (gender === "male") {
    return 10 * currentWeight + 6.25 * height - 5 * age + 5;
  } else if (gender === "female") {
    return 10 * currentWeight + 6.25 * height - 5 * age - 161;
  } else {
    // Average of male and female for "other"
    const maleBmr = 10 * currentWeight + 6.25 * height - 5 * age + 5;
    const femaleBmr = 10 * currentWeight + 6.25 * height - 5 * age - 161;
    return (maleBmr + femaleBmr) / 2;
  }
}

function getActivityMultiplier(level: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    "lightly active": 1.375, // Handle both formats
    moderate: 1.55,
    "moderately active": 1.55, // Handle both formats
    active: 1.725,
    "very active": 1.725, // Handle both formats
  };
  return multipliers[level] || 1.55;
}

async function recalculateTargets(ctx: any, profileId: string) {
  const profile = await ctx.db.get(profileId);
  if (!profile) return;

  const bmr = calculateBMR(profile);
  const tdee = bmr * getActivityMultiplier(profile.activityLevel);

  let dailyCalories = tdee;
  if (profile.goal === "cut") dailyCalories = tdee - 500;
  else if (profile.goal === "gain") dailyCalories = tdee + 300;

  const proteinTarget = Math.round(profile.currentWeight * 1.6); // 1.6g per kg
  const fatTarget = Math.round((dailyCalories * 0.25) / 9);
  const carbsTarget = Math.round(
    (dailyCalories - proteinTarget * 4 - fatTarget * 9) / 4,
  );

  await ctx.db.patch(profileId, {
    dailyCalorieTarget: Math.round(dailyCalories),
    proteinTarget,
    carbsTarget,
    fatTarget,
    updatedAt: Date.now(),
  });
}
