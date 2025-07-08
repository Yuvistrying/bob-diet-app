AI Agent hero image
npm install @convex-dev/agent

AI Agent framework built on Convex.

Automatic storage of chat history, per-user or per-thread, that can span multiple agents.
Playground UI for testing, debugging, and development. See playground/README.md for more.
RAG for chat context, via hybrid text & vector search, with configuration options. Use the API to query the history yourself and do it your way.
Opt-in search for messages from other threads (for the same specified user).
Support for generating / streaming objects and storing them in messages (as JSON).
Tool calls via the AI SDK, along with Convex-specific tool wrappers.
Easy integration with the Workflow component. Enables long-lived, durable workflows defined as code.
Reactive & realtime updates from asynchronous functions / workflows.
Support for streaming text and storing the final result. See examples/chat-streaming.
Optionally filter tool calls out of the thread history.
Read the associated Stack post here.

Powerful AI Apps Made Easy with the Agent Component

Play with the examples by cloning this repo and running:

npm run example

Example usage:#
// Define an agent similarly to the AI SDK
const supportAgent = new Agent(components.agent, {
chat: openai.chat("gpt-4o-mini"),
textEmbedding: openai.embedding("text-embedding-3-small"),
instructions: "You are a helpful assistant.",
tools: { accountLookup, fileTicket, sendEmail },
});

// Use the agent from within a normal action:
export const createThreadAndPrompt = action({
args: { prompt: v.string() },
handler: async (ctx, { prompt }) => {
const userId = await getUserId(ctx);
// Start a new thread for the user.
const { threadId, thread } = await supportAgent.createThread(ctx, { userId});
// Creates a user message with the prompt, and an assistant reply message.
const result = await thread.generateText({ prompt });
return { threadId, text: result.text };
},
});

// Pick up where you left off, with the same or a different agent:
export const continueThread = action({
args: { prompt: v.string(), threadId: v.string() },
handler: async (ctx, { prompt, threadId }) => {
// Continue a thread, picking up where you left off.
const { thread } = await anotherAgent.continueThread(ctx, { threadId });
// This includes previous message history from the thread automatically.
const result = await thread.generateText({ prompt });
return result.text;
},
});

Also see the Stack article.

Found a bug? Feature request? File it here.

Pre-requisite: Convex#
You'll need an existing Convex project to use the component. Convex is a hosted backend platform, including a database, serverless functions, and a ton more you can learn about here.

Run npm create convex or follow any of the quickstarts to set one up.

Installation#
Install the component package:

npm install @convex-dev/agent

Create a convex.config.ts file in your app's convex/ folder and install the component by calling use:

// convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(agent);

export default app;

Usage#
Creating the agent#
import { tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Agent, createTool } from "@convex-dev/agent";
import { components } from "./\_generated/api";

// Define an agent similarly to the AI SDK
const supportAgent = new Agent(components.agent, {
// The chat completions model to use for the agent.
chat: openai.chat("gpt-4o-mini"),
// The default system prompt if not overriden.
instructions: "You are a helpful assistant.",
tools: {
// Convex tool
myConvexTool: createTool({
description: "My Convex tool",
args: z.object({...}),
// Note: annotate the return type of the handler to avoid type cycles.
handler: async (ctx, args): Promise<string> => {
return "Hello, world!";
},
}),
// Standard AI SDK tool
myTool: tool({ description, parameters, execute: () => {}}),
},
// Embedding model to power vector search of message history (RAG).
textEmbedding: openai.embedding("text-embedding-3-small"),
// Used for fetching context messages. See [below](#configuring-the-context-of-messages)
contextOptions,
// Used for storing messages. See [below](#configuring-the-storage-of-messages)
storageOptions,
// Used for limiting the number of steps when tool calls are involved.
// NOTE: if you want tool calls to happen automatically with a single call,
// you need to set this to something greater than 1 (the default).
maxSteps: 1,
// Used for limiting the number of retries when a tool call fails. Default: 3.
maxRetries: 3,
// Used for tracking token usage. See [below](#tracking-token-usage)
usageHandler: async (ctx, { model, usage }) => {
// ... log, save usage to your database, etc.
},
});

Starting a thread#
You can start a thread from either an action or a mutation. If it's in an action, you can also start sending messages. The threadId allows you to resume later and maintain message history. If you specify a userId, the thread will be associated with that user and messages will be saved to the user's history. You can also search the user's history for relevant messages in this thread.

// Use the agent from within a normal action:
export const createThread = mutation({
args: {},
handler: async (ctx): Promise<{ threadId: string }> => {
const userId = await getUserId(ctx);
// Start a new thread for the user.
const { threadId } = await supportAgent.createThread(ctx, { userId });
return { threadId };
},
});

Continuing a thread#
If you specify a userId too, you can search the user's history for relevant messages to include in the prompt context.

// Pick up where you left off:
export const continueThread = action({
args: { prompt: v.string(), threadId: v.string() },
handler: async (ctx, { prompt, threadId }): Promise<string> => {
await authorizeThreadAccess(ctx, threadId);
// This includes previous message history from the thread automatically.

- const { thread } = await supportAgent.continueThread(ctx, { threadId });
  const result = await thread.generateText({ prompt });
  return result.text;
  },
  });

Generating text#
The arguments to generateText are the same as the AI SDK, except you don't have to provide a model. By default it will use the agent's chat model.

const { thread } = await supportAgent.createThread(ctx);
// OR
const { thread } = await supportAgent.continueThread(ctx, { threadId });

const result = await thread.generateText({ prompt });

Generating an object#
Similar to the AI SDK, you can generate or streaman object. The same arguments apply, except you don't have to provide a model. It will use the agent's default chat model.

import { z } from "zod";

const result = await thread.generateObject({
prompt: "Generate a plan based on the conversation so far",
schema: z.object({...}),
});

Showing messages#
Fetch the full messages directly. These will include things like usage, etc.

Server-side:

import type { MessageDoc } from "@convex-dev/agent";
import { paginationOptsValidator, type PaginationResult } from "convex/server";

export const listThreadMessages = query({
args: {
threadId: v.string(),
paginationOpts: paginationOptsValidator,
//... other arguments you want
},
handler: async (
ctx, { threadId, paginationOpts },
): PaginationResult<MessageDoc> => {
// await authorizeThreadAccess(ctx, threadId);
const paginated = await agent.listMessages(ctx, {
threadId,
paginationOpts,
});
// Here you could filter out / modify the documents
return paginated;
},
});

Client-side:

import { api } from "../convex/\_generated/api";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";

function MyComponent({ threadId }: { threadId: string }) {
const messages = useThreadMessages(
api.chatBasic.listThreadMessages,
{ threadId },
{ initialNumItems: 10 },
);
return (

<div>
{toUIMessages(messages.results ?? []).map((message) => (
<div key={message.key}>{message.content}</div>
))}
</div>
);
}

See examples/chat-basic for an example, and examples/chat-streaming for a streaming example.

Configuring the context of message generation#
You can customize what history is included per-message via contextOptions. These options can be provided to the Agent constructor, or per-message.

const result = await thread.generateText({ prompt }, {
// Values shown are the defaults.
contextOptions: {
// Whether to include tool messages in the context.
includeToolCalls: false,
// How many recent messages to include. These are added after the search
// messages, and do not count against the search limit.
recentMessages: 100,
// Options for searching messages via text and/or vector search.
searchOptions: {
limit: 10, // The maximum number of messages to fetch.
textSearch: false, // Whether to use text search to find messages.
vectorSearch: false, // Whether to use vector search to find messages.
// Note, this is after the limit is applied.
// E.g. this will quadruple the number of messages fetched.
// (two before, and one after each message found in the search)
messageRange: { before: 2, after: 1 },
},
// Whether to search across other threads for relevant messages.
// By default, only the current thread is searched.
searchOtherThreads: false,
},

Configuring the storage of messages#
Generally the defaults are fine, but if you want to pass in multiple messages and have them all saved (vs. just the last one), or avoid saving any input or output messages, you can pass in a storageOptions object, either to the Agent constructor or per-message.

The usecase for passing in multiple messages but not saving them is if you want to include some extra messages for context to the LLM, but only the last message is the user's actual request. e.g. messages = [...messagesFromRag, messageFromUser]. The default is to save the prompt and all output messages.

const result = await thread.generateText({ messages }, {
storageOptions: {
saveMessages: "all" | "none" | "promptAndOutput";
},
});

Creating a tool with Convex context#
There are two ways to create a tool that has access to the Convex context.

Use the createTool function, which is a wrapper around the AI SDK's tool function.
export const ideaSearch = createTool({
description: "Search for ideas in the database",
args: z.object({ query: z.string() }),
handler: async (ctx, args): Promise<Array<Idea>> => {
// ctx has userId, threadId, messageId, runQuery, runMutation, and runAction
const ideas = await ctx.runQuery(api.ideas.searchIdeas, { query: args.query });
console.log("found ideas", ideas);
return ideas;
},
});

Define tools at runtime in a context with the variables you want to use.
async function createTool(ctx: ActionCtx, teamId: Id<"teams">) {
const myTool = tool({
description: "My tool",
parameters: z.object({...}),
execute: async (args, options) => {
return await ctx.runQuery(internal.foo.bar, args);
},
});
}

You can provide tools at different times:

Agent contructor: (new Agent(components.agent, { tools: {...} }))
Creating a thread: createThread(ctx, { tools: {...} })
Continuing a thread: continueThread(ctx, { tools: {...} })
On thread functions: thread.generateText({ tools: {...} })
Outside of a thread: supportAgent.generateText(ctx, {}, { tools: {...} })
Specifying tools at each layer will overwrite the defaults. The tools will be args.tools ?? thread.tools ?? agent.options.tools. This allows you to create tools in a context that is convenient.

Saving messages then generate asynchronously#
You can save messages in a mutation, then do the generation asynchronously. This is recommended for a few reasons:

You can set up optimistic UI updates on mutations that are transactional, so the message will be shown optimistically until the message is saved and present in your message query.
To do this, you need to first save the message, then pass the messageId as promptMessageId to generate / stream text.

Note: embeddings are usually generated automatically when you save messages from an action. However, if you're saving messages in a mutation, where calling an LLM is not possible, you can generate them asynchronously as well.

export const sendMessage = mutation({
args: { threadId: v.id("threads"), prompt: v.string() },
handler: async (ctx, { threadId, prompt }) => {
const userId = await getUserId(ctx);
const { messageId } = await agent.saveMessage(ctx, {
threadId, userId, prompt,
skipEmbeddings: true,
});
await ctx.scheduler.runAfter(0, internal.example.myAsyncAction, {
threadId, promptMessageId: messageId,
});
}
});

export const myAsyncAction = internalAction({
args: { threadId: v.string(), promptMessageId: v.string() },
handler: async (ctx, { threadId, promptMessageId }) => {
// Generate embeddings for the prompt message
await supportAgent.generateAndSaveEmbeddings(ctx, { messageIds: [promptMessageId] });
const { thread } = await supportAgent.continueThread(ctx, { threadId });
await thread.generateText({ promptMessageId });
},
});

Search for messages#
This is what the agent does automatically, but it can be useful to do manually, e.g. to find custom context to include.

Fetch Messages for a user and/or thread. Accepts ContextOptions, e.g. includeToolCalls, searchOptions, etc. If you provide a beforeMessageId, it will only fetch messages from before that message.

import type { MessageDoc } from "@convex-dev/agent";

const messages: MessageDoc[] = await supportAgent.fetchContextMessages(ctx, {
threadId, messages: [{ role, content }], contextOptions
});

Get and update thread information#
List threads for a user:

const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
userId,
order: "desc",
paginationOpts: { cursor: null, numItems: 10 }
});

Get a thread by id:

const thread = await ctx.runQuery(components.agent.threads.getThread, {
threadId,
});

Update a thread's metadata:

await ctx.runMutation(components.agent.threads.updateThread, {
threadId,
{ title, summary, status }
});

Using the Playground UI#
The Playground UI is a simple way to test, debug, and develop with the agent.

First configure it with instructions here.
Then you can use the hosted version on GitHub pages or run it locally with npx @convex-dev/agent-playground.
Playground UI Screenshot

Using the Workflow component for long-lived durable workflows#
The Workflow component is a great way to build long-lived, durable workflows. It handles retries and guarantees of eventually completing, surviving server restarts, and more. Read more about durable workflows in this Stack post.

To use the agent alongside workflows, you can run indivdual idempotent steps that the workflow can run, each with configurable retries, with guarantees that the workflow will eventually complete. Even if the server crashes mid-workflow, the workflow will pick up from where it left off and run the next step. If a step fails and isn't caught by the workflow, the workflow's onComplete handler will get the error result.

Exposing the agent as Convex actions#
You can expose the agent's capabilities as Convex functions to be used as steps in a workflow.

To create a thread as a standalone mutation, similar to agent.createThread:

export const createThread = supportAgent.createThreadMutation();

For an action that generates text in a thread, similar to thread.generateText:

export const getSupport = supportAgent.asTextAction({
maxSteps: 10,
});

You can also expose a standalone action that generates an object.

export const getStructuredSupport = supportAgent.asObjectAction({
schema: z.object({
analysis: z.string().describe("A detailed analysis of the user's request."),
suggestion: z.string().describe("A suggested action to take.")
}),
});

To save messages explicitly as a mutation, similar to agent.saveMessages:

export const saveMessages = supportAgent.asSaveMessagesMutation();

This is useful for idempotency, as you can first create the user's message, then generate a response in an unreliable action with retries, passing in the existing messageId instead of a prompt.

Using the agent actions within a workflow#
You can use the Workflow component to run agent flows. It handles retries and guarantees of eventually completing, surviving server restarts, and more. Read more about durable workflows in this Stack post.

const workflow = new WorkflowManager(components.workflow);

export const supportAgentWorkflow = workflow.define({
args: { prompt: v.string(), userId: v.string() },
handler: async (step, { prompt, userId }) => {
const { threadId } = await step.runMutation(internal.example.createThread, {
userId, title: "Support Request",
});
const suggestion = await step.runAction(internal.example.getSupport, {
threadId, userId, prompt,
});
const { object } = await step.runAction(internal.example.getStructuredSupport, {
userId, message: suggestion,
});
await step.runMutation(internal.example.sendUserMessage, {
userId, message: object.suggestion,
});
},
});

See another example in example.ts.

Extra control: how to do more things yourself#
Generating text for a user without an associated thread#
const result = await supportAgent.generateText(ctx, { userId }, { prompt });

Saving messages manually#
Save messages to the database.

const { lastMessageId, messageIds} = await agent.saveMessages(ctx, {
threadId, userId,
messages: [{ role, content }],
metadata: [{ reasoning, usage, ... }] // See MessageWithMetadata type
});

Manage embeddings#
Generate embeddings for a set of messages.

const embeddings = await supportAgent.generateEmbeddings([
{ role: "user", content: "What is love?" },
]);

Get and update embeddings, e.g. for a migration to a new model.

const messages = await ctx.runQuery(
components.agent.vector.index.paginate,
{ vectorDimension: 1536, cursor: null, limit: 10 }
);

Note: If the dimension changes, you need to delete the old and insert the new.

const messages = await ctx.runQuery(components.agent.vector.index.updateBatch, {
vectors: [
{ model: "gpt-4o-mini", vector: embedding, id: msg.embeddingId },
],
});

Delete embeddings

await ctx.runMutation(components.agent.vector.index.deleteBatch, {
ids: [embeddingId1, embeddingId2],
});

Insert embeddings

const ids = await ctx.runMutation(
components.agent.vector.index.insertBatch, {
vectorDimension: 1536,
vectors: [
{
model: "gpt-4o-mini",
table: "messages",
userId: "123",
threadId: "123",
vector: embedding,
// Optional, if you want to update the message with the embeddingId
messageId: messageId,
},
],
}
);

See example usage in example.ts. Read more in this Stack post.

npm i @convex-dev/agent

Tracking token usage#
You can provide a usageHandler to the agent to track token usage. See an example in this demo that captures usage to a table, then scans it to generate per-user invoices.

You can provide a usageHandler to the agent, per-thread, or per-message.

const supportAgent = new Agent(components.agent, {
...
usageHandler: async (ctx, args) => {
const {
// Who used the tokens
userId, threadId, agentName,
// What LLM was used
model, provider,
// How many tokens were used (extra info is available in providerMetadata)
usage, providerMetadata
} = args;
// ... log, save usage to your database, etc.
},
});

Tip: Define the usageHandler within a function where you have more variables available to attribute the usage to a different user, team, project, etc.

Logging the raw request and response#
You can provide a rawRequestResponseHandler to the agent to log the raw request and response from the LLM.

You could use this to log the request and response to a table, or use console logs with Log Streaming to allow debugging and searching through Axiom or another logging service.

const supportAgent = new Agent(components.agent, {
...
rawRequestResponseHandler: async (ctx, { request, response }) => {
console.log("request", request);
console.log("response", response);
},
});

Troubleshooting#
Circular dependencies#
Having the return value of workflows depend on other Convex functions can lead to circular dependencies due to the internal.foo.bar way of specifying functions. The way to fix this is to explicitly type the return value of the workflow. When in doubt, add return types to more handler functions, like this:

export const supportAgentWorkflow = workflow.define({
args: { prompt: v.string(), userId: v.string(), threadId: v.string() },

- handler: async (step, { prompt, userId, threadId }): Promise<string> => {
  // ...
  },
  });

// And regular functions too:
export const myFunction = action({
args: { prompt: v.string() },

- handler: async (ctx, { prompt }): Promise<string> => {
  // ...
  },
  });

hey put this into md call it convex-agent

more documetation

AI Agents with Built-in Memory
Manage agent workflows with ease
Are you trying to build an Agent? An Agentic Workflow? An AI ChatBot? One of the challenges of building multi-step flows is managing the persistent state (e.g. chat messages) through a web of steps with different agents, and intelligently retrieve them for prompt context in the future. The new Agent component allows you to rapidly define and build agents, and incorporate them into complex workflows.

Some of the things Agent component makes easy for you:

Automatically store messages in user-specific threads that be handed off between agents.
Search messages via hybrid text and vector search and inject them as context (opt-in and configurable).
Define and use tool calling that support real-time, reactive queries so clients can see progress of asynchronously-executing workflows.
What’s an agentic workflow
There’s been a lot of interest recently in making asynchronous agentic workflows with memory.

Here’s what I mean by those terms:

Asynchronous: Long-lived operations that either happen from a user-initiated action, like asking a question in a support chat, or a trigger: a web hook, cron, or previously scheduled function.
Agentic: Conceptual units of responsibility that are “responsible” for something specific and have a set of actions (tools) available to them. Most often these look like calling an LLM.
Workflow: A set of functions that get called, passing context from one to another. The simplest version of this is a single function that calls agents (functions) and eventually returns a result. A fancy version of this looks like the Workflow component with Inngest-inspired syntax that runs durably (more on that below).
Memory: Contextual data that is saved and retrieved, for the use of informing future chats. This could be previous chat messages, use-case-specific data, or in the case of AI Town, reflections on conversations and previous memories.
Is this a new concept?
If you’re familiar with RAG, tool-calling, mixture of experts, dynamic dispatch, and durable functions, this should all be familiar. If not, don’t sweat it; fancy words are often simple concepts. The “tricks” involved are:

Break down a given task into pieces accomplished by specific LLMs models with domain-specific prompting.
Provide context to the LLM by using some combination of vector, text, and recency searches.
Allow the LLM to decide to “call out” to a “tool” when it needs more information or wants to take action. A good example of this is reading/writing code in a GitHub repo.
Run the workflow “durably” - allowing each unreliable step to have some retry behavior, and allow the overall function to recover after server crashes, always running to completion. Read more about why I’m excited about that here.
What does it look like
To get concrete, let’s look at defining an agent using my new Agent component

Defining an agent
import { Agent } from "@convex-dev/agent";
import { components, internal } from "./\_generated/api";
import { openai } from "@ai-sdk/openai";

const supportAgent = new Agent(components.agent, {
chat: openai.chat("gpt-4o-mini"),
textEmbedding: openai.embedding("text-embedding-3-small"),
instructions: "You are a helpful assistant.",
});

Starting a conversation
export const createThread = action({
args: { prompt: v.string() },
handler: async (ctx, { prompt }) => {

- const { threadId, thread } = await supportAgent.createThread(ctx, {});
- const result = await thread.generateText({ prompt });
  return { threadId, text: result.text };
  },
  });

Continuing a conversation
export const continueThread = action({
args: { prompt: v.string(), threadId: v.string() },
handler: async (ctx, { prompt, threadId }) => {
// This includes previous message history from the thread automatically.

- const { thread } = await supportAgent.continueThread(ctx, { threadId });
- const result = await thread.generateText({ prompt });
  return result.text;
  },
  });

Using tools
Tools are functions that the LLM can call. We use the AI SDK Tool syntax

Configuring tools:

const supportAgent = new Agent(components.agent, {
chat: openai.chat("gpt-4o-mini"),
textEmbedding: openai.embedding("text-embedding-3-small"),
instructions: "You are a helpful assistant.",

- tools: { accountLookup, fileTicket, sendEmail },
  });
  //...
  // or per-invocation in an action
  await thread.generateText({
  prompt,
- tools: { accountLookup, fileTicket, sendEmail },
  });

Defining Convex tools that have access to the function’s context, including userId, threadId, messageId, and the action ctx object which you can use to call queries, mutations, or actions:

export const ideaSearch = createTool({
description: "Search for ideas by space-delimited keywords",
args: z.object({ search: z.string().describe("What you seek") }),

- handler: async (ctx, { search }): Promise<Doc<"ideas">[]> =>
- ctx.runQuery(api.ideas.searchIdeas, { search }),
  });

Incorporating into a durable workflow
import { components, internal } from "./\_generated/api";
import { WorkflowManager } from "@convex-dev/workflow";

const workflow = new WorkflowManager(components.workflow);

export const weatherAgentWorkflow = workflow.define({
args: { location: v.string() },
handler: async (step, { location }): Promise<Outfit> => {

- const { threadId } = await step.runMutation(agent.createThread, {
-     userId: "123",
- });
- await step.runAction(
-     internal.example.getForecast,
-     { prompt: `What is the weather in ${location}?`, threadId },
-     { retry: true },
- );
- const { object: fashionSuggestion } = await step.runAction(
-     internal.example.getFashionAdvice,
-     { prompt: `What should I wear based on the weather?`, threadId },
-     { runAfter: 2 * SECOND },
- );
- return fashionSuggestion;
  },
  });

Subscribing to asynchronously-generated messages
This will fetch the thread’s messages, and re-run whenever new messages are created (within the query range). React clients can subscribe to the results with useQuery.

export const listMessages = query({
args: {
threadId: v.string(),
paginationOpts: paginationOptsValidator,
},
handler: async (ctx, args) => {
const { threadId, paginationOpts } = args;
await authorizeThreadAccess(ctx, threadId);

- const msgs = await agent.listMessages(ctx, {
-     threadId,
-     paginationOpts,
- });
  // Here you could add more fields to the messages, like the user's name.
  return msgs;
  },
  });

Using a user’s previous conversations as context manually
The agent will automatically pull in context based on the contextOptions parameter. If you don’t want the automatic behavior, you can provide messages yourself. You can also use the Agent's API to query for messages in the same way it would internally:

const messages = await weatherAgent.fetchContextMessages(ctx, {
userId,
threadId,
messages: [{ role: "user", content: text }],
contextOptions: {
searchOtherThreads: true,
recentMessages: 10,
searchOptions: {
textSearch: true,
vectorSearch: true,
messageRange: { before: 1, after: 1 },
limit: 10,
},
},
});
// do customization and add a final prompt message
const result = await thread.generateText({
messages,
{ prompt }, // either provide a prompt here or as the last message
saveMessages: "none",
// don't automatically fetch any context
contextOptions: {
recentMessages: 0,
searchOptions: { limit: 0 },
},
});

Retrying pesky LLMs who mean well but frequently goof up
Per-agent call retries (immediate, accounting for LLM blips):

const supportAgent = new Agent(components.agent, {
chat: openai.chat("gpt-4o-mini"),
textEmbedding: openai.embedding("text-embedding-3-small"),
instructions: "You are a helpful assistant.",
maxRetries: 3,
});

Retrying the whole action if the server restarts or the API provider is having issues by using the Workpool or Workflow components. This will use backoff and jitter to avoid thundering herds.

Workpool:

const workpool = new Workpool(components.workpool, {
maxParallelism: 10,
retryActionsByDefault: true,
defaultRetryBehavior: {
maxAttempts: 5,
initialBackoffMs: 1000,
base: 2,
},
});

Workflow:

const workflow = new WorkflowManager(components.workflow, {
workpoolOptions: {
maxParallelism: 10,
retryActionsByDefault: true,
defaultRetryBehavior: {
maxAttempts: 5,
initialBackoffMs: 1000,
base: 2,
},
},
});

Other capabiliities
Some other handy features:

Per-user usage tracking for tokens.
Dashboard playground UI to inspect threads, messages, and tool calls, as well as iterate on prompts, context and search options.
Automatic (or explicit) storage of files & images passed in, stored in Convex file storage and passed as URLs.
New features are being added continuously, so check out the Component page.

How does it work
Under the hood, it stores threads, messages, and stream deltas. Messages include the core LLM messages, as well as metadata about its generation and nest steps under the target message.

When you make a call from the thread-specific functions, it saves the input prompt (or the last message if you pass in an array of message1), and as it executes, it saves intermediate steps as it goes. It marks it all as pending until it’s done. If it fails and you call it again, it will mark the previous pending steps as failed.

The messages are query-able by thread, statuses, and whether they’re tool calls so you can subscribe to only what you need, avoiding excessive database bandwidth and function calls.

If you provide a text embedder, it will generate embeddings for each message to power vector search of previous messages per-thread, as well as optionally search across messages from all of the user's threads by passing searchOtherThreads: true.

Using bits and pieces
With any framework or abstraction, it provides value by being opinionated. It makes it easy to get going quickly and leverage ongoing improvements and new capabilities.

However, sometimes those opinions can get in the way. For istance, many apps abandon LangChain once they want more control over the prompting and internals. Michal wrote up a good piece about this a year ago after implementing RAG three ways.

Ideally a library or framework like this makes it easy to compose with other systems and use the pieces that work for you.

You can call the agents directly from Convex HTTP endpoints or serverless functions. You don’t have to use the fancy Workflow component.
You can generate or stream text synchronously in an action from clients, or asynchronously produce results that users can subscribe to via queries.
You can pass in custom context (messages) and not have it do any automatic context injection. This is useful if you’re pulling data from your own database tables or third-party resources.
You can do message search without calling an LLM, if you want to leverage its memory and modify it before making the call to generate anything.
You can save messages explicitly, instead of having it save them by default.
You can use any third-party tool that works with the AI SDK and can run in a serverless function (think: AWS lambda Node environment, with some limits on bundle and memory size).
You can create, paginate, modify, and delete the underlying embeddings. This is useful if you want to re-embed everything with a new model. By default, embeddings are isolated by model and embedding size, so you’ll never get results matching a different model’s embedding.
You can wrap tools with your own code, to add custom logic, validation, guardrails or transformations.
Goals
Specific things this component aims to do to avoid common pitfalls of other libraries:

Be clear about what it will and won’t do, with a clear mental model of how it works internally. Use existing language, concepts, and syntax, unless there’s an important reason to invent a new concept. For instance, while there are arguably better APIs for LLMs than OpenAI’s { role: "user", content: prompt }, it’s become a de-facto standard and a reasonable enough API. And the AI SDK is good enough to start.
Expose enough knobs and dials so users can tune the prompt to their use-case, with escape hatches for full control.
Build composable pieces, e.g. separating the Workflow, Agent, and RAG components, so you can use what makes sense.
Allowing writing “just code” instead of Domain-Specific Languages (DSLs) that struggle to balance expressivity and simplicity. Code ends up being more readable, maintainable and composable via abstractions. DSLs are great for many use-cases, but when you want more control, you'll reach for code.
To stay up to date with all the developments, join the #agents channel in Discord and open a GitHub issue for feature requests and feedback! 🙏

Summary
With agents you can organize and orchestrate complex workflows. With the new Agent component, you can store and retrieve message history automatically.

As always, let me know what you think in Discord, on 🦋 or on 𝕏

Footnotes
If you pass saveMessages: "all" it will save all of the messages automatically. The default is to only save the prompt / final input message and output messages since it’s common to pass in a lot of custom context that should not be saved, followed by a final user prompt. ↩
Build in minutes, scale forever.
Convex is the backend platform with everything you need to build your full-stack AI project. Cloud functions, a database, file storage, scheduling, workflow, vector search, and realtime updates fit together seamlessly.

Get started
