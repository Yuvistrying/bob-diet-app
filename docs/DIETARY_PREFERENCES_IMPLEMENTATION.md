# Dietary Preferences Implementation

**Date**: January 2025  
**Status**: Backend complete, Frontend incomplete  
**Feature**: User dietary restrictions and preferences system

## What Was Implemented

### Database Schema
Added new table in `convex/schema.ts`:
```typescript
dietaryPreferences: defineTable({
  userId: v.string(),
  restrictions: v.array(v.string()), // ["vegan", "gluten-free", etc.]
  customNotes: v.optional(v.string()),
  intermittentFasting: v.optional(v.object({
    enabled: v.boolean(),
    startHour: v.number(), // 0-23
    endHour: v.number(),   // 0-23
  })),
  updatedAt: v.number(),
})
.index("by_user", ["userId"])
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

## What's Missing (Frontend)

### Settings Page Component
Need to create `/app/(app)/settings/dietary-preferences/page.tsx`:
```typescript
// TODO: Implement UI for:
// - Checkbox list of common restrictions
// - Custom notes text field
// - Intermittent fasting toggle and time pickers
// - Save/cancel buttons
```

### Menu Item Added But Broken
Added link in settings but page doesn't exist:
```typescript
// In settings/page.tsx
<Link href="/settings/dietary-preferences">
  <Wheat className="h-4 w-4" />
  <span>Dietary Preferences</span>
</Link>
```

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

- [ ] Dietary preferences save correctly
- [ ] Bob respects restrictions in suggestions
- [ ] Fasting window alerts work
- [ ] Settings page allows editing
- [ ] Changes reflect immediately in chat

## Next Steps

1. Create the dietary preferences settings page
2. Add validation for fasting hours
3. Include preset restriction options
4. Add macro target preferences (future)
5. Consider allergy severity levels (future)