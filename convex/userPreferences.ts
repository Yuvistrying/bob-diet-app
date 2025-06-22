import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user preferences
export const getUserPreferences = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    // Return default preferences if none exist
    if (!prefs) {
      return {
        userId: identity.subject,
        displayMode: "standard",
        showCalories: true,
        showProtein: true,
        showCarbs: true,
        showFats: true,
        language: "en",
        darkMode: false,
        cuteMode: false,
        agentThreadId: undefined,
        reminderSettings: {
          weighInReminder: true,
          mealReminders: false,
          reminderTimes: {
            weighIn: "08:00",
          }
        },
      };
    }
    
    return prefs;
  },
});

// Update user preferences
// Save agent thread ID
export const saveAgentThreadId = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: Date.now(),
      });
    } else {
      // Create new preferences
      await ctx.db.insert("userPreferences", {
        userId: identity.subject,
        displayMode: "standard",
        showCalories: true,
        showProtein: true,
        showCarbs: true,
        showFats: true,
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
    }
  },
});

export const updatePreferences = mutation({
  args: {
    displayMode: v.optional(v.string()),
    showCalories: v.optional(v.boolean()),
    showProtein: v.optional(v.boolean()),
    showCarbs: v.optional(v.boolean()),
    showFats: v.optional(v.boolean()),
    language: v.optional(v.string()),
    darkMode: v.optional(v.boolean()),
    cuteMode: v.optional(v.boolean()),
    reminderSettings: v.optional(v.object({
      weighInReminder: v.boolean(),
      mealReminders: v.boolean(),
      reminderTimes: v.object({
        weighIn: v.optional(v.string()),
        breakfast: v.optional(v.string()),
        lunch: v.optional(v.string()),
        dinner: v.optional(v.string()),
      })
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    const updates = {
      ...args,
      updatedAt: Date.now(),
    };
    
    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      // Create new preferences
      await ctx.db.insert("userPreferences", {
        userId: identity.subject,
        displayMode: args.displayMode || "standard",
        showCalories: args.showCalories ?? true,
        showProtein: args.showProtein ?? true,
        showCarbs: args.showCarbs ?? true,
        showFats: args.showFats ?? true,
        language: args.language || "en",
        darkMode: args.darkMode || false,
        cuteMode: args.cuteMode || false,
        reminderSettings: args.reminderSettings || {
          weighInReminder: true,
          mealReminders: false,
          reminderTimes: {
            weighIn: "08:00",
          }
        },
        updatedAt: Date.now(),
      });
    }
  },
});

// Toggle display mode
export const toggleDisplayMode = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    if (!prefs) {
      // Create with stealth mode
      await ctx.db.insert("userPreferences", {
        userId: identity.subject,
        displayMode: "stealth",
        showCalories: false,
        showProtein: true,
        showCarbs: false,
        showFats: false,
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
    } else {
      // Toggle between standard and stealth
      const newMode = prefs.displayMode === "standard" ? "stealth" : "standard";
      await ctx.db.patch(prefs._id, {
        displayMode: newMode,
        showCalories: newMode === "standard",
        showCarbs: newMode === "standard",
        showFats: newMode === "standard",
        updatedAt: Date.now(),
      });
    }
  },
});

// Update theme preference
export const updateTheme = mutation({
  args: {
    darkMode: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        darkMode: args.darkMode,
        updatedAt: Date.now(),
      });
    } else {
      // Create new preferences with theme
      await ctx.db.insert("userPreferences", {
        userId: identity.subject,
        displayMode: "standard",
        showCalories: true,
        showProtein: true,
        showCarbs: true,
        showFats: true,
        language: "en",
        darkMode: args.darkMode,
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
    }
  },
});