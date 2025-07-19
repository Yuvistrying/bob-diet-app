import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const findUserByToken = query({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    // Get the user's identity from the auth context
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    // Check if we've already stored this identity before
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (user !== null) {
      return user;
    }

    return null;
  },
});

export const upsertUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    // Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (existingUser) {
      // Update if needed
      if (
        existingUser.name !== identity.name ||
        existingUser.email !== identity.email
      ) {
        await ctx.db.patch(existingUser._id, {
          name: identity.name,
          email: identity.email,
        });
      }
      return existingUser;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.subject,
    });

    // Create a basic profile for new users (onboarding not completed)
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!existingProfile) {
      await ctx.db.insert("userProfiles", {
        userId: identity.subject,
        name: identity.name || "Friend",
        // Set placeholder values - will be updated during onboarding
        currentWeight: 0,
        targetWeight: 0,
        height: 0,
        age: 25,
        gender: "other",
        activityLevel: "moderate",
        goal: "maintain",
        dailyCalorieTarget: 2000,
        proteinTarget: 150,
        carbsTarget: 250,
        fatTarget: 65,
        preferredUnits: "metric",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboardingCompleted: false, // Key flag for onboarding
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return await ctx.db.get(userId);
  },
});

// Update user's name from onboarding
export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Update the name
    await ctx.db.patch(user._id, {
      name: args.name,
    });

    return user;
  },
});
