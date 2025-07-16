import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Clean up duplicate user profiles - keeps the most recent one
export const cleanupDuplicateProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get all profiles for this user
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    console.log(
      `[cleanupDuplicateProfiles] Found ${profiles.length} profiles for user ${identity.subject}`,
    );

    if (profiles.length <= 1) {
      return { message: "No duplicates found", deleted: 0 };
    }

    // Sort by creation time (newest first) - fallback to updatedAt if no _creationTime
    const sortedProfiles = profiles.sort((a, b) => {
      const aTime = a._creationTime || a.updatedAt || 0;
      const bTime = b._creationTime || b.updatedAt || 0;
      return bTime - aTime;
    });

    // Keep the newest profile
    const profileToKeep = sortedProfiles[0];
    const profilesToDelete = sortedProfiles.slice(1);

    console.log(
      `[cleanupDuplicateProfiles] Keeping profile ${profileToKeep._id}, deleting ${profilesToDelete.length} duplicates`,
    );

    // Delete the duplicates
    let deleted = 0;
    for (const profile of profilesToDelete) {
      try {
        await ctx.db.delete(profile._id);
        deleted++;
        console.log(
          `[cleanupDuplicateProfiles] Deleted profile ${profile._id}`,
        );
      } catch (err) {
        console.error(
          `[cleanupDuplicateProfiles] Failed to delete profile ${profile._id}:`,
          err,
        );
      }
    }

    return {
      message: `Cleaned up ${deleted} duplicate profiles`,
      deleted,
      kept: profileToKeep._id,
    };
  },
});

// Admin function to clean up all users' duplicate profiles
export const cleanupAllDuplicateProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get all unique user IDs that have profiles
    const allProfiles = await ctx.db.query("userProfiles").collect();
    const userIds = [...new Set(allProfiles.map((p) => p.userId))];

    console.log(
      `[cleanupAllDuplicateProfiles] Found ${userIds.length} unique users with profiles`,
    );

    let totalDeleted = 0;
    const results = [];

    for (const userId of userIds) {
      // Get all profiles for this user
      const profiles = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      if (profiles.length <= 1) {
        continue;
      }

      // Sort by creation time (newest first)
      const sortedProfiles = profiles.sort((a, b) => {
        const aTime = a._creationTime || a.updatedAt || 0;
        const bTime = b._creationTime || b.updatedAt || 0;
        return bTime - aTime;
      });

      // Keep the newest profile
      const profileToKeep = sortedProfiles[0];
      const profilesToDelete = sortedProfiles.slice(1);

      console.log(
        `[cleanupAllDuplicateProfiles] User ${userId}: keeping profile ${profileToKeep._id}, deleting ${profilesToDelete.length} duplicates`,
      );

      // Delete the duplicates
      let deleted = 0;
      for (const profile of profilesToDelete) {
        try {
          await ctx.db.delete(profile._id);
          deleted++;
          totalDeleted++;
        } catch (err) {
          console.error(
            `[cleanupAllDuplicateProfiles] Failed to delete profile ${profile._id}:`,
            err,
          );
        }
      }

      results.push({
        userId,
        deleted,
        kept: profileToKeep._id,
      });
    }

    return {
      message: `Cleaned up ${totalDeleted} duplicate profiles across ${results.length} users`,
      totalDeleted,
      results,
    };
  },
});
