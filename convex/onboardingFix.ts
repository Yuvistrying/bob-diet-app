import { mutation } from "./_generated/server";

// Emergency fix to complete stuck onboarding
export const forceCompleteOnboarding = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    // Get onboarding progress
    const progress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (!progress) {
      return { error: "No onboarding progress found" };
    }

    // Check if we have enough data to create profile
    const r = progress.responses;
    if (!r.name || !r.current_weight || !r.display_mode) {
      return { error: "Missing required onboarding data" };
    }

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (!existingProfile) {
      // Create profile with available data
      const weight = parseFloat(r.current_weight?.weight || 70);
      const height = parseFloat(r.height || r.height_age?.height || 170);
      const age = parseInt(r.age || r.height_age?.age || 30);
      const gender = r.gender || "other";
      const activityLevel = r.activity_level || "moderate";
      const goal = r.goal || "maintain";

      // Calculate BMR and targets
      let bmr;
      if (gender === "male") {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
      } else if (gender === "female") {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
      } else {
        const maleBmr = 10 * weight + 6.25 * height - 5 * age + 5;
        const femaleBmr = 10 * weight + 6.25 * height - 5 * age - 161;
        bmr = (maleBmr + femaleBmr) / 2;
      }

      const activityMultipliers = {
        sedentary: 1.2,
        light: 1.375,
        "lightly active": 1.375, // Handle both formats
        moderate: 1.55,
        "moderately active": 1.55, // Handle both formats
        active: 1.725,
        "very active": 1.725, // Handle both formats
      };
      const tdee =
        bmr *
        (activityMultipliers[
          activityLevel as keyof typeof activityMultipliers
        ] || 1.55);

      let dailyCalories = tdee;
      if (goal === "cut") dailyCalories = tdee - 500;
      else if (goal === "gain") dailyCalories = tdee + 300;

      const proteinTarget = Math.round(weight * 1.6); // 1.6g per kg
      const fatTarget = Math.round((dailyCalories * 0.25) / 9);
      const carbsTarget = Math.round(
        (dailyCalories - proteinTarget * 4 - fatTarget * 9) / 4,
      );

      // Create profile
      await ctx.db.insert("userProfiles", {
        userId,
        name: r.name,
        currentWeight: weight,
        targetWeight: parseFloat(r.target_weight?.weight || weight),
        height,
        age,
        gender,
        activityLevel,
        goal,
        dailyCalorieTarget: Math.round(dailyCalories),
        proteinTarget,
        carbsTarget,
        fatTarget,
        preferredUnits:
          r.current_weight?.unit === "lbs" ? "imperial" : "metric",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboardingCompleted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create preferences
      const existingPrefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .first();

      if (!existingPrefs) {
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
    } else {
      // Just mark existing profile as onboarded
      await ctx.db.patch(existingProfile._id, {
        onboardingCompleted: true,
      });
    }

    // Mark onboarding progress as complete
    await ctx.db.patch(progress._id, {
      currentStep: "complete",
      completed: true,
      completedAt: Date.now(),
    });

    // Update user name in users table
    if (r.name) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", userId))
        .first();

      if (user) {
        await ctx.db.patch(user._id, {
          name: r.name,
        });
      }
    }

    return { success: true, message: "Onboarding force completed" };
  },
});
