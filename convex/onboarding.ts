import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Onboarding steps
const ONBOARDING_STEPS = [
  "welcome",
  "name",
  "current_weight",
  "target_weight", 
  "height_age",
  "gender",
  "activity_level",
  "goal",
  "display_mode",
  "complete"
];

// Get onboarding status
export const getOnboardingStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // Check if profile exists and is complete
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    // If profile has all required data but onboarding not marked complete, treat as complete
    if (profile && profile.name && profile.currentWeight && profile.dailyCalorieTarget) {
      return {
        completed: true,
        currentStep: "complete",
        profile: profile
      };
    }
    
    if (profile?.onboardingCompleted) {
      return {
        completed: true,
        currentStep: "complete",
        profile: profile
      };
    }
    
    // Get onboarding progress
    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    return {
      completed: false,
      currentStep: progress?.currentStep || "welcome",
      responses: progress?.responses || {},
      startedAt: progress?.startedAt
    };
  },
});

// Save onboarding progress
export const saveOnboardingProgress = mutation({
  args: {
    step: v.string(),
    response: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    // Get or create progress record
    let progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
    
    if (!progress) {
      // Create new progress record
      await ctx.db.insert("onboardingProgress", {
        userId,
        currentStep: args.step,
        responses: { [args.step]: args.response },
        completed: false,
        startedAt: Date.now(),
      });
    } else {
      // Update existing progress
      const responses = { ...progress.responses, [args.step]: args.response };
      
      // Skip auxiliary steps like weight_unit, height_unit, etc.
      const auxiliarySteps = ["weight_unit", "height_unit", "height", "age"];
      if (auxiliarySteps.includes(args.step)) {
        // Just save the response without changing the current step
        await ctx.db.patch(progress._id, {
          responses,
        });
        return;
      }
      
      // Determine next step
      const currentIndex = ONBOARDING_STEPS.indexOf(args.step);
      const nextStep = ONBOARDING_STEPS[currentIndex + 1] || "complete";
      
      // Special handling for various cases
      let actualNextStep = nextStep;
      
      // If we just saved height_age, next is gender
      if (args.step === "height_age") {
        actualNextStep = "gender";
      }
      // If goal is already set (auto-detected), skip the goal step
      else if (nextStep === "goal" && responses.goal) {
        actualNextStep = "display_mode";
      }
      // If we're at activity_level, next should be display_mode (skip goal if already set)
      else if (args.step === "activity_level") {
        actualNextStep = responses.goal ? "display_mode" : "goal";
      }
      
      await ctx.db.patch(progress._id, {
        currentStep: actualNextStep,
        responses,
        completed: actualNextStep === "complete",
        completedAt: actualNextStep === "complete" ? Date.now() : undefined,
      });
    }
    
    // If display_mode is saved, create user profile
    if (args.step === "display_mode") {
      console.log("Display mode saved, creating profile...");
      await createProfileFromOnboarding(ctx, userId);
      
      // Mark onboarding as complete in progress
      const updatedProgress = await ctx.db
        .query("onboardingProgress")
        .withIndex("by_user", q => q.eq("userId", userId))
        .first();
      
      if (updatedProgress) {
        await ctx.db.patch(updatedProgress._id, {
          currentStep: "complete",
          completed: true,
          completedAt: Date.now(),
        });
      }
      
      // Clear cached context after onboarding completes
      await ctx.runMutation(api.sessionCache.clearSessionCache, {});
      console.log("Profile created and onboarding marked complete");
    }
  },
});

// Complete onboarding and create profile
async function createProfileFromOnboarding(ctx: any, userId: string) {
  const progress = await ctx.db
    .query("onboardingProgress")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  
  if (!progress?.responses) return;
  
  const r = progress.responses;
  
  // Calculate BMR and targets
  const weight = parseFloat(r.current_weight?.weight || 70); // Default 70kg
  const height = parseFloat(r.height_age?.height || 170); // Default 170cm
  const age = parseInt(r.height_age?.age || 30); // Default 30 years
  const gender = r.gender || "other";
  const activityLevel = r.activity_level || "moderate";
  const goal = r.goal || "maintain";
  
  // Log if we're using defaults
  if (!r.current_weight?.weight || !r.height_age?.height || !r.height_age?.age) {
    console.warn(`Using default values for user ${userId}: weight=${weight}, height=${height}, age=${age}`);
  }
  
  // Calculate BMR (Mifflin-St Jeor)
  // For "other" gender, use average of male and female calculations
  let bmr;
  if (gender === "male") {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else if (gender === "female") {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  } else {
    // Average of male and female for "other"
    const maleBmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    const femaleBmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    bmr = (maleBmr + femaleBmr) / 2;
  }
  
  // Calculate TDEE
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  const tdee = bmr * (activityMultipliers[activityLevel as keyof typeof activityMultipliers] || 1.55);
  
  // Calculate daily targets
  let dailyCalories = tdee;
  if (goal === "cut") dailyCalories = tdee - 500;
  else if (goal === "gain") dailyCalories = tdee + 300;
  
  const proteinTarget = Math.round(weight * 2.2 * 0.9); // 0.9g per lb
  const fatTarget = Math.round(dailyCalories * 0.25 / 9); // 25% from fat
  const carbsTarget = Math.round((dailyCalories - (proteinTarget * 4) - (fatTarget * 9)) / 4);
  
  // Update the user's name in the users table
  if (r.name) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", userId))
      .first();
    
    if (user) {
      await ctx.db.patch(user._id, {
        name: r.name,
      });
      console.log(`Updated user ${userId} name in users table to: "${r.name}"`);
    }
  }
  
  // Create user profile
  console.log(`Creating profile for user ${userId} with name: "${r.name}" (raw responses: ${JSON.stringify(r)})`);
  await ctx.db.insert("userProfiles", {
    userId,
    name: r.name || "Friend",
    currentWeight: weight,
    targetWeight: parseFloat(r.target_weight?.weight || weight),
    height: height,
    age: age,
    gender: gender,
    activityLevel: activityLevel,
    goal: goal,
    dailyCalorieTarget: Math.round(dailyCalories),
    proteinTarget: proteinTarget,
    carbsTarget: carbsTarget,
    fatTarget: fatTarget,
    preferredUnits: r.current_weight?.unit === "lbs" ? "imperial" : "metric",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    onboardingCompleted: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  
  // Create user preferences
  await ctx.db.insert("userPreferences", {
    userId,
    displayMode: r.display_mode || "standard",
    showCalories: r.display_mode !== "stealth",
    showProtein: true,
    showCarbs: r.display_mode !== "stealth",
    showFats: r.display_mode !== "stealth",
    language: "en",
    darkMode: false,
    cuteMode: false,
    reminderSettings: {
      weighInReminder: true,
      mealReminders: false,
      reminderTimes: {
        weighIn: "08:00",
      }
    },
    updatedAt: Date.now(),
  });
  
  // Log initial weight
  await ctx.db.insert("weightLogs", {
    userId,
    weight: weight,
    unit: r.current_weight?.unit === "lbs" ? "lbs" : "kg",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: "Starting weight",
    createdAt: Date.now(),
  });
}

// Reset onboarding (for testing)
export const resetOnboarding = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    // Delete onboarding progress
    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (progress) await ctx.db.delete(progress._id);
    
    // Mark profile as not onboarded (but keep the data)
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, {
        onboardingCompleted: false,
      });
    }
    
    // Clear chat history for fresh start
    const chats = await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    for (const chat of chats) {
      await ctx.db.delete(chat._id);
    }
    
    // Clear active sessions
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user_active", (q: any) => q.eq("userId", userId).eq("isActive", true))
      .collect();
    for (const session of sessions) {
      await ctx.db.patch(session._id, { isActive: false });
    }
    
    // Clear cache
    await ctx.runMutation(api.sessionCache.clearSessionCache, {});
    
    return { reset: true, message: "Onboarding reset - your data is preserved" };
  },
});

// Soft reset - just restart onboarding without deleting data
export const softResetOnboarding = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    // Just delete onboarding progress
    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (progress) await ctx.db.delete(progress._id);
    
    // Mark profile as not onboarded
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, {
        onboardingCompleted: false,
      });
    }
    
    return { reset: true, message: "Onboarding restarted" };
  },
});