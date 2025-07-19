# Profile Page Loading Fix

## Issue
The profile page was showing a loading state when profile data wasn't available, instead of showing the page with placeholders.

## Root Cause
The profile page had a conditional that would show "Loading profile..." if either `profile` or `preferences` were null, preventing the page from rendering.

## Solution
Removed the conditional loading state and made the page always render, handling null values gracefully:

1. **Removed loading conditional**: The page now always renders its content
2. **Added null-safe operators**: All references to `profile` and `preferences` use optional chaining (`?.`)
3. **Added default values**: When data is null, appropriate defaults are used:
   - Empty string ("") for text fields
   - 0 for numeric fields (or sensible defaults like 170 for height)
   - "—" as placeholder text in disabled inputs

## Implementation Details

### Before:
```tsx
{!profile || !preferences ? (
  <div>Loading profile...</div>
) : (
  <ProfileContent />
)}
```

### After:
```tsx
<>
  {/* Always show profile content */}
  <ProfileContent />
</>
```

### Key Changes:
- `profile.name` → `profile?.name || ""`
- `profile.age` → `profile?.age || 0`
- Added `placeholder` props to show "—" when values are empty
- All save/edit operations handle null profile gracefully

## Result
The profile page now loads immediately and shows placeholder dashes ("—") for any data that hasn't been filled yet, exactly as requested by the user.