import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get user's dietary preferences
export const getUserDietaryPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const userId = identity.subject;
    
    const preferences = await ctx.db
      .query("dietaryPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    return preferences;
  },
});

// Set or update dietary preferences
export const setDietaryPreferences = mutation({
  args: {
    restrictions: v.array(v.string()),
    customNotes: v.optional(v.string()),
    intermittentFasting: v.optional(v.object({
      enabled: v.boolean(),
      startHour: v.number(),
      endHour: v.number(),
      daysOfWeek: v.optional(v.array(v.number())),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    const now = Date.now();
    
    // Check if preferences already exist
    const existing = await ctx.db
      .query("dietaryPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (existing) {
      // Update existing preferences
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new preferences
      const id = await ctx.db.insert("dietaryPreferences", {
        userId,
        restrictions: args.restrictions,
        customNotes: args.customNotes,
        intermittentFasting: args.intermittentFasting,
        createdAt: now,
        updatedAt: now,
      });
      return id;
    }
  },
});

// Add a single restriction
export const addDietaryRestriction = mutation({
  args: {
    restriction: v.string(),
  },
  handler: async (ctx, { restriction }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    const preferences = await ctx.db
      .query("dietaryPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (!preferences) {
      // Create new preferences with just this restriction
      await ctx.db.insert("dietaryPreferences", {
        userId,
        restrictions: [restriction],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // Add to existing restrictions if not already present
      const restrictions = preferences.restrictions || [];
      if (!restrictions.includes(restriction)) {
        await ctx.db.patch(preferences._id, {
          restrictions: [...restrictions, restriction],
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// Remove a restriction
export const removeDietaryRestriction = mutation({
  args: {
    restriction: v.string(),
  },
  handler: async (ctx, { restriction }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    
    const preferences = await ctx.db
      .query("dietaryPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (preferences && preferences.restrictions) {
      const newRestrictions = preferences.restrictions.filter(r => r !== restriction);
      await ctx.db.patch(preferences._id, {
        restrictions: newRestrictions,
        updatedAt: Date.now(),
      });
    }
  },
});

// Update intermittent fasting settings
export const updateIntermittentFasting = mutation({
  args: {
    enabled: v.boolean(),
    startHour: v.optional(v.number()),
    endHour: v.optional(v.number()),
    daysOfWeek: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const userId = identity.subject;
    const now = Date.now();
    
    const preferences = await ctx.db
      .query("dietaryPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    const intermittentFasting = args.enabled 
      ? {
          enabled: true,
          startHour: args.startHour || 12,
          endHour: args.endHour || 20,
          daysOfWeek: args.daysOfWeek,
        }
      : undefined;
    
    if (preferences) {
      await ctx.db.patch(preferences._id, {
        intermittentFasting,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("dietaryPreferences", {
        userId,
        restrictions: [],
        intermittentFasting,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Common dietary restrictions for UI
export const COMMON_RESTRICTIONS = [
  "vegan",
  "vegetarian", 
  "gluten-free",
  "dairy-free",
  "nut-free",
  "soy-free",
  "egg-free",
  "shellfish-free",
  "keto",
  "low-carb",
  "diabetic",
  "halal",
  "kosher",
] as const;

// Helper to check if currently in fasting window
export function isInFastingWindow(preferences: any): boolean {
  if (!preferences?.intermittentFasting?.enabled) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();
  
  const { startHour, endHour, daysOfWeek } = preferences.intermittentFasting;
  
  // Check if today is a fasting day
  if (daysOfWeek && daysOfWeek.length > 0 && !daysOfWeek.includes(currentDay)) {
    return false;
  }
  
  // Check if current time is outside eating window (i.e., in fasting window)
  if (endHour > startHour) {
    // Normal case: eating window doesn't cross midnight
    return currentHour < startHour || currentHour >= endHour;
  } else {
    // Eating window crosses midnight
    return currentHour < startHour && currentHour >= endHour;
  }
}