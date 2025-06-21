import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../_generated/api";

export const findPatterns = createTool({
  description: "Analyze user's eating patterns and find correlations with weight changes",
  args: z.object({
    timeframe: z.enum(["week", "month", "all"]).describe("Time period to analyze"),
    patternType: z.enum(["weight_correlation", "meal_timing", "calorie_trends", "successful_days"])
      .describe("Type of pattern to look for"),
  }),
  handler: async (ctx, args): Promise<{
    patterns: any[];
    insights: string;
    recommendations: string[];
  }> => {
    // Get user ID from context
    const userId = (ctx as any).userId;
    if (!userId) throw new Error("User ID not found in context");
    
    // Get user profile for context
    const profile = await ctx.runQuery(api.userProfiles.getUserProfile, {});
    if (!profile) {
      return {
        patterns: [],
        insights: "No profile data available yet.",
        recommendations: [],
      };
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (args.timeframe === "week") {
      startDate.setDate(endDate.getDate() - 7);
    } else if (args.timeframe === "month") {
      startDate.setMonth(endDate.getMonth() - 1);
    } else {
      startDate.setFullYear(endDate.getFullYear() - 1); // Max 1 year
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Get food logs and weight logs for the period
    const foodLogs = await ctx.runQuery(api.foodLogs.getFoodLogsRange, {
      startDate: startDateStr,
      endDate: endDateStr,
    });
    
    const weightLogs = await ctx.runQuery(api.weightLogs.getWeightLogsRange, {
      startDate: startDateStr,
      endDate: endDateStr,
    });
    
    let patterns: any[] = [];
    let insights = "";
    let recommendations: string[] = [];
    
    switch (args.patternType) {
      case "weight_correlation": {
        // Find foods that correlate with weight changes
        const weightChanges: Array<{
          date: string;
          change: number;
          direction: "up" | "down" | "stable";
        }> = [];
        
        for (let i = 1; i < weightLogs.length; i++) {
          const prevWeight = weightLogs[i-1].weight;
          const currWeight = weightLogs[i].weight;
          const change = currWeight - prevWeight;
          
          weightChanges.push({
            date: weightLogs[i].date,
            change: Math.round(change * 10) / 10,
            direction: change > 0.2 ? "up" : change < -0.2 ? "down" : "stable",
          });
        }
        
        // Find foods eaten on days before weight loss
        const successDays = weightChanges.filter(w => w.direction === "down");
        const successFoods = new Map<string, number>();
        
        for (const day of successDays) {
          const prevDate = new Date(day.date);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevDateStr = prevDate.toISOString().split('T')[0];
          
          const dayFoods = foodLogs.filter(f => f.date === prevDateStr);
          for (const log of dayFoods) {
            for (const food of log.foods) {
              const key = food.name.toLowerCase();
              successFoods.set(key, (successFoods.get(key) || 0) + 1);
            }
          }
        }
        
        // Sort foods by frequency
        const topSuccessFoods = Array.from(successFoods.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([food, count]) => ({ food, count, percentage: Math.round((count / successDays.length) * 100) }));
        
        patterns = topSuccessFoods;
        insights = successDays.length > 0 
          ? `Found ${successDays.length} days with weight loss. Foods most commonly eaten before weight loss: ${topSuccessFoods.map(f => f.food).join(", ")}`
          : "Not enough weight data to find correlations yet. Keep logging!";
        
        if (topSuccessFoods.length > 0) {
          recommendations.push(`Consider eating more ${topSuccessFoods[0].food} - it appeared in ${topSuccessFoods[0].percentage}% of your successful days`);
        }
        break;
      }
      
      case "meal_timing": {
        // Analyze when meals are eaten
        const mealTimes = new Map<string, number[]>();
        
        for (const log of foodLogs) {
          const hour = parseInt(log.time.split(':')[0]);
          if (!mealTimes.has(log.meal)) {
            mealTimes.set(log.meal, []);
          }
          mealTimes.get(log.meal)!.push(hour);
        }
        
        // Calculate average times
        const avgTimes = Array.from(mealTimes.entries()).map(([meal, times]) => ({
          meal,
          avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
          consistency: Math.round((1 - (Math.max(...times) - Math.min(...times)) / 24) * 100),
        }));
        
        patterns = avgTimes;
        insights = `Your meal timing analysis: ${avgTimes.map(m => `${m.meal} at ${m.avgTime}:00`).join(", ")}`;
        
        const leastConsistent = avgTimes.sort((a, b) => a.consistency - b.consistency)[0];
        if (leastConsistent && leastConsistent.consistency < 70) {
          recommendations.push(`Try to eat ${leastConsistent.meal} at a more consistent time - currently only ${leastConsistent.consistency}% consistent`);
        }
        break;
      }
      
      case "calorie_trends": {
        // Analyze daily calorie trends
        const dailyCalories = new Map<string, number>();
        
        for (const log of foodLogs) {
          const current = dailyCalories.get(log.date) || 0;
          dailyCalories.set(log.date, current + log.totalCalories);
        }
        
        const calorieArray = Array.from(dailyCalories.entries())
          .map(([date, calories]) => ({ date, calories }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        // Find trends
        const avgCalories = Math.round(calorieArray.reduce((a, b) => a + b.calories, 0) / calorieArray.length);
        const daysOverTarget = calorieArray.filter(d => d.calories > profile.dailyCalorieTarget).length;
        const daysUnderTarget = calorieArray.filter(d => d.calories < profile.dailyCalorieTarget * 0.8).length;
        
        patterns = [
          { metric: "Average daily calories", value: avgCalories },
          { metric: "Days over target", value: daysOverTarget },
          { metric: "Days under target", value: daysUnderTarget },
          { metric: "Consistency score", value: Math.round((1 - (daysOverTarget + daysUnderTarget) / calorieArray.length) * 100) + "%" },
        ];
        
        insights = `You averaged ${avgCalories} calories per day. ${daysOverTarget} days over target, ${daysUnderTarget} days significantly under.`;
        
        if (avgCalories > profile.dailyCalorieTarget) {
          recommendations.push(`Try to reduce daily intake by ${avgCalories - profile.dailyCalorieTarget} calories to meet your target`);
        }
        if (daysUnderTarget > calorieArray.length * 0.3) {
          recommendations.push("You're under-eating on many days. This can slow metabolism - try to be more consistent");
        }
        break;
      }
      
      case "successful_days": {
        // Find patterns in successful days (met calorie and protein targets)
        const successfulDays = [];
        
        for (const [date, calories] of Object.entries(
          foodLogs.reduce((acc: any, log) => {
            acc[log.date] = (acc[log.date] || { calories: 0, protein: 0, foods: [] });
            acc[log.date].calories += log.totalCalories;
            acc[log.date].protein += log.totalProtein;
            acc[log.date].foods.push(...log.foods.map(f => f.name));
            return acc;
          }, {})
        )) {
          const day = (calories as any);
          const calorieDiff = Math.abs(day.calories - profile.dailyCalorieTarget);
          const proteinDiff = Math.abs(day.protein - profile.proteinTarget);
          
          if (calorieDiff < 100 && proteinDiff < 10) {
            successfulDays.push({
              date,
              calories: day.calories,
              protein: day.protein,
              foods: day.foods,
              score: 100 - (calorieDiff + proteinDiff),
            });
          }
        }
        
        // Find common foods in successful days
        const commonFoods = new Map<string, number>();
        for (const day of successfulDays) {
          for (const food of day.foods) {
            commonFoods.set(food, (commonFoods.get(food) || 0) + 1);
          }
        }
        
        const topFoods = Array.from(commonFoods.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        patterns = successfulDays.slice(0, 5);
        insights = `Found ${successfulDays.length} successful days where you met both calorie and protein targets!`;
        
        if (topFoods.length > 0) {
          recommendations.push(`Your successful days often include: ${topFoods.map(([f]) => f).join(", ")}`);
        }
        if (successfulDays.length < foodLogs.length * 0.3) {
          recommendations.push("Try to plan your meals in advance to hit your targets more consistently");
        }
        break;
      }
    }
    
    return {
      patterns,
      insights,
      recommendations,
    };
  },
});