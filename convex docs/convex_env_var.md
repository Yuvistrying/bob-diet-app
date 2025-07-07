# Environment Variables | Convex Developer Hub

Environment variables are key-value pairs that are useful for storing values you wouldn't want to put in code or in a table, such as an API key. You can set environment variables in Convex through the dashboard, and you can access them in functions using `process.env`.

## Setting environment variables

### Dashboard

Under Deployment Settings in the Dashboard, you can see a list of environment variables in the current deployment. You can add up to 100 environment variables.

Environment variable names cannot be more than 40 characters long, and they must start with a letter and only contain letters numbers, and underscores.

Environment variable values cannot be larger than 8KB.

You can modify environment variables using the pencil icon button.

### Command Line

Environment variables can also be viewed and modified with the command line.

```bash
npx convex env list
npx convex env set API_KEY secret-api-key
```

## Using environment variables

Since environment variables are set per-deployment, you can use different values for the same key in dev and prod deployments.

```typescript
import { action } from "./_generated/server";

export const myAction = action({
  handler: async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set");
    }

    const response = await fetch("https://api.example.com", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Process response...
  },
});
```

## Important Notes

### Evaluation Time

Environment variables are evaluated when a new backend version is pushed, not when the function executes.

This means you cannot use environment variables to conditionally define functions:

```typescript
// THIS WILL NOT WORK!
export const myFunc = process.env.DEBUG
  ? mutation(...)
  : internalMutation(...);
```

Similarly, environment variables used in cron definitions will only be reevaluated on deployment.

### Built-in Environment Variables

The following environment variables are always available in Convex functions:

- `CONVEX_CLOUD_URL` - Your deployment URL (eg. `https://dusty-nightingale-847.convex.cloud`) for use with Convex clients.
- `CONVEX_SITE_URL` - Your deployment site URL (eg. `https://dusty-nightingale-847.convex.site`) for use with HTTP Actions

## Default Environment Variables

You can set up default environment variable values for a project for development and preview deployments in Project Settings. These default values will be used when creating a new development or preview deployment, and will have no effect on existing deployments (they are not kept in sync).

## Best Practices

1. **Never commit sensitive values**: Always use environment variables for API keys, secrets, and other sensitive information.

2. **Validate presence**: Always check that required environment variables are set before using them:

```typescript
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable not set");
}
```

3. **Use descriptive names**: Use clear, uppercase names with underscores (e.g., `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`).

4. **Document required variables**: Keep a list of required environment variables in your project documentation or README.

5. **Different values per environment**: Use different API keys and configuration for development and production environments.
