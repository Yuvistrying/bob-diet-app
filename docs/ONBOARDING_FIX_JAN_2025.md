# Onboarding Fix - July 2025

## Problem
Onboarding wasn't initiating properly - users would see the morning greeting instead of the onboarding flow when first signing up.

## Root Cause
The `getOrCreateDailyThread` function was checking `if (profile && profile.onboardingCompleted)` to create greetings, but this condition was true even when `onboardingCompleted` was `false` or `undefined`, causing it to show morning greetings instead of onboarding messages.

## Solution

### 1. Profile Creation on Signup
- NO profile is created during user signup (`upsertUser`)
- Profile page shows "Loading profile..." when no profile exists
- Profile is only created after onboarding completes via `createProfileFromOnboarding`

### 2. Thread Creation Logic Fix
Modified both `getOrCreateDailyThread` and `createNewThread` to properly detect onboarding state:

```typescript
// Check if onboarding is needed
const needsOnboarding = !profile || profile.onboardingCompleted !== true;

if (needsOnboarding) {
  // Create onboarding welcome message
  await ctx.db.insert("chatHistory", {
    userId: identity.subject,
    role: "assistant" as const,
    content: "Hey there! I'm Bob, your personal diet coach 🎯\n\nI'm here to help you reach your health goals. Let's get to know each other!\n\nWhat's your name?",
    timestamp: Date.now(),
    metadata: { threadId },
  });
} else if (profile) {
  // Create morning greeting
}
```

### 3. Onboarding Flow Steps
1. **welcome** - Initial greeting from Bob
2. **name** - User provides their name
3. **current_weight** - Current weight with unit selection (kg/lbs)
4. **target_weight** - Goal weight with unit selection
5. **goal_confirmation** - Bob auto-infers goal from weight difference, user confirms
6. **height_age** - Height (with cm/ft toggle) and age input
7. **gender** - Male/Female/Prefer not to say selection
8. **activity_level** - Sedentary/Light/Moderate/Very Active
9. **display_mode** - Standard (show numbers) or Stealth mode
10. **dietary_preferences** - Set restrictions/preferences or skip
11. **complete** - Profile created, onboarding marked complete

### 4. UI Components
- `OnboardingQuickResponses` component provides card-based UI for each step
- Cards appear below chat when:
  - Onboarding is not complete
  - Last message is from assistant (Bob)
  - Not currently streaming
- Each step has appropriate input types (buttons, number inputs, toggles)

### 5. Key Implementation Details
- Chat page no longer tries to create its own onboarding messages
- All greeting/onboarding messages created server-side in thread creation
- `onboardingStatus.currentStep` tracks progress through the flow
- `saveOnboardingProgress` mutation updates the current step
- Profile created only after all steps complete

## Result
- Onboarding properly initiates for new users with Bob's welcome message
- Profile page shows "Loading profile..." during onboarding
- UI cards appear for easy step completion
- No morning greeting until onboarding is fully complete
- Smooth flow from signup → onboarding → daily usage