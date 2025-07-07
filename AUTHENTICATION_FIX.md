# Authentication Fix for Vercel AI SDK with Convex

## Problem

When using HTTP actions with Convex, we encountered 401 Unauthorized errors even though authentication was properly configured with Clerk.

## Root Cause

HTTP actions in Convex require special handling for authentication tokens, and the Vercel AI SDK's `useChat` hook doesn't integrate seamlessly with Convex's HTTP endpoints.

## Solution

Instead of using HTTP actions, use Convex actions which handle authentication automatically.

### Steps to Fix:

1. **Use Convex Actions instead of HTTP Actions**
   - Actions automatically handle authentication through `ctx.auth.getUserIdentity()`
   - No need to manually pass Bearer tokens

2. **Update ai.ts to use Vercel AI SDK with Actions**

   ```typescript
   import { streamText, tool } from "ai";

   export const chatAction = action({
     handler: async (ctx, args) => {
       // Auth check happens automatically
       const identity = await ctx.auth.getUserIdentity();
       if (!identity) throw new Error("Not authenticated");

       // Use streamText with tools
       const result = await streamText({
         model: anthropic("claude-sonnet-4-20250514"),
         messages: args.messages,
         tools,
       });

       // Return the response
       return { text: cleanedText };
     },
   });
   ```

3. **Update Chat Component**

   ```typescript
   // Instead of useChat from ai/react
   const sendMessage = useAction(api.ai.chatAction);

   // Handle messages manually
   const response = await sendMessage({ messages });
   ```

### Key Differences:

- **HTTP Actions**: Require manual token passing, CORS configuration
- **Convex Actions**: Authentication handled automatically by Convex

### Benefits:

- No authentication errors
- Simpler code
- Still supports Vercel AI SDK features (streaming, tools)
- Chat persistence works seamlessly

## Testing

1. Run `npm run dev`
2. Sign in with Clerk
3. Try chatting - authentication should work automatically
4. Messages persist when switching tabs
5. Food confirmation flow works with tool calling
