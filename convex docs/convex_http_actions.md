# HTTP Actions | Convex Developer Hub

HTTP actions allow you to build an HTTP API right in Convex! HTTP actions take in a Request and return a Response following the Fetch API. HTTP actions can manipulate the request and response directly, and interact with data in Convex indirectly by running queries, mutations, and actions.

HTTP actions might be used for receiving webhooks from external applications or defining a public HTTP API. HTTP actions are exposed at `https://<your deployment name>.convex.site` (e.g. `https://happy-animal-123.convex.site`).

## Defining HTTP actions

HTTP action handlers are defined using the `httpAction` constructor, similar to the `action` constructor for normal actions:

```typescript
import { httpAction } from "./_generated/server";

export const doSomething = httpAction(async () => {
  // implementation will be here
  return new Response();
});
```

The first argument to the handler is an `ActionCtx` object, which provides `auth`, `storage`, and `scheduler`, as well as `runQuery`, `runMutation`, `runAction`.

The second argument to the handler is a `Request` object. Here's an example that uses data from the request:

```typescript
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const postMessage = httpAction(async (ctx, request) => {
  const { author, body } = await request.json();

  await ctx.runMutation(internal.messages.sendOne, {
    body: `Sent via HTTP action: ${body}`,
    author,
  });

  return new Response(null, {
    status: 200,
  });
});
```

## Routing HTTP actions

To expose the HTTP Action, export an instance of `HttpRouter` from the `convex/http.ts` file. To create the instance call the `httpRouter` function. On the `HttpRouter` you can expose routes using the `route` method:

```typescript
import { httpRouter } from "convex/server";
import { postMessage } from "./messages";

const http = httpRouter();

http.route({
  path: "/postMessage",
  method: "POST",
  handler: postMessage,
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
```

The following options can be passed to the `route` method:

### `path`

The route path. Uses path-to-regexp for parsing.

```typescript
// matches /product/1, /product/2, etc. and extracts "1" or "2" as the `productId` param
path: "/product/:productId";

// matches /file/folder, /file/folder/sub, etc. and extracts everything after "/file" as the `path` param
path: "/file/:path+";

// matches /assets/folder, /assets/folder/sub, etc. and extracts everything after "/assets" as the `path` param
// (e.g. ["folder"] or ["folder", "sub"])
path: "/assets/{:path}*";

// matches /user/1, /users/2
path: "/users?/:id";
```

### `method`

The route method is a case-insensitive HTTP method (`GET` or `get` are treated identically). Defaults to `"GET"` if the method is not specified.

You can specify multiple methods for a single route:

```typescript
http.route({
  path: "/getOrPostMessage",
  method: ["GET", "POST"],
  handler: getOrPostMessage,
});
```

### `pathPrefix`

Use the `pathPrefix` field instead of `path` to match any requests matching the specified prefix. This can be used in combination with `Request.url` to implement slash commands or to directly serve HTTP traffic from Convex in a traditional web server setup.

### Examples

```typescript
const http = httpRouter();

// matches `/send-message`
http.route({
  path: "/send-message",
  method: "POST",
  handler: postMessage,
});

// matches GET requests to `/dynamicPathSegment/someFile`
http.route({
  pathPrefix: "/dynamicPathSegment/",
  method: "GET",
  handler: dynamicPathHandler,
});

// matches any HTTP method on exactly `/webhook`
http.route({
  path: "/webhook",
  method: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  handler: webhookHandler,
});

export default http;
```

## Request and Response

HTTP actions are built on the Fetch API and can manipulate `Request` and return `Response` instances.

`Request` can be used to access information about the request:

- `request.url`
- `request.method`
- `request.json()`, `request.text()`, `request.blob()`, `request.arrayBuffer()`
- `request.headers.get("Header-Name")`

`Response` can be used to return a custom HTTP response:

- `new Response("Hello world")` returns a 200 response
- `new Response(null, { status: 404 })` returns a 404
- `new Response(null, { status: 301, headers: { Location: "https://example.com" }}` redirects to example.com

## Features and Limitations

Like other Convex functions, you can view your HTTP actions in the Functions view of your dashboard and view logs produced by them in the Logs view.

HTTP actions run in the same environment as queries and mutations so also do not have access to Node.js-specific JavaScript APIs. HTTP actions can call actions, which can run in Node.js.

Like actions, HTTP actions may have side-effects and will not be automatically retried by Convex when errors occur. It is a responsibility of the caller to handle errors and retry the request if appropriate.

Request and response size is limited to 20MB.

HTTP actions support request and response body types of `.text()`, `.json()`, `.blob()`, and `.arrayBuffer()`.

Note that you don't need to define an HTTP action to call your queries, mutations and actions over HTTP if you control the caller, since you can use use the JavaScript `ConvexHttpClient` or the Python client to call these functions directly.

## Debugging

If you're having difficulty with HTTP actions, here are some debugging steps:

### Check the functions page

Check the functions page in the dashboard and make sure there's an entry called `http`. If not, double check that you've defined your HTTP actions with the `httpRouter` in a file called `http.js` or `http.ts` (the name of the file must match exactly), and that `npx convex dev` has no errors.

### Get your URL

Get your URL from the dashboard under Settings > URL and Deploy Key. Make sure this is the URL that ends in `.convex.site`, and not `.convex.cloud`. E.g. `https://happy-animal-123.convex.site`

### Run a curl command

Run a curl command to hit one of your defined endpoints, potentially defining a new endpoint specifically for testing:

```bash
curl -X GET https://<deployment name>.convex.site/myEndpoint
```

### Check the logs

Check the logs page in the dashboard to confirm that there's an entry for your HTTP action.

If you've determined that your HTTP actions have been deployed and are accessible via curl, but there are still issues requesting them from your app, check the exact requests being made by your browser.
