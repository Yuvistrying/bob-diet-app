# Bob Diet Coach - Daily Game Plan 🎯

## Current Issues to Fix Today

### 🔴 Critical Issues

1. **Chat History Persistence**
   - **Problem**: Messages disappear when switching tabs
   - **Solution**: Implement proper chat history storage in Convex
   - **Priority**: HIGH - This breaks the core experience

2. **Sign-up Flow**
   - **Problem**: Requires payment upfront, deterring users
   - **Solution**: Remove payment requirement from onboarding, add after trial
   - **Priority**: HIGH - Blocking user acquisition

3. **Bob's Auto-logging Behavior**
   - **Problem**: Logs food without confirmation
   - **Solution**: Add confirmation step before logging
   - **Priority**: HIGH - Causes incorrect data

### 🟡 Medium Priority Issues

4. **Onboarding Flow**
   - **Problem**: Too rigid, form-like experience
   - **Solution**: Make conversational with Bob guiding through chat
   - **Priority**: MEDIUM - Affects user experience

5. **Diary Manual Logging**
   - **Problem**: No direct logging, only redirects to chat
   - **Solution**: Add quick-add buttons for freemium users
   - **Priority**: MEDIUM - Important for freemium model

6. **Calorie Counting Bugs**
   - **Problem**: Incorrect calculations in UI components
   - **Solution**: Fix calculation logic and display
   - **Priority**: MEDIUM - Affects data accuracy

7. **Image Upload**
   - **Problem**: Not implemented yet
   - **Solution**: Add file upload with Claude 4 vision analysis
   - **Priority**: MEDIUM - Key feature

## Today's Implementation Plan

### Phase 1: Fix Chat Persistence (2-3 hours)

```typescript
// 1. Update convex/schema.ts to ensure chatHistory is properly indexed
chatHistory: defineTable({
  userId: v.string(),
  sessionId: v.string(), // Add session tracking
  role: v.string(),
  content: v.string(),
  timestamp: v.number(),
  metadata: v.optional(v.object({
    foodLogId: v.optional(v.id("foodLogs")),
    weightLogId: v.optional(v.id("weightLogs")),
    actionType: v.optional(v.string())
  }))
})
.index("by_user_session", ["userId", "sessionId"])
.index("by_user_timestamp", ["userId", "timestamp"])

// 2. Create chat session management
export const getOrCreateSession = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Get today's session or create new
    const today = new Date().toISOString().split('T')[0];
    const sessionId = `${identity.subject}_${today}`;
    
    return sessionId;
  }
});

// 3. Update chat.tsx to load history on mount
useEffect(() => {
  loadChatHistory();
}, []);
```

### Phase 2: Fix Sign-up Flow (1-2 hours)

```typescript
// 1. Remove payment gate from onboarding
// In app/routes/app-layout.tsx, comment out subscription check:
// if (!subscriptionStatus?.hasActiveSubscription) {
//   throw redirect("/subscription-required");
// }

// 2. Add trial period logic
export const checkUserAccess = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { hasAccess: false };
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();
    
    const trialDays = 7;
    const trialEnd = new Date(profile.createdAt);
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    
    return {
      hasAccess: true,
      isTrialing: new Date() < trialEnd,
      trialEndsAt: trialEnd,
      daysLeft: Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24)))
    };
  }
});
```

### Phase 3: Add Confirmation for Food Logging (1-2 hours)

```typescript
// Update Bob's system prompt
const systemPrompt = `
When user mentions food, ALWAYS ask for confirmation before logging:
- Parse the food details
- Show what you understood
- Ask "Should I log this as [meal type]?"
- Only log after explicit confirmation

Example:
User: "I had eggs and toast for breakfast"
Bob: "Got it! That sounds like:
- 2 eggs (scrambled/fried?) - about 180 calories
- 2 slices of toast - about 140 calories
Total: ~320 calories, 20g protein

Should I log this as your breakfast?"
`;

// Add confirmation state to prevent auto-logging
const CONFIRMATION_NEEDED = "CONFIRM_FOOD_LOG";
```

### Phase 4: Conversational Onboarding (2-3 hours)

```typescript
// Replace rigid onboarding with chat-based flow
// In chat.tsx, detect new users and start conversational onboarding

const conversationalOnboarding = {
  steps: [
    { key: "name", prompt: "Hey! I'm Bob 👋 What should I call you?" },
    { key: "weight", prompt: "Nice to meet you, {name}! What's your current weight?" },
    { key: "goal", prompt: "Got it! Are you looking to lose weight, gain muscle, or maintain?" },
    { key: "stealth", prompt: "Would you like to see all the numbers (calories, macros) or focus on habits?" }
  ],
  
  parseResponse: (step, response) => {
    // Natural language parsing for each step
    switch(step) {
      case "weight":
        return extractWeight(response); // "I weigh 180 lbs" → { weight: 180, unit: "lbs" }
      case "goal":
        return extractGoal(response); // "I want to lose weight" → "cut"
      // etc...
    }
  }
};
```

### Phase 5: Add Quick Logging to Diary (1 hour)

```typescript
// In diary.tsx, add manual input modal
const QuickAddModal = () => {
  const [showModal, setShowModal] = useState(false);
  const [quickAddType, setQuickAddType] = useState<"food" | "weight">();
  
  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent>
        {quickAddType === "food" ? (
          <FoodQuickAdd onSave={handleSave} />
        ) : (
          <WeightQuickAdd onSave={handleSave} />
        )}
      </DialogContent>
    </Dialog>
  );
};

// Simple form for freemium users
const FoodQuickAdd = () => (
  <form>
    <Input placeholder="What did you eat?" />
    <Input type="number" placeholder="Calories (estimate)" />
    <Button type="submit">Log Food</Button>
  </form>
);
```

### Phase 6: Fix Calorie Calculations (1 hour)

```typescript
// Fix the calculation bugs in components
// Ensure all calculations use consistent data types

const calculateDailyTotal = (logs: FoodLog[]) => {
  return logs.reduce((total, log) => {
    // Ensure numbers, not strings
    return {
      calories: total.calories + (Number(log.totalCalories) || 0),
      protein: total.protein + (Number(log.totalProtein) || 0),
      carbs: total.carbs + (Number(log.totalCarbs) || 0),
      fat: total.fat + (Number(log.totalFat) || 0)
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
};

// Add validation when saving
export const logFood = mutation({
  args: {
    totalCalories: v.number(),
    // ensure all are numbers
  },
  handler: async (ctx, args) => {
    // Validate before saving
    if (isNaN(args.totalCalories)) {
      throw new Error("Invalid calorie value");
    }
    // ... save
  }
});
```

## Testing Checklist

- [ ] Chat history persists across tab switches
- [ ] New users can sign up without payment
- [ ] Trial period shows correctly
- [ ] Bob asks for confirmation before logging food
- [ ] Onboarding feels conversational, not like a form
- [ ] Diary has quick-add buttons that work
- [ ] Calorie calculations are accurate
- [ ] All numbers display correctly in UI

## Prompts for Claude Code

### 1. Fix Chat Persistence
```
The chat history is not persisting when users switch tabs. Currently using local state in chat.tsx but need to store in Convex database. Update the implementation to:
1. Save all messages to chatHistory table
2. Load history on component mount
3. Maintain message order and session continuity
4. Handle real-time updates
```

### 2. Remove Payment Gate
```
Currently the app requires payment during sign-up. Change this to:
1. Allow free sign-up with 7-day trial
2. Track trial status in user profile
3. Show trial days remaining in UI
4. Only require payment after trial ends
5. Keep existing Polar integration for when needed
```

### 3. Add Food Confirmation
```
Bob currently auto-logs food without confirmation. Update the AI logic to:
1. Parse food mentions
2. Show understanding of what user ate
3. Ask for explicit confirmation
4. Only log after user confirms
5. Handle "no" responses appropriately
```

### 4. Conversational Onboarding
```
Replace the current rigid onboarding flow with a conversational approach through Bob:
1. Detect new users in chat
2. Guide through profile setup conversationally
3. Parse natural language responses
4. Save profile data progressively
5. Make it feel like a friendly chat, not a form
```

## Success Metrics for Today

✅ **Must Complete**:
- Chat history works properly
- Sign-up doesn't require payment
- Bob asks for confirmation

🎯 **Nice to Have**:
- Conversational onboarding started
- Quick-add in diary working
- Calorie bugs fixed

## Notes for Tomorrow

1. **Image Upload**: Implement file upload with vision API
2. **Freemium Limits**: Add usage tracking (5 chats, 2 photos daily)
3. **Email Reminders**: Set up daily check-in emails
4. **Calibration Logic**: Build metabolism learning system
5. **UI Polish**: Animations, transitions, better mobile experience

---

Remember: Focus on the critical issues first. A working product with some rough edges is better than a perfect product that doesn't work! 🚀 