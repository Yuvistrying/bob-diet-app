# Subscription UserId Fix

## Problem

When users delete their account and sign up again with the same email, they encounter a persistent loading state on the pricing page. The subscription exists in the database but has a mismatched userId.

## Root Cause

1. User signs up and creates a subscription (userId: `user_ABC123`)
2. User deletes their account (user record deleted, but subscription remains)
3. User signs up again with same email (new userId: `user_XYZ789`)
4. System finds subscription by email but userId doesn't match
5. Pricing page gets stuck in loading state

## Error Details

```
Error: [CONVEX Q(subscriptions:fetchUserSubscription)] [Request ID: 12aaf7d3284be5ea] Server Error
Uncaught TypeError: e.db.patch is not a function
    at handler (../../convex/subscriptions.ts:316:25)
```

The error occurred because the code was trying to use `ctx.db.patch()` inside a query function. In Convex, queries are read-only and cannot modify data.

## Solution

### 1. Fixed the Query (line 316)

Changed from:

```typescript
await ctx.db.patch(emailSubscription._id, {
  userId: user.tokenIdentifier,
});
```

To:

```typescript
// Return the subscription as-is, userId update should be done via mutation
return emailSubscription;
```

### 2. Created Mutation for Manual Fixes

```typescript
export const updateSubscriptionUserId = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      userId: args.userId,
    });
  },
});
```

### 3. Created Auto-Fix Mutation

```typescript
export const fixSubscriptionUserIdByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user and subscription by email
    // Update subscription with correct userId
    // Return success status
  },
});
```

### 4. Added Auto-Fix to Pricing Page

```typescript
// Fix subscription userId if needed
React.useEffect(() => {
  if (
    userSubscription &&
    !userSubscription.userId &&
    userSubscription.metadata?.customerEmail
  ) {
    fixSubscriptionUserId({ email: userSubscription.metadata.customerEmail })
      .then(() => console.log("Fixed subscription userId"))
      .catch(console.error);
  }
}, [userSubscription, fixSubscriptionUserId]);
```

## Prevention

1. Always use `.first()` instead of `.unique()` for user queries
2. Check subscriptions by both userId AND email
3. Clean up subscriptions when users delete accounts
4. Consider adding a background job to fix orphaned subscriptions

## Testing

1. Create a subscription
2. Note the subscription ID in Convex dashboard
3. Delete user account
4. Sign up again with same email
5. Visit pricing page - should auto-fix and show "Manage Subscription"

## Related Files

- `/convex/subscriptions.ts` - Contains the fixes
- `/app/pricing/page.tsx` - Auto-fix implementation
- `CLAUDE.md` - Section 22 documents this fix
