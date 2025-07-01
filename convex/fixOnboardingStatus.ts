import { mutation } from "./_generated/server";

// Simple mutation to mark onboarding as complete for existing users
export const markOnboardingComplete = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();
    
    if (!profile) {
      return { error: "No profile found" };
    }
    
    // If profile has data but onboarding is not marked complete, fix it
    if (profile.name && profile.currentWeight && profile.dailyCalorieTarget && !profile.onboardingCompleted) {
      await ctx.db.patch(profile._id, {
        onboardingCompleted: true,
        updatedAt: Date.now()
      });
      
      console.log(`[markOnboardingComplete] Fixed onboarding status for user ${userId}`);
      return { success: true, message: "Onboarding marked as complete" };
    }
    
    if (profile.onboardingCompleted) {
      return { success: true, message: "Onboarding already complete" };
    }
    
    return { error: "Profile missing required data for completion" };
  },
});