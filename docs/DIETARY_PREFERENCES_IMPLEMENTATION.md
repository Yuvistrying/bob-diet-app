# Dietary Preferences Implementation

**Date**: January 2025  
**Status**: COMPLETE - Backend, Frontend, and Bob integration all working  
**Feature**: User dietary restrictions and preferences system

## What Was Implemented

### Database Schema

Added new table in `convex/schema.ts`:

```typescript
dietaryPreferences: defineTable({
  userId: v.string(),
  restrictions: v.array(v.string()), // ["vegan", "gluten-free", etc.]
  customNotes: v.optional(v.string()),
  intermittentFasting: v.optional(
    v.object({
      enabled: v.boolean(),
      startHour: v.number(), // 0-23
      endHour: v.number(), // 0-23
    }),
  ),
  updatedAt: v.number(),
}).index("by_user", ["userId"]);
```

### Backend Functions

Created `convex/dietaryPreferences.ts` with:

- `getUserPreferences` - Query to fetch preferences
- `updatePreferences` - Mutation to save preferences
- `addRestriction` - Add single restriction
- `removeRestriction` - Remove single restriction
- `toggleIntermittentFasting` - Enable/disable IF

### Chat Integration

Preferences are now included in Bob's context:

```typescript
// In stream-v2/route.ts
const dietaryPreferences = await convexClient.query(
  api.dietaryPreferences.getUserPreferences
);

// In prompts.ts
DIETARY RESTRICTIONS: ${dietaryPreferences.restrictions.join(", ")}
Fasting window: ${startHour}:00-${endHour}:00
```

### Bob's Behavior Changes

Bob now:

- Considers dietary restrictions when suggesting meals
- Respects intermittent fasting windows
- Includes dietary info in context
- Provides appropriate meal suggestions

## Frontend Implementation (COMPLETE)

### DietaryPreferencesCard Component

Created `/app/components/DietaryPreferencesCard.tsx` with:
- Badge-based restriction selection
- Custom notes textarea
- Intermittent fasting controls with time pickers
- Edit/Save/Cancel buttons matching profile page style

### Profile Page Integration

Added to `/app/(app)/profile/page.tsx`:
- Imported and rendered DietaryPreferencesCard
- Placed between Service Preferences and Account Actions
- Fully integrated with profile page styling

## Bob's Conversational Updates (COMPLETE)

### New Tools Added

In `/convex/tools/index.ts`, added three new tools:

1. **updateDietaryRestrictions** - Add/remove dietary restrictions
2. **setIntermittentFasting** - Update fasting window
3. **addCustomDietaryNote** - Add custom dietary notes

### Prompt Updates

Updated `/convex/prompts.ts` to recognize dietary changes:
- "I'm not vegan anymore" → Remove vegan restriction
- "I'm diabetic now" → Add diabetic restriction  
- "I want to do 16:8 fasting" → Set fasting window
- "I'm allergic to shellfish" → Add custom note

## Example Data Structure

```typescript
{
  userId: "user_123",
  restrictions: ["vegan", "gluten-free", "nut-free"],
  customNotes: "Allergic to shellfish, prefer organic",
  intermittentFasting: {
    enabled: true,
    startHour: 12,  // noon
    endHour: 20     // 8 PM
  },
  updatedAt: 1704067200000
}
```

## How Bob Uses This

### Meal Suggestions

```typescript
// Vegan user asks "what should I eat?"
Bob: "3 vegan options:
- Quinoa Buddha bowl (400 cal, 15g protein)
- Lentil curry with rice (450 cal, 18g protein)
- Chickpea salad wrap (350 cal, 14g protein)"
```

### Fasting Window Respect

```typescript
// User at 10 AM with 12-8 PM eating window
User: "I'm hungry"
Bob: "You're still in your fasting window (ends at 12:00).
How about some water or black coffee?"
```

## Implementation Priority

1. **High Priority**: Create the settings page UI
2. **Medium Priority**: Add common dietary restrictions list
3. **Low Priority**: Advanced features like macro targets

## Testing Checklist

- [x] Dietary preferences save correctly from profile page
- [x] Bob respects restrictions in suggestions
- [x] Fasting window alerts work
- [x] Profile page allows editing preferences
- [x] Changes reflect immediately in chat
- [x] Bob can update preferences via conversation
- [x] Updates sync across devices in real-time

## Integration Points

1. **Profile Page**: Full UI for viewing and editing all preferences
2. **Bob Chat**: Natural language updates via new tools
3. **Real-time Sync**: All changes immediately reflected everywhere
4. **Meal Suggestions**: Bob considers all restrictions and fasting windows

## Future Enhancements

1. Add macro target preferences (protein/carb/fat goals)
2. Consider allergy severity levels
3. Add meal preference patterns (e.g., "prefer salads for lunch")
4. Time-based preferences (e.g., "no carbs after 6pm")
