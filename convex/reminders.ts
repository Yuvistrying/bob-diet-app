import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Check which meals have been logged today
export const getTodayMealStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get all food logs for today
    const todayLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject).eq("date", today)
      )
      .collect();
    
    // Check which meals have been logged
    const loggedMeals = new Set(todayLogs.map(log => log.meal));
    
    // Get current time to determine which meals should have been logged
    const now = new Date();
    const hour = now.getHours();
    
    const mealStatus = {
      breakfast: {
        logged: loggedMeals.has("breakfast"),
        timeWindow: "6:00 AM - 11:00 AM",
        shouldRemind: hour >= 9 && hour < 11 && !loggedMeals.has("breakfast"),
        isPast: hour >= 11
      },
      lunch: {
        logged: loggedMeals.has("lunch"),
        timeWindow: "11:00 AM - 3:00 PM", 
        shouldRemind: hour >= 13 && hour < 15 && !loggedMeals.has("lunch"),
        isPast: hour >= 15
      },
      dinner: {
        logged: loggedMeals.has("dinner"),
        timeWindow: "5:00 PM - 9:00 PM",
        shouldRemind: hour >= 19 && hour < 21 && !loggedMeals.has("dinner"),
        isPast: hour >= 21
      },
      snack: {
        logged: loggedMeals.has("snack"),
        timeWindow: "Any time",
        shouldRemind: false,
        isPast: false
      }
    };
    
    // Calculate completion stats
    const mainMealsLogged = [mealStatus.breakfast.logged, mealStatus.lunch.logged, mealStatus.dinner.logged]
      .filter(Boolean).length;
    const totalMainMeals = 3;
    
    return {
      mealStatus,
      mainMealsLogged,
      totalMainMeals,
      completionPercentage: Math.round((mainMealsLogged / totalMainMeals) * 100),
      hasUnloggedMeals: mainMealsLogged < totalMainMeals && hour >= 21,
      currentHour: hour
    };
  },
});

// Get reminder settings and check if reminders are due
export const getReminderStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // Get user preferences
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    if (!prefs?.reminderSettings?.mealReminders) {
      return { remindersEnabled: false };
    }
    
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const hour = now.getHours();
    
    // Check meal status
    const mealStatus = await ctx.runQuery("reminders:getTodayMealStatus");
    if (!mealStatus) return null;
    
    const reminders = [];
    
    // Breakfast reminder
    if (prefs.reminderSettings.reminderTimes?.breakfast && 
        !mealStatus.mealStatus.breakfast.logged && 
        hour >= 9 && hour < 11) {
      reminders.push({
        type: "breakfast",
        message: "Don't forget to log your breakfast! 🥐",
        priority: "medium"
      });
    }
    
    // Lunch reminder
    if (prefs.reminderSettings.reminderTimes?.lunch && 
        !mealStatus.mealStatus.lunch.logged && 
        hour >= 13 && hour < 15) {
      reminders.push({
        type: "lunch",
        message: "Time to log your lunch! 🥗",
        priority: "medium"
      });
    }
    
    // Dinner reminder
    if (prefs.reminderSettings.reminderTimes?.dinner && 
        !mealStatus.mealStatus.dinner.logged && 
        hour >= 19 && hour < 21) {
      reminders.push({
        type: "dinner",
        message: "Don't forget to log your dinner! 🍽️",
        priority: "medium"
      });
    }
    
    // End of day summary (9 PM)
    if (hour === 21 && mealStatus.mainMealsLogged < 3) {
      reminders.push({
        type: "daily_summary",
        message: `You've logged ${mealStatus.mainMealsLogged}/3 meals today. Want to add any missing meals?`,
        priority: "high"
      });
    }
    
    // Weight reminder
    const hasWeighedToday = await ctx.runQuery("weightLogs:hasLoggedWeightToday");
    if (prefs.reminderSettings.weighInReminder && 
        !hasWeighedToday && 
        hour >= 6 && hour <= 10) {
      reminders.push({
        type: "weight",
        message: "Time for your daily weigh-in! 📊",
        priority: "low"
      });
    }
    
    return {
      remindersEnabled: true,
      currentReminders: reminders,
      reminderSettings: prefs.reminderSettings,
      currentTime
    };
  },
});

// Update last reminder time (to avoid spam)
export const updateLastReminderTime = mutation({
  args: {
    reminderType: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Store in a new reminders tracking table or in user preferences
    // For now, we'll store it in the chat metadata
    await ctx.db.insert("chatHistory", {
      userId: identity.subject,
      role: "system",
      content: `Reminder sent: ${args.reminderType}`,
      timestamp: Date.now(),
      metadata: {
        actionType: "reminder_sent",
        reminderType: args.reminderType
      }
    });
  },
});

// Get smart reminder suggestions based on patterns
export const getSmartReminders = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // Get food logs from the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const startDate = oneWeekAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const recentLogs = await ctx.db
      .query("foodLogs")
      .withIndex("by_user_date")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.gte(q.field("date"), startDate),
          q.lte(q.field("date"), endDate)
        )
      )
      .collect();
    
    // Analyze patterns
    const mealTimes: Record<string, number[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };
    
    recentLogs.forEach(log => {
      const hour = parseInt(log.time.split(':')[0]);
      if (mealTimes[log.meal]) {
        mealTimes[log.meal].push(hour);
      }
    });
    
    // Calculate average meal times
    const avgMealTimes: Record<string, string | null> = {
      breakfast: null,
      lunch: null,
      dinner: null,
      snack: null
    };
    
    Object.entries(mealTimes).forEach(([meal, times]) => {
      if (times.length > 0) {
        const avgHour = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        avgMealTimes[meal] = `${String(avgHour).padStart(2, '0')}:00`;
      }
    });
    
    // Check for frequently missed meals
    const daysAnalyzed = 7;
    const mealCounts = Object.entries(mealTimes).reduce((acc, [meal, times]) => {
      acc[meal] = times.length;
      return acc;
    }, {} as Record<string, number>);
    
    const missedMealPatterns = Object.entries(mealCounts)
      .filter(([meal, count]) => meal !== "snack" && count < daysAnalyzed * 0.5)
      .map(([meal]) => meal);
    
    return {
      averageMealTimes: avgMealTimes,
      frequentlyMissedMeals: missedMealPatterns,
      suggestions: missedMealPatterns.length > 0 
        ? `You often miss ${missedMealPatterns.join(" and ")}. Would you like me to remind you?`
        : null
    };
  },
});