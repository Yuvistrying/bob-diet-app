# Storing Users in the Convex Database | Convex Developer Hub

*If you're using Convex Auth the user information is automatically stored in the database.*

When using external authentication providers like Clerk or Auth0, you often want to store user information in your Convex database. This allows you to:
- Associate user data with other application data
- Query user information efficiently
- Maintain user profiles with additional fields

## Setting up the users table

You can define a "users" table, optionally with an index for efficient looking up the users in the database. In the examples below we will use the subject from the `ctx.auth.getUserIdentity()` to identify the user, which should be set to the Clerk user ID.

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    // this the Clerk ID, stored in the subject JWT field
    externalId: v.string(),
  }).index("byExternalId", ["externalId"]),
});
```

## Webhook approach (Clerk example)

Set up a webhook endpoint in Clerk that points to your Convex HTTP action. Configure it to send user events.

Set the webhook secret from Clerk as the value of the `CLERK_WEBHOOK_SECRET` environment variable in your Convex dashboard.

### Define webhook handler mutations

```typescript
// convex/users.ts
import { internalMutation, query, QueryCtx } from "./_generated/server";
import { UserJSON } from "@clerk/backend";
import { v, Validator } from "convex/values";

export const current = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  handler: async (ctx, { data }) => {
    const userAttributes = {
      name: `${data.first_name} ${data.last_name}`,
      externalId: data.id,
    };

    const user = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", data.id))
      .unique();

    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("byExternalId", (q) => q.eq("externalId", clerkUserId))
      .unique();

    if (user !== null) {
      await ctx.db.delete(user._id);
    }
  },
});

async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("byExternalId", (q) => q.eq("externalId", identity.subject))
    .unique();
  return user;
}
```

### Create HTTP webhook endpoint

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }
    
    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;
        
      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, {
          clerkUserId,
        });
        break;
      }
      
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }
    
    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;
```

## Client-side approach

If webhooks aren't suitable for your use case, you can store user data when they first authenticate:

### Create a hook to store user data

```typescript
// src/useStoreUserEffect.tsx
import { useUser } from "@clerk/clerk-react";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";

export function useStoreUserEffect() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    
    async function createUser() {
      const id = await storeUser();
      setUserId(id);
    }
    
    createUser();
    return () => setUserId(null);
  }, [isAuthenticated, storeUser, user?.id]);

  return {
    isLoading: isAuthenticated && userId === null,
    isAuthenticated: isAuthenticated && userId !== null,
  };
}
```

### Use the hook in your app

If your queries need the user document to be present, make sure that you only render the components that call them after the user has been stored:

```typescript
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useStoreUserEffect } from "./useStoreUserEffect.js";

function App() {
  const { isLoading, isAuthenticated } = useStoreUserEffect();
  
  return (
    <main>
      {isLoading ? (
        <>Loading...</>
      ) : !isAuthenticated ? (
        <SignInButton />
      ) : (
        <>
          <UserButton />
          <Content />
        </>
      )}
    </main>
  );
}

function Content() {
  const messages = useQuery(api.messages.getForCurrentUser);
  return <div>Authenticated content: {messages?.length}</div>;
}

export default App;
```

In this way the `useStoreUserEffect` hook replaces the `useConvexAuth` hook.

## Using the current user in queries

Similarly to the store user mutation, you can retrieve the current user's ID, or throw an error if the user hasn't been stored.

If you want to use the current user's document in a query, make sure that the user has already been stored. You can do this by explicitly checking for this condition before rendering the components that call the query, or before redirecting to the authenticated portion of your app.

```typescript
// src/useCurrentUser.tsx
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function useCurrentUser() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.current);
  
  // Combine the authentication state with the user existence check
  return {
    isLoading: isLoading || (isAuthenticated && user === null),
    isAuthenticated: isAuthenticated && user !== null,
  };
}
```

## Best Practices

1. **Use webhooks when possible**: Webhooks ensure user data is always up-to-date and reduce client-side complexity.

2. **Index by external ID**: Always create an index on the external ID field for efficient lookups.

3. **Handle edge cases**: Account for users who might be deleted or updated externally.

4. **Store minimal data**: Only store the user data you actually need in your application.

5. **Keep data in sync**: If using the client-side approach, consider periodic sync or webhook integration later.