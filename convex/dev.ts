import { mutation } from "./_generated/server";

// DEV ONLY: Reset user's onboarding state
export const resetOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    console.log("[DEV] Looking for user with tokenIdentifier:", identity.tokenIdentifier);
    
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    // If user doesn't exist, create them
    if (!user) {
      console.log("[DEV] User not found, creating new user with tokenIdentifier:", identity.tokenIdentifier);
      const newUserId = await ctx.db.insert("users", {
        tokenIdentifier: identity.tokenIdentifier,
        name: identity.name,
        email: identity.email,
      });
      
      user = await ctx.db.get(newUserId);
      if (!user) throw new Error("Failed to create user");
    }

    // Extract the actual userId from the tokenIdentifier
    // Format is "https://....|user_xxxxx" and we need "user_xxxxx"
    const userId = identity.tokenIdentifier.split('|').pop() || user._id;
    console.log("[DEV] Resetting onboarding for user:", userId);
    console.log("[DEV] Token identifier:", identity.tokenIdentifier);
    console.log("[DEV] Extracted userId:", userId);

    // Delete the user's profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      console.log("[DEV] Deleting profile:", profile._id);
      await ctx.db.delete(profile._id);
    }

    // Delete ALL chat history for clean onboarding
    const allMessages = await ctx.db
      .query("chatHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    console.log(`[DEV] Deleting ${allMessages.length} chat messages`);
    for (const msg of allMessages) {
      await ctx.db.delete(msg._id);
    }

    // Delete ALL threads for clean onboarding
    const allThreads = await ctx.db
      .query("dailyThreads")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    console.log(`[DEV] Deleting ${allThreads.length} threads`);
    for (const thread of allThreads) {
      await ctx.db.delete(thread._id);
    }

    // Delete all food logs
    const foodLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    console.log(`[DEV] Deleting ${foodLogs.length} food logs`);
    for (const log of foodLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete all weight logs
    const weightLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    console.log(`[DEV] Deleting ${weightLogs.length} weight logs`);
    for (const log of weightLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete any pending confirmations
    const confirmations = await ctx.db
      .query("pendingConfirmations")
      .withIndex("by_user_thread", (q) => q.eq("userId", userId))
      .collect();

    console.log(`[DEV] Deleting ${confirmations.length} pending confirmations`);
    for (const confirmation of confirmations) {
      await ctx.db.delete(confirmation._id);
    }

    // Delete any confirmed bubbles
    const bubbles = await ctx.db
      .query("confirmedBubbles")
      .withIndex("by_user_thread", (q) => q.eq("userId", userId))
      .collect();

    console.log(`[DEV] Deleting ${bubbles.length} confirmed bubbles`);
    for (const bubble of bubbles) {
      await ctx.db.delete(bubble._id);
    }

    // Delete onboarding progress
    const onboardingProgress = await ctx.db
      .query("onboardingProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (onboardingProgress) {
      console.log("[DEV] Deleting onboarding progress:", onboardingProgress._id);
      await ctx.db.delete(onboardingProgress._id);
    }

    // Delete weekly summaries
    const weeklySummaries = await ctx.db
      .query("weeklySummaries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    console.log(`[DEV] Deleting ${weeklySummaries.length} weekly summaries`);
    for (const summary of weeklySummaries) {
      await ctx.db.delete(summary._id);
    }

    // Delete any message summaries
    const messageSummaries = await ctx.db
      .query("messageSummaries")
      .collect();
    
    // Filter by threadId since no direct userId index
    const userThreadIds = allThreads.map(t => t.threadId);
    const userMessageSummaries = messageSummaries.filter(s => 
      userThreadIds.includes(s.threadId)
    );
    
    console.log(`[DEV] Deleting ${userMessageSummaries.length} message summaries`);
    for (const summary of userMessageSummaries) {
      await ctx.db.delete(summary._id);
    }

    console.log("[DEV] Onboarding reset complete!");
    console.log("[DEV] Deleted:");
    console.log(`  - Profile: ${profile ? 1 : 0}`);
    console.log(`  - Messages: ${allMessages.length}`);
    console.log(`  - Threads: ${allThreads.length}`);
    console.log(`  - Food logs: ${foodLogs.length}`);
    console.log(`  - Weight logs: ${weightLogs.length}`);
    console.log(`  - Confirmations: ${confirmations.length}`);
    console.log(`  - Bubbles: ${bubbles.length}`);
    console.log(`  - Weekly summaries: ${weeklySummaries.length}`);
    console.log(`  - Onboarding progress: ${onboardingProgress ? 1 : 0}`);
    
    return { success: true };
  },
});