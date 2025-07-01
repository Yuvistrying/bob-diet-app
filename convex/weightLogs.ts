import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Get latest weight entry
export const getLatestWeight = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const latest = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q: any) => q.eq("userId", identity.subject))
      .order("desc")
      .first();
    
    if (!latest) return null;
    
    // Calculate 7-day trend
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const weekLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => q.gte(q.field("date"), weekAgoStr))
      .collect();
    
    let trend = 0;
    if (weekLogs.length > 1) {
      const oldest = weekLogs.reduce((prev, curr) => 
        prev.date < curr.date ? prev : curr
      );
      trend = latest.weight - oldest.weight;
    }
    
    return {
      ...latest,
      trend
    };
  },
});

// Get weight logs by date range
export const getWeightLogs = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    let query = ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q: any) => q.eq("userId", identity.subject))
      .order("desc");
    
    const logs = await query.collect(); // Get all logs for now
    
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  },
});

// Log weight
export const logWeight = mutation({
  args: {
    weight: v.number(),
    unit: v.string(), // "kg" or "lbs"
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    
    // Check if already logged today
    const existing = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject).eq("date", date)
      )
      .first();
    
    let logId;
    if (existing) {
      // Update existing log
      await ctx.db.patch(existing._id, {
        weight: args.weight,
        unit: args.unit,
        time,
        notes: args.notes,
      });
      logId = existing._id;
    } else {
      // Create new log
      logId = await ctx.db.insert("weightLogs", {
        userId: identity.subject,
        weight: args.weight,
        unit: args.unit,
        date,
        time,
        notes: args.notes,
        createdAt: Date.now(),
      });
    }
    
    // Generate embedding if notes are provided
    if (args.notes) {
      ctx.scheduler.runAfter(0, api.embeddings.embedWeightLogNote, {
        weightLogId: logId,
        weight: args.weight,
        unit: args.unit,
        date,
        notes: args.notes,
      });
    }
    
    // Clear cached context since weight data has changed
    // Clear cached context when weight is logged
    await ctx.runMutation(api.sessionCache.clearSessionCacheKey, {
      cacheKey: "chat_context"
    });
    
    // Check for goal achievement using weekly average
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    if (profile && profile.goal && profile.targetWeight) {
      // Get this week's average
      const weekAverage = await ctx.runQuery(api.weightLogs.getThisWeekAverage);
      
      // Need at least 3 logs in the week for valid average
      if (weekAverage && weekAverage.count >= 3) {
        // Import the check function
        const { checkGoalAchievement } = await import("./goalAchievements");
        
        // For maintenance goals, also get previous week's average
        let previousWeekAverage;
        if (profile.goal === "maintain") {
          const pastWeeks = await ctx.runQuery(api.weightLogs.getPast4WeeksAverages);
          if (pastWeeks && pastWeeks.length >= 2) {
            previousWeekAverage = pastWeeks[1].average;
          }
        }
        
        const achieved = checkGoalAchievement(
          profile.goal,
          weekAverage.average,
          profile.targetWeight,
          previousWeekAverage
        );
        
        if (achieved) {
          // Create achievement record
          await ctx.runMutation(api.goalAchievements.createAchievement, {
            goalType: profile.goal,
            targetWeight: profile.targetWeight,
            achievedWeight: args.weight,
            weeklyAverage: weekAverage.average,
            daysAtGoal: profile.goal === "maintain" ? 14 : undefined,
          });
        }
      }
    }
    
    return logId;
  },
});

// Update weight log
export const updateWeight = mutation({
  args: {
    logId: v.id("weightLogs"),
    weight: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== identity.subject) {
      throw new Error("Weight log not found or unauthorized");
    }
    
    await ctx.db.patch(args.logId, {
      weight: args.weight,
      time: new Date().toTimeString().slice(0, 5), // Update time to current
    });
    
    // Clear cached context since weight data has changed
    await ctx.runMutation(api.sessionCache.clearSessionCacheKey, {
      cacheKey: "chat_context"
    });
  },
});

// Delete weight log
export const deleteWeightLog = mutation({
  args: { logId: v.id("weightLogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== identity.subject) {
      throw new Error("Weight log not found or unauthorized");
    }
    
    await ctx.db.delete(args.logId);
  },
});

// Check if weight logged today
export const hasLoggedWeightToday = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    
    const today = new Date().toISOString().split('T')[0];
    
    const todayLog = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject).eq("date", today)
      )
      .first();
    
    return !!todayLog;
  },
});

// Get weight statistics
export const getWeightStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
      .first();
    
    if (!profile) return null;
    
    const allLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_created", (q: any) => q.eq("userId", identity.subject))
      .collect();
    
    if (allLogs.length === 0) return null;
    
    const latest = allLogs[0];
    const oldest = allLogs[allLogs.length - 1];
    
    return {
      current: latest.weight,
      starting: oldest.weight,
      target: profile.targetWeight,
      totalChange: latest.weight - oldest.weight,
      toGoal: profile.targetWeight - latest.weight,
      daysTracked: allLogs.length,
    };
  },
});

// Get this week's average
export const getThisWeekAverage = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    
    const weekLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => q.gte(q.field("date"), startOfWeekStr))
      .collect();
    
    if (weekLogs.length === 0) return null;
    
    const sum = weekLogs.reduce((acc, log) => acc + log.weight, 0);
    return {
      average: Math.round((sum / weekLogs.length) * 10) / 10,
      count: weekLogs.length,
      logs: weekLogs.sort((a, b) => b.date.localeCompare(a.date))
    };
  },
});

// Get weekly averages for past 4 weeks
export const getPast4WeeksAverages = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const weeklyAverages = [];
    const today = new Date();
    
    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      
      const weekLogs = await ctx.db
        .query("weightLogs")
        .withIndex("by_user_date", (q: any) => 
          q.eq("userId", identity.subject)
        )
        .filter((q: any) => 
          q.and(
            q.gte(q.field("date"), weekStart.toISOString().split('T')[0]),
            q.lte(q.field("date"), weekEnd.toISOString().split('T')[0])
          )
        )
        .collect();
      
      if (weekLogs.length > 0) {
        const sum = weekLogs.reduce((acc, log) => acc + log.weight, 0);
        weeklyAverages.push({
          weekNumber: i + 1,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0],
          average: Math.round((sum / weekLogs.length) * 10) / 10,
          count: weekLogs.length
        });
      }
    }
    
    return weeklyAverages;
  },
});

// Get monthly averages
export const getMonthlyAverages = query({
  args: {
    months: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const monthCount = args.months || 6;
    const monthlyAverages = [];
    const today = new Date();
    
    for (let i = 0; i < monthCount; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      
      const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
      const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const monthLogs = await ctx.db
        .query("weightLogs")
        .withIndex("by_user_date", (q: any) => 
          q.eq("userId", identity.subject)
        )
        .filter((q: any) => 
          q.and(
            q.gte(q.field("date"), monthStart),
            q.lte(q.field("date"), monthEnd)
          )
        )
        .collect();
      
      if (monthLogs.length > 0) {
        const sum = monthLogs.reduce((acc, log) => acc + log.weight, 0);
        monthlyAverages.push({
          year,
          month: month + 1,
          monthName: monthDate.toLocaleDateString('en-US', { month: 'long' }),
          average: Math.round((sum / monthLogs.length) * 10) / 10,
          count: monthLogs.length
        });
      }
    }
    
    return monthlyAverages;
  },
});

// Get current week data (Mon-Sun)
export const getCurrentWeekData = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    const weekData = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const log = await ctx.db
        .query("weightLogs")
        .withIndex("by_user_date", (q: any) => 
          q.eq("userId", identity.subject).eq("date", dateStr)
        )
        .first();
      
      weekData.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        weight: log?.weight || null,
        unit: log?.unit || null,
        isToday: dateStr === today.toISOString().split('T')[0]
      });
    }
    
    // Calculate week average
    const weights = weekData.filter(d => d.weight !== null).map(d => d.weight!);
    const weekAverage = weights.length > 0 
      ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10
      : null;
    
    return {
      days: weekData,
      average: weekAverage,
      entryCount: weights.length
    };
  },
});

// Get week over week change
export const getWeekOverWeekChange = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    // This week
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + mondayOffset);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    
    // Last week
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    
    // Get this week's logs
    const thisWeekLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => 
        q.and(
          q.gte(q.field("date"), thisMonday.toISOString().split('T')[0]),
          q.lte(q.field("date"), thisSunday.toISOString().split('T')[0])
        )
      )
      .collect();
    
    // Get last week's logs
    const lastWeekLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => 
        q.and(
          q.gte(q.field("date"), lastMonday.toISOString().split('T')[0]),
          q.lte(q.field("date"), lastSunday.toISOString().split('T')[0])
        )
      )
      .collect();
    
    if (thisWeekLogs.length === 0 || lastWeekLogs.length === 0) return null;
    
    const thisWeekAvg = thisWeekLogs.reduce((acc, log) => acc + log.weight, 0) / thisWeekLogs.length;
    const lastWeekAvg = lastWeekLogs.reduce((acc, log) => acc + log.weight, 0) / lastWeekLogs.length;
    
    return {
      currentAverage: Math.round(thisWeekAvg * 10) / 10,
      lastWeekAverage: Math.round(lastWeekAvg * 10) / 10,
      change: Math.round((thisWeekAvg - lastWeekAvg) * 10) / 10,
      percentChange: Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 1000) / 10
    };
  },
});

// Get weekly trends for chart
export const getWeeklyTrends = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const trends = [];
    const today = new Date();
    
    // Get last 4 weeks of data
    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      
      const weekLogs = await ctx.db
        .query("weightLogs")
        .withIndex("by_user_date", (q: any) => 
          q.eq("userId", identity.subject)
        )
        .filter((q: any) => 
          q.and(
            q.gte(q.field("date"), weekStart.toISOString().split('T')[0]),
            q.lte(q.field("date"), weekEnd.toISOString().split('T')[0])
          )
        )
        .collect();
      
      if (weekLogs.length > 0) {
        const avg = weekLogs.reduce((acc, log) => acc + log.weight, 0) / weekLogs.length;
        const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        trends.push({
          week: i === 0 ? "This Week" : `${startMonth} - ${endMonth}`,
          weekNumber: i,
          average: Math.round(avg * 10) / 10,
          entryCount: weekLogs.length,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0]
        });
      }
    }
    
    return trends.reverse(); // Return in chronological order
  },
});

// Get monthly progress (weekly averages for current month)
export const getMonthlyProgress = query({
  args: {
    monthOffset: v.optional(v.number()), // 0 = current month, -1 = last month, etc.
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const today = new Date();
    const offset = args.monthOffset || 0;
    
    // Calculate target month based on offset
    const targetDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const currentMonth = targetDate.getMonth();
    const currentYear = targetDate.getFullYear();
    
    // Get first and last day of current month
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    
    // Get all logs for current month
    const monthLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => 
        q.and(
          q.gte(q.field("date"), monthStart.toISOString().split('T')[0]),
          q.lte(q.field("date"), monthEnd.toISOString().split('T')[0])
        )
      )
      .collect();
    
    // Group by week
    const weeklyData = [];
    const weeksInMonth = Math.ceil(monthEnd.getDate() / 7);
    
    for (let week = 0; week < weeksInMonth; week++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(1 + (week * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      // Don't go past month end
      if (weekEnd > monthEnd) {
        weekEnd.setTime(monthEnd.getTime());
      }
      
      const weekLogs = monthLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= weekStart && logDate <= weekEnd;
      });
      
      if (weekLogs.length > 0) {
        const avg = weekLogs.reduce((acc, log) => acc + log.weight, 0) / weekLogs.length;
        weeklyData.push({
          week: `Week ${week + 1}`,
          average: Math.round(avg * 10) / 10,
          startDate: weekStart.toISOString().split('T')[0],
          endDate: weekEnd.toISOString().split('T')[0]
        });
      }
    }
    
    // Calculate month average
    const monthAverage = monthLogs.length > 0
      ? Math.round((monthLogs.reduce((acc, log) => acc + log.weight, 0) / monthLogs.length) * 10) / 10
      : null;
    
    // Get previous month average for comparison
    const prevMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthEnd = new Date(currentYear, currentMonth, 0);
    
    const prevMonthLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => 
        q.and(
          q.gte(q.field("date"), prevMonthStart.toISOString().split('T')[0]),
          q.lte(q.field("date"), prevMonthEnd.toISOString().split('T')[0])
        )
      )
      .collect();
    
    const prevMonthAverage = prevMonthLogs.length > 0
      ? Math.round((prevMonthLogs.reduce((acc, log) => acc + log.weight, 0) / prevMonthLogs.length) * 10) / 10
      : null;
    
    return {
      monthName: targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      weeklyData,
      monthAverage,
      prevMonthAverage,
      changeFromLastMonth: monthAverage && prevMonthAverage 
        ? Math.round((monthAverage - prevMonthAverage) * 10) / 10
        : null,
      isCurrentMonth: offset === 0
    };
  },
});

// Get weight logs for date range (for analytics)
export const getWeightLogsRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const logs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), identity.subject),
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();
    
    return logs.sort((a, b) => a.date.localeCompare(b.date));
  },
});

// Get yearly progress
export const getYearlyProgress = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const today = new Date();
    
    const monthlyData = [];
    
    // Get data for each month of current year
    for (let month = 0; month <= today.getMonth(); month++) {
      const monthStart = new Date(currentYear, month, 1);
      const monthEnd = new Date(currentYear, month + 1, 0);
      
      const monthLogs = await ctx.db
        .query("weightLogs")
        .withIndex("by_user_date", (q: any) => 
          q.eq("userId", identity.subject)
        )
        .filter((q: any) => 
          q.and(
            q.gte(q.field("date"), monthStart.toISOString().split('T')[0]),
            q.lte(q.field("date"), monthEnd.toISOString().split('T')[0])
          )
        )
        .collect();
      
      if (monthLogs.length > 0) {
        const avg = monthLogs.reduce((acc, log) => acc + log.weight, 0) / monthLogs.length;
        monthlyData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          monthNumber: month + 1,
          average: Math.round(avg * 10) / 10,
          entryCount: monthLogs.length
        });
      }
    }
    
    // Calculate year-to-date average
    const allYearLogs = await ctx.db
      .query("weightLogs")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", identity.subject)
      )
      .filter((q: any) => 
        q.gte(q.field("date"), yearStart.toISOString().split('T')[0])
      )
      .collect();
    
    const yearAverage = allYearLogs.length > 0
      ? Math.round((allYearLogs.reduce((acc, log) => acc + log.weight, 0) / allYearLogs.length) * 10) / 10
      : null;
    
    // Get first and last entries for total change
    const firstEntry = allYearLogs.length > 0 ? allYearLogs[allYearLogs.length - 1] : null;
    const lastEntry = allYearLogs.length > 0 ? allYearLogs[0] : null;
    
    return {
      year: currentYear,
      monthlyData,
      yearAverage,
      totalChange: firstEntry && lastEntry 
        ? Math.round((lastEntry.weight - firstEntry.weight) * 10) / 10
        : null,
      startWeight: firstEntry?.weight || null,
      currentWeight: lastEntry?.weight || null
    };
  },
});