# Onboarding Fix - January 2025

## Problem
Onboarding wasn't initiating properly - users would see the morning greeting instead of the onboarding flow when first signing up.

## Root Cause
The `getOrCreateDailyThread` function was creating a greeting message for any user with a profile, regardless of whether they had completed onboarding.

## Solution

### 1. Profile Creation on Signup
Reverted `upsertUser` to create a profile with default values:
- Allows profile page to load with placeholders (dashes)
- No need for complex optional field handling
- onboardingCompleted: false

### 2. Thread Creation Changes
Modified both `getOrCreateDailyThread` and `createNewThread`:
```typescript
// Only create greeting if onboarding is complete
if (profile && profile.onboardingCompleted) {
  // Create greeting message
}
```

### 3. Onboarding Flow Updates
- Added `goal_confirmation` step after target weight
- Bob auto-determines goal from weight difference
- User can confirm or override
- Added `dietary_preferences` as final step

### 4. UI Components
- OnboardingQuickResponses already had card-based UI
- Added options for goal_confirmation step
- Dietary preferences step shows options to set or skip

## Result
- Onboarding initiates properly on first sign-in
- Profile page shows with dashes/zeros during onboarding
- No morning greeting until onboarding is complete
- Smooth flow from signup → onboarding → normal usage