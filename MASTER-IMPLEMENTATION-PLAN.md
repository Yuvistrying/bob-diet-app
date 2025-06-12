
# Bob Diet Coach - Master Implementation Plan 🏆

## 1. Project Overview & Vision

Build an AI-powered diet coaching SaaS where users log food and weight through natural conversation with "Bob" - an intelligent Claude 4 agent that learns each user's unique metabolism and provides truly personalized coaching based on real results, not generic formulas.

### Core Philosophy

**Chat-First Experience**: Everything happens through natural conversation. Users talk to Bob like a knowledgeable friend who remembers their entire diet journey.

### Key Differentiators

1. **Adaptive Learning** - Bob calibrates to each user's actual metabolism
1. **Conversational UX** - No forms, just natural chat
1. **Stealth Mode** - For users who don't want to see numbers
1. **Real Results** - Adjusts based on actual weight changes, not formulas

## 2. Technical Architecture

### Core Stack

- **Frontend**: React Router v7 (keeping your working starter)
- **UI**: TailwindCSS v4 + shadcn/ui
- **Backend**: Convex (real-time database + serverless functions)
- **AI**: Claude 4 via Vercel AI SDK
  - Claude 4 Sonnet (90% - daily coaching)
  - Claude 4 Opus (10% - complex analysis & photo analysis)
- **Auth**: Clerk (already integrated)
- **Payments**: Polar.sh (already integrated)
- **Deployment**: Vercel

### Why This Architecture

- **No risky migrations** - Build on proven foundation
- **Real-time everything** - Convex makes the app feel instant
- **Streaming AI responses** - Natural conversation flow
- **Smart model selection** - Cost-effective AI usage

## 3. Monetization Strategy 💰

### Freemium Model

#### Free Tier Limits

- **5 AI chats per day** (resets at midnight user's timezone)
- **2 photo analyses per day**
- **Basic progress tracking**
- **No weekly reports**
- **No advanced calibration**

#### Pro Tier ($9.99/month)

- **Unlimited AI conversations**
- **Unlimited photo analysis**
- **Advanced metabolism calibration**
- **Weekly PDF reports**
- **WhatsApp integration** (future)
- **Priority support**
- **Export all data**

### Usage Tracking Implementation

```typescript
// convex/usage.ts
export const checkAndTrack = mutation({
  args: {
    userId: v.string(),
    usageType: v.string(), // 'chat' or 'photoAnalysis'
    modelUsed: v.string()  // 'sonnet' or 'opus'
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", q => q.eq("userId", args.userId))
      .first();
    
    // Pro users have no limits
    if (subscription?.status === 'active') {
      await trackUsage(ctx, args.userId, today, args.usageType, args.modelUsed);
      return { allowed: true, unlimited: true };
    }
    
    // Free tier limits
    const limits = {
      chat: 5,
      photoAnalysis: 2
    };
    
    const usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user_date", q => 
        q.eq("userId", args.userId).eq("date", today)
      )
      .first();
    
    const currentCount = usage?.[`${args.usageType}Count`] || 0;
    
    if (currentCount >= limits[args.usageType]) {
      return {
        allowed: false,
        message: `You've reached your daily limit of ${limits[args.usageType]} ${args.usageType}s. Upgrade to Pro for unlimited coaching!`,
        showUpgrade: true
      };
    }
    
    // Track and allow
    await trackUsage(ctx, args.userId, today, args.usageType, args.modelUsed);
    
    return {
      allowed: true,
      remaining: limits[args.usageType] - currentCount - 1,
      limit: limits[args.usageType]
    };
  }
});
```

### Conversion Triggers

1. **Hit Daily Limit**
   
   ```
   Bob: "You've used all 5 daily chats! 🚀 Upgrade to Pro for unlimited coaching and help reaching your goals faster!"
   [Upgrade Now] [Maybe Later]
   ```
1. **Photo Analysis Limit**
   
   ```
   Bob: "That's your 2nd photo today! Pro members can analyze unlimited meals. Want to upgrade?"
   ```
1. **Calibration Tease**
   
   ```
   Bob: "I've noticed you might benefit from metabolism calibration, but that's a Pro feature. It could help you break through this plateau!"
   ```
1. **Weekly Report Preview**
   
   ```
   Bob: "You had a great week! Pro members get detailed PDF reports every Sunday. Want to see yours?"
   ```

## 4. Core Features

### 4.1 Chat-First Onboarding

The entire onboarding happens through conversation with Bob:

```javascript
// Onboarding Flow
Bob: "Hi there! I'm Bob, your personal AI diet coach. What's your name?"
User: "Sarah"
Bob: "Nice to meet you, Sarah! What's your current weight and goal?"
User: "I'm 85kg and want to get to 75kg"
Bob: "Great goal! That's totally achievable. How tall are you and what's your age?"
User: "170cm and 32 years old"
Bob: "Perfect! One more important question - how do you prefer to track your progress?

**Option 1: See the numbers** 📊
Track calories, see exact amounts, detailed metrics

**Option 2: Focus on habits** 🎯  
Progress bars and guidance without the math

Which feels right for you?"
```

### 4.2 Stealth Mode (No Numbers)

Revolutionary feature for users with difficult relationships with numbers:

#### Standard Mode

```
User: "I had a chicken salad"
Bob: "Great choice! That's about 350 calories with 35g protein. You have 1,150 calories left today."
```

#### Stealth Mode

```
User: "I had a chicken salad"
Bob: "Excellent choice! Plenty of protein and nutrients. You're on track for a balanced day!"

Dashboard shows: Progress bar at 40% filled (no numbers)
```

### 4.3 Customizable Macro Display

Users can control what they see:

```javascript
// Via chat
User: "Stop showing me carbs and fat numbers"
Bob: "You got it! I'll just show calories and protein from now on."

// Or via settings
Nutrition Display:
☑️ Calories
☑️ Protein
☐ Carbs  
☐ Fats
```

### 4.4 Smart Calibration System

Bob learns each user's unique metabolism:

```javascript
// After 2 weeks of data
Bob: "Sarah, I've been analyzing your progress. You've been averaging 1,500 calories daily but only lost 0.2kg this week instead of the expected 0.5kg.

Your metabolism seems to run slower than average. I recommend adjusting your target to 1,350 calories for steady progress. Sound good?"

// Calibration triggers:
- Plateau for 5+ days
- Weight loss significantly different from expected
- Every 2 weeks as safety check
- Major milestones (every 5kg lost)
```

### 4.5 Photo Analysis

```javascript
User: [uploads photo of food]
Bob: "I see grilled salmon with roasted vegetables and quinoa! 
      Approximately:
      - 520 calories
      - 42g protein
      - 35g carbs
      - 18g fat
      
      Should I log this as your dinner?"
```

### 4.6 Daily Check-ins & Reminders

```javascript
// Morning (via email, later WhatsApp)
Bob: "Good morning Sarah! Ready for your daily weigh-in? 📊"

// If no response by 10am
Bob: "No rush! When you get a chance, I'd love to get today's weight 😊"

// Evening wrap-up
Bob: "Great job today! You hit your protein target and stayed within calories. 
      Tomorrow, try to add more vegetables at lunch. Sleep well! 🌙"
```

## 5. Complete Implementation Plan

### Phase 1: Foundation Setup (Day 1)

```bash
# 1. Clone your React Router starter
git clone [your-starter-repo]
cd bob-diet-coach
npm install --legacy-peer-deps

# 2. Set up environment variables
cp .env.example .env.local
# Add all keys (Convex, Clerk, Polar, Anthropic)

# 3. Initialize Convex
npx convex dev
# Create new project: "bob-diet-coach"

# 4. Test existing functionality
# Ensure auth → payment → basic chat works
```

### Phase 2: Database Schema (Day 1-2)

```typescript
// convex/schema.ts - Complete schema
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Keep existing tables (users, subscriptions, etc.)
  
  // User profiles with goals
  userProfiles: defineTable({
    userId: v.string(),
    name: v.string(),
    currentWeight: v.number(),
    targetWeight: v.number(),
    height: v.number(),
    age: v.number(),
    gender: v.string(),
    activityLevel: v.string(),
    dailyCalorieTarget: v.number(),
    proteinTarget: v.number(),
    preferredUnits: v.string(),
    timezone: v.string(),
    onboardingCompleted: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string()
  }).index("by_user", ["userId"]),

  // User preferences including stealth mode
  userPreferences: defineTable({
    userId: v.string(),
    displayMode: v.string(), // "standard" or "stealth"
    showCalories: v.boolean(),
    showProtein: v.boolean(),
    showCarbs: v.boolean(),
    showFats: v.boolean(),
    reminderSettings: v.object({
      weighInReminder: v.boolean(),
      mealReminders: v.boolean(),
      reminderTimes: v.object({
        weighIn: v.string(),
        breakfast: v.string(),
        lunch: v.string(),
        dinner: v.string()
      })
    }),
    language: v.string(),
    darkMode: v.boolean(),
    updatedAt: v.string()
  }).index("by_user", ["userId"]),

  // Weight tracking
  weightLogs: defineTable({
    userId: v.string(),
    weight: v.number(),
    unit: v.string(),
    date: v.string(),
    notes: v.optional(v.string()),
    createdAt: v.string()
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_created", ["userId", "createdAt"]),

  // Food logging
  foodLogs: defineTable({
    userId: v.string(),
    date: v.string(),
    meal: v.string(),
    description: v.string(),
    foods: v.array(v.object({
      name: v.string(),
      quantity: v.string(),
      calories: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number()
    })),
    totalCalories: v.number(),
    totalProtein: v.number(),
    totalCarbs: v.number(),
    totalFat: v.number(),
    photoUrl: v.optional(v.string()),
    aiEstimated: v.boolean(),
    confidence: v.string(),
    createdAt: v.string()
  })
  .index("by_user_date", ["userId", "date"])
  .index("by_user_meal_date", ["userId", "meal", "date"]),

  // Usage tracking for freemium
  usageTracking: defineTable({
    userId: v.string(),
    date: v.string(),
    aiChatsCount: v.number(),
    photoAnalysisCount: v.number(),
    opusCallsCount: v.number(),
    sonnetCallsCount: v.number(),
    limitReachedAt: v.optional(v.string())
  }).index("by_user_date", ["userId", "date"]),

  // Calibration history
  calibrationHistory: defineTable({
    userId: v.string(),
    date: v.string(),
    oldTarget: v.number(),
    newTarget: v.number(),
    reason: v.string(),
    dataPoints: v.number(),
    confidence: v.string(),
    createdAt: v.string()
  }).index("by_user", ["userId"]),

  // Analytics for progress
  weeklyAnalytics: defineTable({
    userId: v.string(),
    weekStartDate: v.string(),
    avgDailyCalories: v.number(),
    avgDailyDeficit: v.number(),
    startWeight: v.number(),
    endWeight: v.number(),
    actualWeightChange: v.number(),
    expectedWeightChange: v.number(),
    adherenceScore: v.number(),
    createdAt: v.string()
  }).index("by_user_week", ["userId", "weekStartDate"]),

  // Onboarding progress
  onboardingProgress: defineTable({
    userId: v.string(),
    step: v.string(),
    responses: v.any(),
    completed: v.boolean(),
    startedAt: v.string(),
    completedAt: v.optional(v.string())
  }).index("by_user", ["userId"])
});
```

### Phase 3: Bob's AI Brain (Day 2-3)

[Complete convex/http.ts implementation with all tools and calibration logic - included in previous response]

### Phase 4: Core UI Components (Day 3-4)

[Complete chat UI, onboarding flow, and dashboard components - included in previous response]

### Phase 5: Testing & Polish (Day 5)

1. **Onboarding Flow Test**
- New user → Chat onboarding → Profile created
- Stealth mode selection works
- Preferences saved correctly
1. **Daily Usage Test**
- Weight logging → Database update → UI reflects
- Food logging → Calories tracked → Progress shown
- Hit free tier limit → Upgrade prompt appears
1. **Calibration Test**
- After 14 days → Calibration suggestion
- Plateau detected → Bob offers help
- New targets → Applied correctly

## 6. Mobile UI Screens

### Screen 1: Chat Dashboard

- 6 status cards (goal, calories, weight, protein, carbs, fats)
- Chat with Bob (primary interface)
- Quick action buttons

### Screen 2: Food Diary

- Today's meals with photos
- Calorie/macro breakdown
- Edit capabilities

### Screen 3: Weight Tracking

- Progress chart
- Daily weight list
- Trend analysis

### Screen 4: Profile & Settings

- Personal info
- Display preferences (standard/stealth)
- Macro visibility toggles
- Subscription management

## 7. Launch Strategy

### Week 1: MVP

- Basic chat functioning
- Food/weight logging working
- Freemium limits enforced
- Onboarding flow complete

### Week 2: Enhancement

- Photo analysis integrated
- Calibration system active
- Email reminders working
- UI animations polished

### Week 3: Marketing Prep

- Landing page ready
- Demo video recorded
- Blog posts written
- Social media planned

### Week 4: Launch!

- ProductHunt submission
- Reddit posts (r/loseit, r/fitness, r/getdisciplined)
- Twitter/X announcement
- Email to wait list

## 8. Future Enhancements

### Priority 1: WhatsApp Integration (Month 2)

- Text Bob directly on WhatsApp
- Photo analysis via WhatsApp
- Daily summaries sent automatically

### Priority 2: Mobile App (Month 3)

- React Native wrapper
- Push notifications
- Offline mode with sync
- Native camera integration

### Priority 3: Advanced Features (Month 4+)

- Barcode scanning
- Restaurant menu analysis
- Meal planning & shopping lists
- Social features (optional)
- Integration with fitness trackers

## 9. Success Metrics

### User Engagement

- Daily active users: 60%+
- Food logging frequency: 2.5+ times/day
- Weight logging: 5+ times/week
- 30-day retention: 40%+

### Business Metrics

- Free to paid conversion: 20%+
- Monthly churn: <5%
- Average revenue per user: $7+
- CAC payback: <3 months

### Health Outcomes

- Users reaching goal: 70%+
- Average weekly loss: 0.5-1kg
- Calibration success rate: 85%+

-----

# What You Can Archive/Remove

## ✅ Keep These Documents:

1. **Youtube setup starter kit transcription** - Still useful for setup reference
1. **Chat flow diagram** - Good technical reference
1. **Diet saas ui design** - UI mockups still valid

## 🗑️ Can Archive/Remove These:

1. **Site structure** - Superseded by this master doc
1. **Calorie disclaimer and awareness** - Integrated into master doc
1. **Updated onboarding with stealth mode** - Integrated into master doc
1. **Down the road whatsapp integration** - Moved to "Future Enhancements"
1. **User macro and calorie preferences** - Integrated into master doc
1. **Reminder system mail and whatsapp** - Integrated into master doc
1. **Update rect router v7 implementations** - Outdated, replaced with current implementation
1. **debugg strategy** - Can keep for reference but not critical
1. **Bob holy grail latest implementation version** - Replaced by this master doc

## 📁 Final Document Structure:

```
project-docs/
├── MASTER-IMPLEMENTATION-PLAN.md (this document)
├── reference/
│   ├── youtube-setup-guide.md
│   ├── chat-flow-diagram.md
│   └── ui-design-mockups.md
└── archive/
    └── [old implementation attempts]
```

This master document now contains EVERYTHING you need to build Bob, including the complete monetization strategy with freemium limits! 🚀 