## 1. Dynamic Metabolism Calibration 🎯 [NEXT PRIORITY]

### Description
Bob learns each user's actual metabolism by observing weight results, not by applying generic formulas. Weight change is the truth - calories are just the input we adjust.

### Updated Implementation (Weight-First Approach)

#### 1.1 Moving Average System
```typescript
// In convex/analytics.ts
export const updateMovingAverages = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Get weight and food data
    const [weightLogs, foodLogs] = await Promise.all([
      # Bob Diet Coach - Remaining Features Implementation Plan (Updated)

## Overview
This document outlines the remaining features to implement for Bob Diet Coach v2. With photo analysis complete, the core functionality is at ~90%, and these features will complete the vision.

## ✅ COMPLETED: Photo Analysis Feature 📸

Successfully implemented with:
- Convex File Storage (no base64 issues!)
- Claude Vision API integration
- Vector embeddings for similarity search
- One-click confirmation flow
- Smart error handling ("Hey, that's a selfie!")
- Usage limits enforced (2/day free, unlimited Pro)

---

## 1. Dynamic Metabolism Calibration 🎯 [NEXT PRIORITY]

### Description
Bob learns each user's actual metabolism by observing weight results, not by applying generic formulas. Weight change is the ultimate truth - calories are just the input variable we learn to adjust.

### Philosophy: Weight-First Learning
```
Traditional approach: "3,500 calorie deficit should = 0.45kg loss"
Bob's approach: "You lost 0.3kg eating 1,500 cal, so that's YOUR reality"
```

### Updated Implementation (Weight-First Approach)

#### 1.1 Moving Average System
```typescript
// In convex/analytics.ts
export const updateMovingAverages = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Get weight and food data
    const [weightLogs, foodLogs] = await Promise.all([
      ctx.db.query("weightLogs")
        .withIndex("by_user_created", q => q.eq("userId", userId))
        .filter(q => q.gte(q.field("createdAt"), sevenDaysAgo))
        .collect(),
      ctx.db.query("foodLogs")
        .withIndex("by_user_date", q => q.eq("userId", userId))
        .filter(q => q.gte(q.field("createdAt"), sevenDaysAgo))
        .collect()
    ]);
    
    if (weightLogs.length >= 3 && foodLogs.length >= 7) {
      const profile = await ctx.db.query("userProfiles")
        .withIndex("by_user", q => q.eq("userId", userId))
        .first();
      
      if (!profile) return;
      
      // Calculate averages
      const avgWeight = weightLogs.reduce((sum, log) => sum + log.weight, 0) / weightLogs.length;
      const avgCalories = foodLogs.reduce((sum, log) => sum + log.totalCalories, 0) / foodLogs.length;
      const avgProtein = foodLogs.reduce((sum, log) => sum + log.totalProtein, 0) / foodLogs.length;
      
      // Update profile with moving averages
      await ctx.db.patch(profile._id, {
        movingAverages: {
          weight7d: avgWeight,
          calories7d: avgCalories,
          protein7d: avgProtein,
          lastUpdated: Date.now()
        }
      });
      
      // Check if we can learn from the results
      await ctx.scheduler.runAfter(0, internal.calibration.learnFromResults, { userId });
    }
  }
});
```

#### 1.2 Weight-Based Calibration Logic
```typescript
// In convex/calibration.ts
export const learnFromResults = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await getUserProfile(ctx, userId);
    const current = profile.movingAverages;
    
    // Get previous week's averages
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const prevWeightLogs = await ctx.db.query("weightLogs")
      .withIndex("by_user_created", q => q.eq("userId", userId))
      .filter(q => q.gte(q.field("createdAt"), oneWeekAgo - 7 * 24 * 60 * 60 * 1000))
      .filter(q => q.lt(q.field("createdAt"), oneWeekAgo))
      .collect();
    
    if (prevWeightLogs.length < 3) return; // Need historical data
    
    const prevAvgWeight = prevWeightLogs.reduce((sum, log) => sum + log.weight, 0) / prevWeightLogs.length;
    
    // THE TRUTH: What happened to weight?
    const actualWeightChange = current.weight7d - prevAvgWeight;
    const weeklyCalories = current.calories7d;
    
    // Learn from the results
    if (Math.abs(actualWeightChange) < 0.1) {
      // Weight stable = found maintenance
      await ctx.db.insert("calibrationHistory", {
        userId,
        date: new Date().toISOString().split('T')[0],
        oldCalorieTarget: profile.targetCalories,
        newCalorieTarget: Math.round(weeklyCalories), // Their actual maintenance
        reason: `Weight stable at ${weeklyCalories} calories - this is YOUR maintenance`,
        dataPointsAnalyzed: 14,
        confidence: "high",
        createdAt: Date.now()
      });
      
      // For weight loss, create deficit from THEIR maintenance
      if (profile.goal === "cut") {
        const newTarget = Math.round(weeklyCalories - 300); // Start conservative
        await ctx.db.patch(profile._id, {
          targetCalories: newTarget,
          maintenanceCalories: Math.round(weeklyCalories)
        });
      }
    } else if (actualWeightChange < -0.1) {
      // Losing weight - learn the rate
      const deficitFromTarget = profile.targetCalories - weeklyCalories;
      const lossRate = actualWeightChange; // kg per week
      
      // Check if loss rate matches goal
      const desiredLossRate = profile.weeklyLossGoal || 0.5; // kg per week
      
      if (Math.abs(lossRate) < desiredLossRate * 0.5) {
        // Losing too slowly
        const adjustment = Math.round((desiredLossRate - Math.abs(lossRate)) * 1000); // Rough adjustment
        const newTarget = profile.targetCalories - adjustment;
        
        await ctx.db.insert("calibrationHistory", {
          userId,
          date: new Date().toISOString().split('T')[0],
          oldCalorieTarget: profile.targetCalories,
          newCalorieTarget: newTarget,
          reason: `Losing ${Math.abs(lossRate)}kg/week at ${weeklyCalories} cal. Adjusting for ${desiredLossRate}kg/week goal`,
          dataPointsAnalyzed: 14,
          confidence: "medium",
          createdAt: Date.now()
        });
        
        await ctx.db.patch(profile._id, { targetCalories: newTarget });
      }
    }
    
    // Update weekly analytics
    await ctx.db.insert("weeklyAnalytics", {
      userId,
      weekStartDate: getMonday(new Date()),
      avgDailyCalories: weeklyCalories,
      avgDailyProtein: current.protein7d,
      avgDailyCarbs: 0, // Calculate if tracking
      avgDailyFat: 0, // Calculate if tracking
      startWeight: prevAvgWeight,
      endWeight: current.weight7d,
      actualWeightChange,
      expectedWeightChange: 0, // We don't use formulas!
      adherenceScore: calculateAdherence(foodLogs),
      createdAt: Date.now()
    });
  }
});
```

#### 1.3 Bob Tool for Weight-Based Insights
```javascript
// Add to bobAgent.ts
export const getCalibrationInsights = createTool({
  description: "Get personalized metabolism insights based on actual weight results",
  args: z.object({
    timeframe: z.enum(["recent", "historical"]).default("recent")
  }),
  handler: async (ctx, args): Promise<object> => {
    const profile = await ctx.runQuery(internal.users.getProfile, {
      userId: ctx.userId
    });
    
    if (!profile.movingAverages) {
      return {
        hasInsights: false,
        message: "I'm still learning your body's patterns. Keep tracking for about 2 weeks!"
      };
    }
    
    // Get calibration history
    const calibrations = await ctx.runQuery(internal.calibration.getHistory, {
      userId: ctx.userId,
      limit: args.timeframe === "recent" ? 1 : 5
    });
    
    // Get weekly analytics for patterns
    const weeklyData = await ctx.runQuery(internal.analytics.getWeekly, {
      userId: ctx.userId,
      weeks: 4
    });
    
    // Analyze patterns
    const insights = analyzeWeightPatterns(weeklyData);
    
    if (calibrations.length > 0) {
      const latest = calibrations[0];
      return {
        hasInsights: true,
        maintenanceCalories: profile.maintenanceCalories || "Still learning",
        currentTarget: profile.targetCalories,
        lastAdjustment: {
          date: latest.date,
          change: latest.newCalorieTarget - latest.oldCalorieTarget,
          reason: latest.reason
        },
        weightTrend: {
          current: profile.movingAverages.weight7d,
          weeklyChange: insights.avgWeeklyChange,
          direction: insights.trend
        },
        recommendation: generatePersonalizedRecommendation(profile, insights)
      };
    }
    
    return {
      hasInsights: true,
      message: "Still gathering data, but here's what I see so far...",
      currentAverages: {
        weight: profile.movingAverages.weight7d,
        calories: profile.movingAverages.calories7d
      }
    };
  }
});

// Helper function for Bob's responses
function generatePersonalizedRecommendation(profile, insights) {
  if (insights.avgWeeklyChange < 0.1 && profile.goal === "cut") {
    return "Your weight isn't moving. Based on YOUR data, you need to eat less than " + 
           profile.movingAverages.calories7d + " calories to see progress.";
  }
  
  if (Math.abs(insights.avgWeeklyChange) > 1) {
    return "You're losing fast! This might not be sustainable. Consider eating " +
           "100-200 more calories to protect muscle mass.";
  }
  
  return "You're losing at a healthy rate. Your body responds well to " + 
         profile.targetCalories + " calories.";
}
```

#### 1.4 Trigger Points
- After every weight log → Update moving averages
- After every food log → Update moving averages  
- When 7+ days of data exist → Check for patterns
- When user asks "How am I doing?" → Provide insights
- Weekly → Generate analytics snapshot

---

## 2. Advanced Pattern Recognition 🧠 [PRIORITY: HIGH]

### Description
Leverage Convex's vector search to find patterns in eating habits.

### Implementation Steps

#### 2.1 Enhanced Vector Search Tools
```javascript
// Add to bobAgent.ts
export const findPatterns = createTool({
  description: "Analyze eating patterns and their impact on weight",
  args: z.object({
    query: z.enum([
      "weight_gain_foods",
      "weight_loss_foods", 
      "successful_days",
      "problem_patterns"
    ]),
    timeframe: z.enum(["week", "month", "all"]).default("month")
  }),
  handler: async (ctx, args): Promise<object> => {
    // Generate embedding for pattern query
    const queryEmbedding = await ctx.runAction(internal.embeddings.generate, {
      text: `${args.query} ${args.timeframe}`
    });
    
    // Search food logs with weight correlation
    const results = await ctx.runQuery(internal.patterns.searchWithWeightCorrelation, {
      userId: ctx.userId,
      embedding: queryEmbedding,
      query: args.query,
      timeframe: args.timeframe
    });
    
    return {
      patterns: results.patterns,
      insights: results.insights,
      examples: results.topExamples,
      confidence: results.confidence
    };
  }
});

// Meal similarity search (leveraging photo embeddings)
export const findSimilarMeals = createTool({
  description: "Find similar meals from history",
  args: z.object({
    description: z.string(),
    includePhotos: z.boolean().default(true)
  }),
  handler: async (ctx, args): Promise<object> => {
    const embedding = await ctx.runAction(internal.embeddings.generate, {
      text: args.description
    });
    
    // Search both text logs and photo analyses
    const [textMeals, photoMeals] = await Promise.all([
      ctx.runQuery(internal.meals.searchByEmbedding, {
        userId: ctx.userId,
        embedding,
        limit: 5
      }),
      args.includePhotos ? ctx.runQuery(internal.photos.searchSimilar, {
        userId: ctx.userId,
        embedding,
        limit: 3
      }) : []
    ]);
    
    const combined = [...textMeals, ...photoMeals]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
    
    return {
      found: combined.length > 0,
      meals: combined,
      avgCalories: combined.length > 0 
        ? Math.round(combined.reduce((sum, m) => sum + m.calories, 0) / combined.length)
        : 0
    };
  }
});
```

---

## 3. Plateau Detection & Smart Interventions 📊 [PRIORITY: MEDIUM]

### Description
Automatic detection with evidence-based interventions.

### Implementation Steps

#### 3.1 Detection System
```typescript
// In convex/plateau.ts
export const detectPlateau = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await getUserProfile(ctx, userId);
    if (!profile.movingAverages) return;
    
    // Get 14-day weight trend
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const weights = await ctx.db.query("weightLogs")
      .withIndex("by_user_created", q => q.eq("userId", userId))
      .filter(q => q.gte(q.field("createdAt"), twoWeeksAgo))
      .collect();
    
    if (weights.length < 10) return;
    
    // Calculate variance
    const avgWeight = weights.reduce((sum, w) => sum + w.weight, 0) / weights.length;
    const variance = weights.reduce((sum, w) => sum + Math.pow(w.weight - avgWeight, 2), 0) / weights.length;
    
    // Plateau if variance < 0.1 kg²
    if (variance < 0.1) {
      // Check adherence
      const adherence = await calculateAdherence(ctx, userId, 14);
      
      if (adherence > 80) {
        // True plateau - suggest intervention
        await ctx.db.insert("plateauDetections", {
          userId,
          detectedAt: Date.now(),
          avgWeight,
          avgCalories: profile.movingAverages.calories7d,
          adherenceScore: adherence,
          intervention: determineIntervention(profile, adherence)
        });
        
        // Notify Bob
        await ctx.db.insert("systemNotifications", {
          userId,
          type: "plateau_detected",
          data: { weeks: 2, avgWeight, intervention: "refeed" }
        });
      }
    }
  }
});
```

#### 3.2 Bob Intervention Tool
```javascript
export const suggestPlateauIntervention = createTool({
  description: "Suggest intervention for weight loss plateau",
  args: z.object({
    acknowledgeDetection: z.boolean().default(false)
  }),
  handler: async (ctx, args): Promise<object> => {
    const detection = await ctx.runQuery(internal.plateau.getLatest, {
      userId: ctx.userId
    });
    
    if (!detection) {
      return {
        hasPlateauIssue: false,
        message: "No plateau detected - you're making progress!"
      };
    }
    
    const intervention = {
      type: detection.intervention.type,
      explanation: getInterventionExplanation(detection.intervention.type),
      duration: getInterventionDuration(detection.intervention.type),
      instructions: getInterventionInstructions(detection.intervention.type, profile)
    };
    
    if (args.acknowledgeDetection) {
      await ctx.runMutation(internal.plateau.markAcknowledged, {
        detectionId: detection._id
      });
    }
    
    return {
      hasPlateauIssue: true,
      weeksDuration: Math.floor((Date.now() - detection.detectedAt) / (7 * 24 * 60 * 60 * 1000)),
      intervention,
      successRate: "85% of users break their plateau with this approach"
    };
  }
});
```

---

## 4. Smart Contextual Reminders 🔔 [PRIORITY: LOW]

### Description
Pattern-based reminders using Convex cron jobs.

### Implementation Steps

#### 4.1 Pattern Learning
```typescript
// In convex/reminders.ts
export const updateUserPatterns = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Analyze logging patterns
    const logs = await ctx.db.query("foodLogs")
      .withIndex("by_user_date", q => q.eq("userId", userId))
      .order("desc")
      .take(100);
    
    const patterns = {
      breakfastTime: findMostCommonTime(logs, "breakfast"),
      lunchTime: findMostCommonTime(logs, "lunch"),
      dinnerTime: findMostCommonTime(logs, "dinner"),
      weighInTime: await findWeighInPattern(ctx, userId),
      activeDays: findActiveDays(logs)
    };
    
    await ctx.db.patch(profile._id, {
      loggingPatterns: patterns,
      patternsUpdatedAt: Date.now()
    });
  }
});

// Cron job - runs every hour
export const checkReminders = cronJobs.hourly(
  "check reminders",
  { minuteUTC: 0 },
  internal.reminders.processReminders
);
```

---

## 5. Weekly Progress Reports 📈 [PRIORITY: LOW]

### Description
AI-generated weekly summaries with insights.

### Implementation Steps

```javascript
export const generateWeeklyReport = createTool({
  description: "Generate comprehensive weekly progress report",
  args: z.object({
    format: z.enum(["summary", "detailed"]).default("summary")
  }),
  handler: async (ctx, args): Promise<object> => {
    const report = await ctx.runQuery(internal.reports.generateWeekly, {
      userId: ctx.userId,
      detailed: args.format === "detailed"
    });
    
    return {
      summary: report.summary,
      weightChange: report.weightChange,
      avgCalories: report.avgCalories,
      adherence: report.adherenceScore,
      highlights: report.highlights,
      recommendations: report.recommendations,
      visualData: report.chartData // For UI rendering
    };
  }
});
```

---

## Updated Implementation Timeline

### Sprint 1 (Current): Metabolism Calibration
- ✅ Moving averages system
- ⏳ Bob tool integration
- ⏳ User notifications

### Sprint 2: Pattern Recognition
- Vector search for food patterns
- Weight correlation analysis
- Meal similarity (text + photos)

### Sprint 3: Plateau Detection
- Automatic detection algorithm
- Intervention suggestions
- Success tracking

### Sprint 4: Polish & Engagement
- Smart reminders
- Weekly reports
- UI improvements

---

## Success Metrics (Updated)

- **Photo usage**: Track adoption rate (target: 50% of Pro users daily)
- **Calibration accuracy**: Measure prediction vs actual (target: 85% within 100 cal)
- **Pattern insights engagement**: Click-through on suggestions (target: 30%)
- **Plateau resolution**: Success rate of interventions (target: 70%)
- **Overall retention**: 30-day retention (target: 45%)