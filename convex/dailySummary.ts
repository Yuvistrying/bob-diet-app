import { v } from "convex/values";
import { query } from "./_generated/server";
import { api } from "./_generated/api";

// Get compact daily summary for chat context
export const getDailySummary = query({
  args: {},
  handler: async (ctx, args): Promise<{
    today: {
      date: string;
      stats: { calories: number; protein: number; carbs: number; fat: number };
      summary: string;
      hasWeighedIn: boolean;
      foodLogs: Array<{ meal: string; time: number; summary: string }>;
      remaining: { calories: number; protein: number } | null;
    };
    yesterday: {
      date: string;
      stats: { calories: number; protein: number; carbs: number; fat: number };
      total: string;
    };
    profile: {
      name: string;
      goal: string;
      dailyCalorieTarget: number;
      proteinTarget: number;
    } | null;
    hasPendingConfirmations: boolean;
    achievement: {
      goalType: string;
      targetWeight: number;
      achievedWeight: number;
      weeklyAverage: number;
      daysSinceAchieved: number;
      achievedAt: number;
    } | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.log("[getDailySummary] Not authenticated, returning null");
      return {
        today: {
          date: new Date().toISOString().split('T')[0],
          stats: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          summary: "Not authenticated",
          hasWeighedIn: false,
          foodLogs: [],
          remaining: null
        },
        yesterday: {
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          stats: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          total: "0cal (0p/0c/0f)"
        },
        profile: null,
        hasPendingConfirmations: false,
        achievement: null
      };
    }
    const userId = identity.subject;

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [
      todayStats,
      yesterdayStats,
      todayLogs,
      hasWeighedToday,
      profile,
      pendingConfirmations
    ] = await Promise.all([
      // Today's stats
      ctx.runQuery(api.foodLogs.getTodayStats),
      
      // Yesterday's stats
      ctx.db.query("foodLogs")
        .withIndex("by_user_date", q => 
          q.eq("userId", userId).eq("date", yesterdayStr)
        )
        .collect()
        .then(logs => {
          const stats = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          logs.forEach(log => {
            log.foods.forEach(food => {
              stats.calories += food.calories || 0;
              stats.protein += food.protein || 0;
              stats.carbs += food.carbs || 0;
              stats.fat += food.fat || 0;
            });
          });
          return stats;
        }),
      
      // Today's food logs (compact format)
      ctx.db.query("foodLogs")
        .withIndex("by_user_date", q => 
          q.eq("userId", userId).eq("date", today)
        )
        .order("asc")
        .collect()
        .then(logs => 
          logs.map(log => ({
            meal: log.meal,
            time: log.createdAt,
            summary: log.foods.map(f => 
              `${f.name} ${f.calories}cal (${f.protein}p/${f.carbs}c/${f.fat}f)`
            ).join(", ")
          }))
        ),
      
      // Check if weighed today
      ctx.runQuery(api.weightLogs.hasLoggedWeightToday),
      
      // User profile
      ctx.runQuery(api.userProfiles.getUserProfile, {}),
      
      // Any pending confirmations
      ctx.db.query("pendingConfirmations")
        .withIndex("by_user_thread", q => q.eq("userId", userId))
        .filter(q => q.eq(q.field("status"), "pending"))
        .collect()
    ]);

    // Format today's summary
    const todaySummary = todayLogs.length > 0 
      ? todayLogs.map((log: { meal: string; time: number; summary: string }) => 
          `${log.meal}: ${log.summary}`
        ).join("\n")
      : "No food logged yet today";

    // Build context object
    const result = {
      today: {
        date: today,
        stats: todayStats || { calories: 0, protein: 0, carbs: 0, fat: 0 },
        summary: todaySummary,
        hasWeighedIn: hasWeighedToday,
        foodLogs: todayLogs,
        remaining: profile ? {
          calories: profile.dailyCalorieTarget - (todayStats?.calories || 0),
          protein: profile.proteinTarget - (todayStats?.protein || 0)
        } : null
      },
      yesterday: {
        date: yesterdayStr,
        stats: yesterdayStats,
        total: `${Math.round(yesterdayStats.calories)}cal (${Math.round(yesterdayStats.protein)}p/${Math.round(yesterdayStats.carbs)}c/${Math.round(yesterdayStats.fat)}f)`
      },
      profile: profile ? {
        name: profile.name,
        goal: profile.goal,
        dailyCalorieTarget: profile.dailyCalorieTarget,
        proteinTarget: profile.proteinTarget
      } : null,
      hasPendingConfirmations: pendingConfirmations.length > 0
    };
    
    // Check for unhandled goal achievements
    const achievement = await ctx.db
      .query("goalAchievements")
      .withIndex("by_user_triggered", (q: any) => 
        q.eq("userId", identity.subject).eq("bobSuggested", false)
      )
      .order("desc")
      .first();
    
    let achievementData = null;
    if (achievement) {
      achievementData = {
        goalType: achievement.goalType,
        targetWeight: achievement.targetWeight,
        achievedWeight: achievement.achievedWeight,
        weeklyAverage: achievement.weeklyAverage,
        daysSinceAchieved: Math.floor((Date.now() - achievement.achievedAt) / (1000 * 60 * 60 * 24)),
        achievedAt: achievement.achievedAt
      };
    }
    
    return {
      ...result,
      achievement: achievementData
    };
  },
});