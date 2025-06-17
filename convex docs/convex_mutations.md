# Mutations | Convex Developer Hub

Mutations insert, update and remove data from the database, check authentication or perform other business logic, and optionally return a response to the client application.

This is an example mutation, taking in named arguments, writing data to the database and returning a result:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Create a new task with the given text
export const createTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const newTaskId = await ctx.db.insert("tasks", { text: args.text });
    return newTaskId;
  },
});
```

Read on to understand how to build mutations yourself.

## Mutation names

Mutations follow the same naming rules as queries, see Query names.

Queries and mutations can be defined in the same file when using named exports.

## The mutation constructor

To declare a mutation in Convex use the `mutation` constructor function. Pass it an object with a `handler` function, which performs the mutation:

```typescript
import { mutation } from "./_generated/server";

export const mutateSomething = mutation({
  handler: () => {
    // implementation will be here
  },
});
```

Unlike a query, a mutation can but does not have to return a value.

## Mutation arguments

Just like queries, mutations accept named arguments, and the argument values are accessible as fields of the second parameter of the `handler` function:

```typescript
import { mutation } from "./_generated/server";

export const mutateSomething = mutation({
  handler: (_, args: { a: number; b: number }) => {
    // do something with `args.a` and `args.b`
    // optionally return a value
    return "success";
  },
});
```

Arguments and responses are automatically serialized and deserialized, and you can pass and return most value-like JavaScript data to and from your mutation.

To both declare the types of arguments and to validate them, add an `args` object using `v` validators:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const mutateSomething = mutation({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    // do something with `args.a` and `args.b`
  },
});
```

See argument validation for the full list of supported types and validators.

The first parameter to the handler function is reserved for the mutation context.

## Mutation responses

Queries can return values of any supported Convex type which will be automatically serialized and deserialized.

Mutations can also return `undefined`, which is not a valid Convex value. When a mutation returns `undefined` it is translated to `null` on the client.

## Mutation context

The `mutation` constructor enables writing data to the database, and other Convex features by passing a `MutationCtx` object to the handler function as the first parameter:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const mutateSomething = mutation({
  args: { a: v.number(), b: v.number() },
  handler: (ctx, args) => {
    // Do something with `ctx`
  },
});
```

Which part of the mutation context is used depends on what your mutation needs to do:

### Database access

To read from and write to the database use the `db` field. Note that we make the handler function an `async` function so we can `await` the promise returned by `db.insert()`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addItem = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { text: args.text });
  },
});
```

Read on about Writing Data.

### File storage

To generate upload URLs for storing files use the `storage` field. Read on about File Storage.

### Authentication

To check user authentication use the `auth` field. Read on about Authentication.

### Scheduling

To schedule functions to run in the future, use the `scheduler` field. Read on about Scheduled Functions.

## Splitting up mutation code via helpers

When you want to split up the code in your mutation or reuse logic across multiple Convex functions you can define and call helper functions:

```typescript
import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";

export const addItem = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", { text: args.text });
    await trackChange(ctx, "addItem");
  },
});

async function trackChange(ctx: MutationCtx, type: "addItem" | "removeItem") {
  await ctx.db.insert("changes", { type });
}
```

Mutations can call helpers that take a `QueryCtx` as argument, since the mutation context can do everything query context can.

You can `export` helpers to use them across multiple files. They will not be callable from outside of your Convex functions.

See Type annotating server side helpers for more guidance on TypeScript types.

## Using NPM packages

Mutations can import NPM packages installed in `node_modules`. Not all NPM packages are supported, see Runtimes for more details.

```bash
npm install @faker-js/faker
```

```typescript
import { faker } from "@faker-js/faker";
import { mutation } from "./_generated/server";

export const randomName = mutation({
  args: {},
  handler: async (ctx) => {
    faker.seed();
    await ctx.db.insert("tasks", { text: "Greet " + faker.person.fullName() });
  },
});
```

## Calling mutations from clients

To call a mutation from React use the `useMutation` hook along with the generated `api` object.

```typescript
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyApp() {
  const mutateSomething = useMutation(api.myFunctions.mutateSomething);
  const handleClick = () => {
    mutateSomething({ a: 1, b: 2 });
  };
  // pass `handleClick` to a button
  // ...
}
```

See the React client documentation for all the ways queries can be called.

When mutations are called from the React or Rust clients, they are executed one at a time in a single, ordered queue. You don't have to worry about mutations editing the database in a different order than they were triggered.

## Transactions

Mutations run transactionally. This means that:

- All database reads inside the transaction get a consistent view of the data in the database. You don't have to worry about a concurrent update changing the data in the middle of the execution.
- All database writes get committed together. If the mutation writes some data to the database, but later throws an error, no data is actually written to the database.

For this to work, similarly to queries, mutations must be deterministic, and cannot call third party APIs. To call third party APIs, use actions.

## Limits

Mutations have a limit to the amount of data they can read and write at once to guarantee good performance. Check out these limits here.

For information on other limits, see here.