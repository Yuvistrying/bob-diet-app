import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Track when reminders were shown/dismissed
export const trackReminderInteraction = mutation({
  args: {
    reminderType: v.string(), // "breakfast", "lunch", "dinner", "weight", etc.
    action: v.string(), // "shown", "dismissed", "acted_on"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const today = new Date().toISOString().split('T')[0];
    
    // Store reminder interaction
    await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: "system",
      content: `Reminder ${args.action}: ${args.reminderType}`,
      timestamp: Date.now(),
      metadata: {
        actionType: "reminder_interaction",
        reminderType: args.reminderType,
        action: args.action,
        date: today
      }
    });
  },
});

// Check if a reminder was already shown today
export const wasReminderShownToday = query({
  args: {
    reminderType: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Check if this reminder was already shown today
    const interactions = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q: any) => q.eq("userId", identity.subject))
      .filter((q: any) => 
        q.and(
          q.eq(q.field("role"), "system"),
          q.gte(q.field("timestamp"), todayStart.getTime()),
          q.eq(q.field("metadata.reminderType"), args.reminderType),
          q.or(
            q.eq(q.field("metadata.action"), "shown"),
            q.eq(q.field("metadata.action"), "dismissed")
          )
        )
      )
      .collect();
    
    return interactions.length > 0;
  },
});

// Get reminder effectiveness stats
export const getReminderStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Get all reminder interactions from the past week
    const interactions = await ctx.db
      .query("chatHistory")
      .withIndex("by_user_timestamp", (q: any) => q.eq("userId", identity.subject))
      .filter((q: any) => 
        q.and(
          q.eq(q.field("role"), "system"),
          q.gte(q.field("timestamp"), oneWeekAgo.getTime()),
          q.eq(q.field("metadata.actionType"), "reminder_interaction")
        )
      )
      .collect();
    
    // Calculate effectiveness
    const stats: Record<string, { shown: number, acted_on: number, dismissed: number }> = {};
    
    interactions.forEach(interaction => {
      const type = interaction.metadata?.reminderType;
      const action = interaction.metadata?.action;
      
      if (type && action) {
        if (!stats[type]) {
          stats[type] = { shown: 0, acted_on: 0, dismissed: 0 };
        }
        
        if (action === "shown") stats[type].shown++;
        else if (action === "acted_on") stats[type].acted_on++;
        else if (action === "dismissed") stats[type].dismissed++;
      }
    });
    
    // Calculate effectiveness rates
    const effectiveness = Object.entries(stats).map(([type, data]) => ({
      type,
      effectivenessRate: data.shown > 0 ? Math.round((data.acted_on / data.shown) * 100) : 0,
      ...data
    }));
    
    return {
      stats: effectiveness,
      overallEffectiveness: effectiveness.length > 0 
        ? Math.round(
            effectiveness.reduce((sum, item) => sum + item.effectivenessRate, 0) / effectiveness.length
          )
        : 0
    };
  },
});