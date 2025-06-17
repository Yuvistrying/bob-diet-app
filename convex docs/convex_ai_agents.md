Stack logo
Patterns
Perspectives
Walkthroughs
Chef
Local-First
AI

⌘K

Ian Macartney's avatar
Ian Macartney
2 months ago
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
import { components, internal } from "./_generated/api";
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
+   const { threadId, thread } = await supportAgent.createThread(ctx, {});
+   const result = await thread.generateText({ prompt });
    return { threadId, text: result.text };
  },
});

Continuing a conversation
export const continueThread = action({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    // This includes previous message history from the thread automatically.
+   const { thread } = await supportAgent.continueThread(ctx, { threadId });
+   const result = await thread.generateText({ prompt });
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
+ tools: { accountLookup, fileTicket, sendEmail },
});
//...
  // or per-invocation in an action
  await thread.generateText({ 
    prompt,
+   tools: { accountLookup, fileTicket, sendEmail },
  });

Defining Convex tools that have access to the function’s context, including userId, threadId, messageId, and the action ctx object which you can use to call queries, mutations, or actions:

export const ideaSearch = createTool({
  description: "Search for ideas by space-delimited keywords",
  args: z.object({ search: z.string().describe("What you seek") }),
+ handler: async (ctx, { search }): Promise<Doc<"ideas">[]> =>
+    ctx.runQuery(api.ideas.searchIdeas, { search }),
});

Incorporating into a durable workflow
import { components, internal } from "./_generated/api";
import { WorkflowManager } from "@convex-dev/workflow";

const workflow = new WorkflowManager(components.workflow);

export const weatherAgentWorkflow = workflow.define({
  args: { location: v.string() },
  handler: async (step, { location }): Promise<Outfit> => {
+   const { threadId } = await step.runMutation(agent.createThread, {
+     userId: "123",
+   });
+   await step.runAction(
+     internal.example.getForecast,
+     { prompt: `What is the weather in ${location}?`, threadId },
+     { retry: true },
+   );
+   const { object: fashionSuggestion } = await step.runAction(
+     internal.example.getFashionAdvice,
+     { prompt: `What should I wear based on the weather?`, threadId },
+     { runAfter: 2 * SECOND },
+   );
+   return fashionSuggestion;
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
+   const msgs = await agent.listMessages(ctx, {
+     threadId,
+     paginationOpts,
+   });
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

As always, let me know what you think in Discord, on 🦋  or on 𝕏

Footnotes
If you pass saveMessages: "all" it will save all of the messages automatically. The default is to only save the prompt / final input message and output messages since it’s common to pass in a lot of custom context that should not be saved, followed by a final user prompt. ↩
Build in minutes, scale forever.
Convex is the backend platform with everything you need to build your full-stack AI project. Cloud functions, a database, file storage, scheduling, workflow, vector search, and realtime updates fit together seamlessly.

Get started
AI
Patterns
Walkthroughs
Join the Convex Community
Ask the team questions, learn from others, and stay up-to-date on the latest with Convex.
Discord logoJoin the Discord community
Share this article



Read next
Components for your Backend
Convex Components enable an ecosystem of powerful building blocks to reduce the amount of code you have to write and maintain yourself. Geospatial search, Expo push notifications, LaunchDarkly feature flags, durable function workflows, and more.
Ian Macartney's avatar
Ian Macartney
multiple puzzle pieces connecting with circuitry to some main technology, to represent convex components.
AI Agents (and humans) do better with good abstractions
Chef by Convex builds real full-stack apps in one prompt—Notion, Slack, and more. It works because Convex’s abstractions are simple enough for both humans and AI to use. Built-in features and plug-and-play components let developers skip boilerplate and ship fast.
Emma Forman Ling's avatar
Emma Forman Ling
AI Agents (and humans) do better with good abstractions
Why I picked Convex over Firebase, Supabase, and Neon for my app
Building a language learning app meant I needed a backend that could handle realtime sync, multilingual support, and type-safe code. I didn’t start with Convex—I evaluated Firebase, PlanetScale, Supabase, Neon, and others first. Each had tradeoffs: Firebase felt disjointed and buggy; PlanetScale lacked international support; Supabase leaned too hard into SQL; and Neon made realtime too complicated. What made Convex different was how little backend glue I needed to write. Realtime sync just worked. TypeScript felt native. My frontend felt alive without hacks. It felt like hiring a backend team on day one. A year later, I’m still shipping fast—and glad I made the switch. This post breaks down what I found, what failed, and why Convex ended up being the best database for a modern TypeScript app like LanguageHopper.
Matt Luo's avatar
Matt Luo
Why I picked Convex over Firebase, Supabase, and Neon for my app
Stack logo
Sync up on the latest from Convex.

Docs
Dashboard
GitHub
Discord
Twitter
Jobs
Legal
©2025 Convex, Inc.
