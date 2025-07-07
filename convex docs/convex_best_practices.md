# Best Practices | Convex Developer Hub

This is a list of best practices and common anti-patterns around using Convex.

## Use indexes instead of filters for large queries

Search for `.filter` in your Convex codebase — a regex like `\.filter\(\(?q` will probably find all the ones on database queries. Decide whether they should be replaced with a `.withIndex` condition — per this section, if you are filtering over a large (1000+) or potentially unbounded number of documents, you should use an index. If not using a `.withIndex` / `.withSearchIndex` condition, consider replacing them with a filter in code for more readability and flexibility. See this article for more strategies for filtering.

Using `.filter` on a paginated query (`.paginate`) has advantages over filtering in code. The paginated query will return the number of documents requested, including the `.filter` condition, so filtering in code afterwards can result in a smaller page or even an empty page. Using `.withIndex` on a paginated query will still be more efficient than a `.filter`.

## Secure all your public functions

Search for `query`, `mutation`, `action`, and `httpAction` in your Convex codebase, and ensure that all of them have some form of access control. Custom functions like `authenticatedQuery` can be helpful. Some apps use Row Level Security (RLS) to check access to each document automatically whenever it's loaded, as described in this article. Alternatively, you can check access in each Convex function instead of checking access for each document.

Helper functions for common checks and common operations can also be useful -- e.g. `isTeamMember`, `isTeamAdmin`, `loadTeam` (which throws if the current user does not have access to the team).

Public functions can be called by anyone, including potentially malicious attackers trying to break your app, and should be carefully audited to ensure they can't be used maliciously. Functions that are only called within Convex can be marked as internal, and relax these checks since Convex will ensure that internal functions can only be called within Convex.

### Example: Access control with helper functions

```typescript
import { QueryCtx, MutationCtx } from '../_generated/server';
import * as Users from './users';

export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);

  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }

  return conversation;
}

export async function listMessages(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */
  return messages;
}

export async function addSummary(
  ctx: MutationCtx,
  { conversationId, summary }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}
```

## Use helper functions instead of ctx.runQuery / ctx.runMutation

While these queries and mutations run in the same transaction, and will give consistent results, they have extra overhead compared to plain TypeScript functions. Wanting a TypeScript helper function is much more common than needing `ctx.runQuery` or `ctx.runMutation`.

Audit your calls to `ctx.runQuery` and `ctx.runMutation` in queries and mutations. Unless one of the exceptions below applies, replace them with a plain TypeScript function.

Exceptions:

- If you're using components, these require `ctx.runQuery` or `ctx.runMutation`.
- If you want partial rollback on an error, you will want `ctx.runMutation` instead of a plain TypeScript function.

### Example: Using helper functions

```typescript
import { QueryCtx, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./userHelpers";
import { Doc, Id } from "./_generated/dataModel";

export const remove = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUser(ctx);
    await ensureTeamAdmin(ctx, currentUser, teamId);
    await ctx.db.delete(teamId);
  },
});

async function ensureTeamAdmin(
  ctx: QueryCtx,
  user: Doc<"users">,
  teamId: Id<"teams">,
) {
  // use `ctx.db` to check that `user` is a team admin and throw an error otherwise
}
```

## Always use internal functions when calling from Convex

Search for `ctx.runQuery`, `ctx.runMutation`, and `ctx.runAction` in your Convex codebase. Also search for `ctx.scheduler` and check the `crons.ts` file. Ensure all of these use `internal.foo.bar` functions instead of `api.foo.bar` functions.

If you have code you want to share between a public Convex function and an internal Convex function, create a helper function that can be called from both. The public function will likely have additional access control checks.

Alternatively, make sure that `api` from `_generated/api.ts` is never used in your Convex functions directory.

### Example: Using internal functions

```typescript
// ✅ Using `internal`
import { MutationCtx } from "./_generated/server";

async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage = mutation({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
```

## Batch operations in single mutations

When calling from actions, batch multiple operations into a single mutation for consistency:

```typescript
// ❌ Multiple separate mutations
export const importTeams = action({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const teamMembers = await fetchTeamMemberData(teamId);
    // This will run a separate mutation for inserting each user
    for (const member of teamMembers) {
      await ctx.runMutation(api.users.insert, member);
    }
  },
});

// ✅ Single batched mutation
export const importTeams = action({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const teamMembers = await fetchTeamMemberData(teamId);
    // This action runs a single mutation that inserts all users in the same transaction
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});

export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
```

## Other Recommendations

### Error Handling

Inevitably, your Convex functions will have bugs and hit exceptions. If you have an exception handling service and error boundaries configured, you can ensure that you hear about these errors and your users see appropriate UI.

### General Guidelines

- Use argument validation in all public functions
- Use `console.log` to debug your Convex functions
- Use helper functions to write shared code
- Use indexes or paginate all large database queries
- Use tables to separate logical object types
- Check for `undefined` to determine if a query is loading
- Add optimistic updates for the interactions you want to feel snappy

### Development Best Practices

This allows developers to make changes to a project that uses convex by running it against the production deployment by setting an environment variable, without ever needing to run the Convex CLI tool.

To run against a production deployment set an environment variable like `VITE_CONVEX_URL` (the exact variable name depends on the framework you use) to a production deployment URL like `https://happy-otter-123.convex.cloud` found in project's production deployment settings in the dashboard. Most frameworks search for variables like this in a file called `.env` or `.env.production`.

### Performance Considerations

Database indexes with range expressions allow you to write efficient database queries that only scan a small number of documents in the table. Pagination allows you to quickly display incremental lists of results. If your table could contain more than a few thousand documents, you should consider pagination or an index with a range expression to ensure that your queries stay fast.

For more details, check out our Introduction to Indexes and Query Performance article. Even though Convex does support nested documents, it is often better to put separate objects into separate tables and use IDs to create references between them. This will give you more flexibility when loading and querying documents.
