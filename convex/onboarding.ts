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
  "display_mode",
  "dietary_preferences", // New step for restrictions/preferences
  "complete",
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

    // Check if profile has all required data (not just default values)
    if (
      profile &&
      profile.name &&
      profile.currentWeight &&
      profile.targetWeight &&
      profile.height &&
      profile.age &&
      profile.gender &&
      profile.activityLevel &&
      profile.goal &&
      profile.dailyCalorieTarget
    ) {
      return {
        completed: true,
        currentStep: "complete",
        profile: profile,
      };
    }

    if (profile?.onboardingCompleted) {
      return {
        completed: true,
        currentStep: "complete",
        profile: profile,
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
      startedAt: progress?.startedAt,
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
      .withIndex("by_user", (q) => q.eq("userId", userId))
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

      // Auto-determine goal when target weight is saved
      if (
        args.step === "target_weight" &&
        responses.current_weight &&
        args.response
      ) {
        const currentWeight = parseFloat(
          responses.current_weight.weight || responses.current_weight,
        );
        const targetWeight = parseFloat(args.response.weight || args.response);

        // Determine goal based on weight difference
        let inferredGoal = "maintain";
        const weightDiff = targetWeight - currentWeight;

        if (weightDiff < -2) {
          // More than 2kg/lbs loss
          inferredGoal = "cut";
        } else if (weightDiff > 2) {
          // More than 2kg/lbs gain
          inferredGoal = "gain";
        }

        // Save the inferred goal
        responses.goal = inferredGoal;
        responses.goal_inferred = true;
      }

      await ctx.db.patch(progress._id, {
        currentStep: actualNextStep,
        responses,
        completed: actualNextStep === "complete",
        completedAt: actualNextStep === "complete" ? Date.now() : undefined,
      });
    }

    // If dietary_preferences is saved, we're done with onboarding
    if (args.step === "dietary_preferences") {
      console.log("Dietary preferences saved, creating profile...");

      // Save dietary preferences response
      const latestProgress = await ctx.db
        .query("onboardingProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (latestProgress) {
        const updatedResponses = { ...latestProgress.responses };
        if (args.response !== "skip_preferences") {
          // Parse JSON string from the UI component
          try {
            const parsedPrefs =
              typeof args.response === "string"
                ? JSON.parse(args.response)
                : args.response;
            updatedResponses.dietary_preferences = parsedPrefs;
          } catch (e) {
            // If parsing fails, assume it's the old format
            updatedResponses.dietary_preferences = args.response;
          }
        }

        await ctx.db.patch(latestProgress._id, {
          responses: updatedResponses,
        });
      }

      await createProfileFromOnboarding(ctx, userId);

      // Mark onboarding as complete in progress
      const updatedProgress = await ctx.db
        .query("onboardingProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (updatedProgress) {
        await ctx.db.patch(updatedProgress._id, {
          currentStep: "complete",
          completed: true,
          completedAt: Date.now(),
        });
      }

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

  // Check if profile already exists (shouldn't normally)
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (existingProfile) {
    console.log(`Profile already exists for user ${userId}, updating it`);
  }

  // Calculate BMR and targets
  const weight = parseFloat(r.current_weight?.weight || 70);
  const height = parseFloat(r.height_age?.height || 170);
  const age = parseInt(r.height_age?.age || 30);
  const gender = r.gender || "other";
  const activityLevel = r.activity_level || "moderate";
  const goal = r.goal || "maintain";

  console.log("Onboarding calculation inputs:", {
    weight,
    height,
    age,
    gender,
    activityLevel,
    goal,
  });

  // Calculate BMR (Mifflin-St Jeor)
  let bmr;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === "female") {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // Average of male and female for "other"
    const maleBmr = 10 * weight + 6.25 * height - 5 * age + 5;
    const femaleBmr = 10 * weight + 6.25 * height - 5 * age - 161;
    bmr = (maleBmr + femaleBmr) / 2;
  }

  console.log("BMR calculated:", bmr);

  // Calculate TDEE
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    "lightly active": 1.375, // Handle both formats
    moderate: 1.55,
    "moderately active": 1.55, // Handle both formats
    active: 1.725,
    "very active": 1.725, // Handle both formats
  };
  const multiplier =
    activityMultipliers[activityLevel as keyof typeof activityMultipliers] ||
    1.55;
  const tdee = bmr * multiplier;

  console.log("TDEE calculation:", {
    multiplier,
    tdee,
  });

  // Calculate daily targets
  let dailyCalories = tdee;
  if (goal === "cut") dailyCalories = tdee - 500;
  else if (goal === "gain") dailyCalories = tdee + 300;

  console.log("Final daily calories:", Math.round(dailyCalories));

  const proteinTarget = Math.round(weight * 1.6); // 1.6g per kg (good for active individuals)
  const fatTarget = Math.round((dailyCalories * 0.25) / 9); // 25% from fat
  const carbsTarget = Math.round(
    (dailyCalories - proteinTarget * 4 - fatTarget * 9) / 4,
  );

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

  // Create or update the profile
  if (existingProfile) {
    await ctx.db.patch(existingProfile._id, {
      name: r.name || existingProfile.name,
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
      onboardingCompleted: true,
      updatedAt: Date.now(),
    });
  } else {
    // Create new profile
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
  }

  // Create user preferences if they don't exist
  const existingPreferences = await ctx.db
    .query("userPreferences")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!existingPreferences) {
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
        },
      },
      updatedAt: Date.now(),
    });
  }

  // Log initial weight
  await ctx.db.insert("weightLogs", {
    userId,
    weight: weight,
    unit: r.current_weight?.unit === "lbs" ? "lbs" : "kg",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: "Starting weight",
    createdAt: Date.now(),
  });

  // Handle dietary preferences if provided
  if (r.dietary_preferences && r.dietary_preferences !== "skip_preferences") {
    // Remove any UI-specific fields from the dietary preferences
    const cleanedPrefs = { ...r.dietary_preferences };
    delete cleanedPrefs._isOnboardingData;
    delete cleanedPrefs._displayMessage;

    const {
      restrictions = [],
      customNotes,
      intermittentFasting,
    } = cleanedPrefs;

    // Create dietary preferences directly
    const existingDietaryPrefs = await ctx.db
      .query("dietaryPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (existingDietaryPrefs) {
      await ctx.db.patch(existingDietaryPrefs._id, {
        restrictions,
        customNotes,
        intermittentFasting,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dietaryPreferences", {
        userId,
        restrictions,
        customNotes,
        intermittentFasting,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
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
      .withIndex("by_user_active", (q: any) =>
        q.eq("userId", userId).eq("isActive", true),
      )
      .collect();
    for (const session of sessions) {
      await ctx.db.patch(session._id, { isActive: false });
    }

    // No cache to clear - removed caching system

    return {
      reset: true,
      message: "Onboarding reset - your data is preserved",
    };
  },
});

// Update current onboarding step
export const updateOnboardingStep = mutation({
  args: {
    step: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    // Get or create progress record
    let progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!progress) {
      // Create new progress record
      await ctx.db.insert("onboardingProgress", {
        userId,
        currentStep: args.step,
        responses: {},
        completed: false,
        startedAt: Date.now(),
      });
    } else {
      // Update existing progress
      await ctx.db.patch(progress._id, {
        currentStep: args.step,
      });
    }

    return { success: true };
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
