# Reading Data | Convex Developer Hub

Query and mutation functions can read data from database tables using document ids and document queries.

## Reading a single document

Given a single document's id you can read its data with the `db.get` method:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    // do something with `task`
  },
});
```

Note: You should use the `v.id` validator like in the example above to make sure you are not exposing data from tables other than the ones you intended.

## Querying documents

Document queries always begin by choosing the table to query with the `db.query` method:

```typescript
import { query } from "./_generated/server";

export const listTasks = query({
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    // do something with `tasks`
  },
});
```

Then you can:
- filter
- order
- and await the results

We'll see how this works in the examples below.

## Filtering your query

The best way to filter in Convex is to use indexes. Indexes build a special internal structure in your database to speed up lookups.

There are two steps to using indexes:
1. Define the index in your `convex/schema.ts` file.
2. Query via the `withIndex()` syntax.

### 1. Define the index

If you aren't familiar with how to create a Convex schema, read the schema doc.

Let's assume you're building a chat app and want to get all messages in a particular channel. You can define a new index called `by_channel` on the `messages` table by using the `.index()` method in your schema.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Define a messages table with an index.
export default defineSchema({
  messages: defineTable({
    channel: v.id("channels"),
    body: v.string(),
    user: v.id("users"),
  }).index("by_channel", ["channel"]),
});
```

### 2. Filter a query with an index

In your query function, you can now filter your `messages` table by using the `by_channel` index.

```typescript
const messages = await ctx.db
  .query("messages")
  .withIndex("by_channel", (q) => q.eq("channel", channel))
  .collect();
```

In Convex, you must explicitly use the `withIndex()` syntax to ensure your database uses the index. This differs from a more traditional SQL database, where the database implicitly chooses to use an index based on heuristics. The Convex approach leads to fewer surprises in the long run.

You can create an index across multiple fields at once, query a specific range of data, and change the order of your query result. Read the complete index documentation to learn more.

Convex also supports a slower filtering mechanism that effectively loops through the table to match the filter. This can be useful if you know your table will be small (low thousands of rows), you're prototyping, or you want to filter an index query further. You can read more about filters here.

## Ordering

By default Convex always returns documents ordered by `_creationTime`.

You can use `.order("asc" | "desc")` to pick whether the order is ascending or descending. If the order isn't specified, it defaults to ascending.

```typescript
// Get all messages, oldest to newest.
const messages = await ctx.db.query("messages").order("asc").collect();

// Get all messages, newest to oldest.
const messages = await ctx.db.query("messages").order("desc").collect();
```

If you need to sort on a field other than `_creationTime` and your document query returns a small number of documents (on the order of hundreds rather than thousands of documents), consider sorting in Javascript:

```typescript
// Get top 10 most liked messages, assuming messages is a fairly small table:
const messages = await ctx.db.query("messages").collect();
const topTenMostLikedMessages = recentMessages
  .sort((a, b) => b.likes - a.likes)
  .slice(0, 10);
```

For document queries that return larger numbers of documents, you'll want to use an index to improve the performance. Document queries that use indexes will be ordered based on the columns in the index and can avoid slow table scans.

```typescript
// Get the top 20 most liked messages of all time, using the "by_likes" index.
const messages = await ctx.db
  .query("messages")
  .withIndex("by_likes")
  .order("desc")
  .take(20);
```

See Limits for details.

### Ordering of different types of values

A single field can have values of any Convex type. When there are values of different types in an indexed field, their ascending order is as follows:

No value set (`undefined`) < Null (`null`) < Int64 (`bigint`) < Float64 (`number`) < Boolean (`boolean`) < String (`string`) < Bytes (`ArrayBuffer`) < Array (`Array`) < Object (`Object`)

The same ordering is used by the filtering comparison operators `q.lt()`, `q.lte()`, `q.gt()` and `q.gte()`.

## Retrieving results

Most of our previous examples have ended the document query with the `.collect()` method, which returns all the documents that match your filters. Here are the other options for retrieving results.

### Taking n results

`.take(n)` selects only the first `n` results that match your query.

```typescript
const users = await ctx.db.query("users").take(5);
```

### Finding the first result

`.first()` selects the first document that matches your query and returns `null` if no documents were found.

```typescript
// We expect only one user with that email address.
const userOrNull = await ctx.db
  .query("users")
  .withIndex("by_email", (q) => q.eq("email", "test@example.com"))
  .first();
```

### Using a unique result

`.unique()` selects the single document from your query or returns `null` if no documents were found. If there are multiple results it will throw an exception.

```typescript
// Our counter table only has one document.
const counterOrNull = await ctx.db.query("counter").unique();
```

### Loading a page of results

`.paginate(opts)` loads a page of results and returns a Cursor for loading additional results.

See Paginated Queries to learn more.

## More complex queries

Convex prefers to have a few, simple ways to walk through and select documents from tables. In Convex, there is no specific query language for complex logic like a join, an aggregation, or a group by.

Instead, you can write the complex logic in Javascript! Convex guarantees that the results will be consistent.

### Join

Table join might look like:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const eventAttendees = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    return Promise.all(
      (event?.attendeeIds ?? []).map((userId) => ctx.db.get(userId)),
    );
  },
});
```

### Aggregation

Here's an example of computing an average:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const averagePurchasePrice = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userPurchases = await ctx.db
      .query("purchases")
      .withIndex("by_buyer", (q) => q.eq("buyer", args.email))
      .collect();
    const sum = userPurchases.reduce((a, { value: b }) => a + b, 0);
    return sum / userPurchases.length;
  },
});
```

If you need more scalable aggregate options (for example to handle frequent updates or large tables), consider using the Sharded Counter or Aggregate components. These components can help you handle high-throughput counters, sums, or computations without looping through the whole table.

### Group by

Here's an example of grouping and counting:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const numPurchasesPerBuyer = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userPurchases = await ctx.db.query("purchases").collect();
    return userPurchases.reduce(
      (counts, { buyer }) => ({
        ...counts,
        [buyer]: counts[buyer] ?? 0 + 1,
      }),
      {} as Record<string, number>,
    );
  },
});
```

## Explore the syntax on the dashboard

You can try out the syntax described above directly from the dashboard by writing a custom test query.