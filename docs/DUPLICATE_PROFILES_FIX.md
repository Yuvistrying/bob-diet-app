# Duplicate User Profiles Fix

## Date: January 2025

## Problem

When creating a new thread, the application crashed with:

```
Uncaught Error: unique() query returned more than one result from table userProfiles:
 [k97adx94qbymx65tba3eymj9q17hn2c9, k975n5hajzvxxbdqgp2ngsfsps7hnca4, ...]
    at async handler (../convex/threads.ts:130:17)
```

The `unique()` method expects exactly one result but found multiple user profiles for the same user ID.

## Root Cause

The database had multiple `userProfiles` entries for the same user. This could happen due to:

- Race conditions during profile creation
- Multiple onboarding attempts
- Development/testing artifacts

## Solution

### 1. Immediate Fix

Changed queries from `.unique()` to `.first()` in `threads.ts`:

```typescript
// Before (crashes if multiple profiles exist)
const profile = await ctx.db
  .query("userProfiles")
  .withIndex("by_user", (q) => q.eq("userId", identity.subject))
  .unique();

// After (handles duplicates gracefully)
const profile = await ctx.db
  .query("userProfiles")
  .withIndex("by_user", (q) => q.eq("userId", identity.subject))
  .first();
```

### 2. Cleanup Mutations

Created `convex/cleanupDuplicateProfiles.ts` with two mutations:

#### For Individual Users:

```typescript
export const cleanupDuplicateProfiles = mutation({
  // Cleans up duplicates for the current user
  // Keeps the newest profile, deletes older ones
});
```

#### For Admin Cleanup:

```typescript
export const cleanupAllDuplicateProfiles = mutation({
  // Cleans up duplicates for all users in the system
  // Returns summary of all cleanups performed
});
```

## Implementation Details

The cleanup logic:

1. Finds all profiles for a user
2. Sorts by creation time (newest first)
3. Keeps the newest profile
4. Deletes all older duplicates
5. Logs all operations for audit trail

## Prevention

To prevent future duplicates:

- Use `first()` instead of `unique()` for profile queries
- Add proper uniqueness constraints in profile creation logic
- Consider adding a database-level unique constraint on userId

## Testing

To clean up duplicates:

1. For current user:

```javascript
// In Convex dashboard or app
await ctx.runMutation(api.cleanupDuplicateProfiles.cleanupDuplicateProfiles);
```

2. For all users (admin):

```javascript
// In Convex dashboard
await ctx.runMutation(api.cleanupDuplicateProfiles.cleanupAllDuplicateProfiles);
```

## Impact

- Fixes immediate crash when creating new threads
- Gracefully handles existing duplicate data
- Provides tools to clean up database
- No breaking changes to existing functionality
