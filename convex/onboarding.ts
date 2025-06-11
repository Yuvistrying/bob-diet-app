import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
      .unique();
    
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
      .unique();
    
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
      .unique();
    
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
      
      // Determine next step
      const currentIndex = ONBOARDING_STEPS.indexOf(args.step);
      const nextStep = ONBOARDING_STEPS[currentIndex + 1] || "complete";
      
      await ctx.db.patch(progress._id, {
        currentStep: nextStep,
        responses,
        completed: nextStep === "complete",
        completedAt: nextStep === "complete" ? Date.now() : undefined,
      });
    }
    
    // If all steps complete, create user profile
    if (args.step === "display_mode") {
      await createProfileFromOnboarding(ctx, userId);
    }
  },
});

// Complete onboarding and create profile
async function createProfileFromOnboarding(ctx: any, userId: string) {
  const progress = await ctx.db
    .query("onboardingProgress")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  
  if (!progress?.responses) return;
  
  const r = progress.responses;
  
  // Calculate BMR and targets
  const weight = parseFloat(r.current_weight?.weight || 0);
  const height = parseFloat(r.height_age?.height || 0);
  const age = parseInt(r.height_age?.age || 0);
  const gender = r.gender || "other";
  const activityLevel = r.activity_level || "moderate";
  const goal = r.goal || "maintain";
  
  // Calculate BMR (Mifflin-St Jeor)
  const bmr = gender === "male" 
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;
  
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
  
  // Create user profile
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
    
    // Delete profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (profile) await ctx.db.delete(profile._id);
    
    // Delete preferences
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (prefs) await ctx.db.delete(prefs._id);
    
    // Delete onboarding progress
    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .unique();
    if (progress) await ctx.db.delete(progress._id);
    
    return { reset: true };
  },
});