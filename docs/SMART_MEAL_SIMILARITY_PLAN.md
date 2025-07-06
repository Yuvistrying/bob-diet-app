# Smart Meal Similarity Feature Plan

**Status**: Planned  
**Current State**: Basic embedding system exists but underutilized  
**Goal**: Make Bob proactively use meal history to speed up logging

## Current Problems

1. **Hidden Feature** - Users don't know similarity search exists
2. **Never Proactive** - Bob waits for specific queries instead of suggesting
3. **Poor Intent Detection** - "What similar meals..." gets interpreted as progress query
4. **Wasted Data** - We're embedding everything but barely using it

## Proposed Solution

### 1. Proactive Similarity Suggestions

When user mentions food, Bob should automatically:
```
User: "I had grilled chicken"
Bob: "Let me confirm:
• Grilled chicken breast (165 cal, 31g protein)

Is this correct? 

📊 Similar meals you've logged:
- Monday: Grilled chicken with rice (420 cal)
- Last week: Chicken salad (380 cal)
- 2 weeks ago: Grilled chicken & veggies (290 cal)

Want to use one of these instead?"
```

### 2. Smart Portion Memory

Bob remembers your usual portions:
```
User: "chicken breast"
Bob: "Your usual portion is 150g (247 cal). Is that right?"
```

### 3. Meal Patterns Recognition

Detect eating patterns:
```
Bob: "I noticed you usually have oatmeal on Tuesday mornings. 
     Log your regular bowl (320 cal)?" [Yes] [No]
```

### 4. Quick Repeat Actions

Add quick actions to confirmation bubbles:
- "Same as yesterday"
- "Same as last [meal type]"
- "My usual"

## Implementation Steps

### Phase 1: Update Confirmation Flow
1. Modify `confirmFood` tool to include similar meals
2. Add `recentSimilarMeals` to the confirmation data
3. Update confirmation bubble UI to show suggestions

### Phase 2: Pattern Detection
1. Create `mealPatterns.ts` to analyze:
   - Day/time patterns
   - Usual portions for specific foods
   - Meal combinations
2. Add pattern data to user context

### Phase 3: Smart Suggestions
1. Update Bob's prompt to proactively mention patterns
2. Add "quick log" shortcuts based on history
3. Create "meal templates" from frequent combinations

### Phase 4: UI Enhancements
1. Clickable meal history in confirmations
2. "Use this meal" buttons
3. Portion slider with history markers

## Technical Implementation

### Backend Changes
```typescript
// In confirmFood tool
const similarMeals = await searchSimilarMeals({
  searchText: foodDescription,
  limit: 3,
  includeLastWeek: true
});

// Add to confirmation data
confirmationData.similarMeals = similarMeals;
confirmationData.usualPortion = await getUsualPortion(userId, foodName);
```

### Frontend Changes
```typescript
// In ConfirmationBubble
{similarMeals && (
  <div className="mt-2 border-t pt-2">
    <p className="text-sm text-muted-foreground mb-1">Recent similar meals:</p>
    {similarMeals.map(meal => (
      <button 
        onClick={() => useSimilarMeal(meal)}
        className="block w-full text-left..."
      >
        {meal.date}: {meal.description} ({meal.calories} cal)
      </button>
    ))}
  </div>
)}
```

### Prompt Updates
Add to Bob's instructions:
```
When confirming food, ALWAYS:
1. Check for similar recent meals
2. Mention if this is a frequent meal
3. Suggest the user's usual portion if applicable
4. Show up to 3 recent similar meals with dates
```

## Success Metrics

1. **Faster logging** - Reduce taps/typing by 50%
2. **Increased accuracy** - Users select previous portions more often
3. **User satisfaction** - "Bob remembers what I eat!"
4. **Embedding ROI** - Actually use the data we're collecting

## Future Enhancements

1. **Meal plans** - "Your usual Monday lunch?"
2. **Restaurant memory** - "Your regular Chipotle order?"
3. **Combo detection** - "Want fries with that?" (based on history)
4. **Social features** - "3 friends logged similar meals today"

## Notes

- Keep suggestions subtle, not annoying
- Always allow manual entry
- Respect user privacy (no meal shaming)
- Make it feel magical, not creepy