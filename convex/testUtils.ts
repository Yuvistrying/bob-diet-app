import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Helper function to completely clean up a test user from Convex
// Note: You still need to delete from Clerk manually or via their API
export const cleanupTestUser = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    console.log(`Starting cleanup for test user: ${email}`);

    // For now, we need to find user by name since email isn't stored
    // In production, you'd want to add email to userProfiles schema
    const profiles = await ctx.db.query("userProfiles").collect();

    // Try to find by name (not ideal, but works for testing)
    const userProfile = profiles.find(
      (p) => p.name.toLowerCase() === email.split("@")[0].toLowerCase(),
    );
    if (!userProfile) {
      console.log(
        "No user profile found. Try using the username part of the email.",
      );
      return {
        success: false,
        message:
          "No user found. Try using just the username part of the email (before @)",
        clerkNote: "Remember to also delete this user from Clerk Dashboard!",
      };
    }

    const userId = userProfile.userId;
    console.log(`Found user with ID: ${userId}`);

    // Delete from all tables
    const deletions = {
      userProfiles: 0,
      userPreferences: 0,
      onboardingProgress: 0,
      chatHistory: 0,
      foodLogs: 0,
      weightLogs: 0,
      usageTracking: 0,
    };

    // Delete user profile
    await ctx.db.delete(userProfile._id);
    deletions.userProfiles = 1;

    // Delete user preferences
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const pref of preferences) {
      await ctx.db.delete(pref._id);
      deletions.userPreferences++;
    }

    // Delete onboarding progress
    const onboarding = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const progress of onboarding) {
      await ctx.db.delete(progress._id);
      deletions.onboardingProgress++;
    }

    // Delete chat history
    const chats = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .collect();
    for (const chat of chats) {
      await ctx.db.delete(chat._id);
      deletions.chatHistory++;
    }

    // Delete food logs
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const log of foodLogs) {
      await ctx.db.delete(log._id);
      deletions.foodLogs++;
    }

    // Delete weight logs
    const weightLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const log of weightLogs) {
      await ctx.db.delete(log._id);
      deletions.weightLogs++;
    }

    // Photos table doesn't exist in schema, removing this section

    // Delete usage tracking
    const usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const track of usage) {
      await ctx.db.delete(track._id);
      deletions.usageTracking++;
    }

    console.log("Cleanup complete:", deletions);

    return {
      success: true,
      message: `Deleted user ${email} from Convex`,
      deletions,
      clerkNote:
        "⚠️ IMPORTANT: You must also delete this user from the Clerk Dashboard at https://dashboard.clerk.com/",
    };
  },
});

// Get all test users (for debugging)
export const listTestUsers = mutation({
  handler: async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").collect();

    return profiles.map((p) => ({
      userId: p.userId,
      name: p.name,
      createdAt: new Date(p.createdAt).toISOString(),
    }));
  },
});
