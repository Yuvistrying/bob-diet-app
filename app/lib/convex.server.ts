import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Create a server-side Convex client for React Router loaders/actions
export function getConvexClient() {
  const convexUrl = process.env.VITE_CONVEX_URL;
  
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL environment variable is not set");
  }
  
  return new ConvexHttpClient(convexUrl);
}

// Helper function to fetch queries
export async function fetchQuery<Query extends keyof typeof api>(
  query: Query,
  args: any
) {
  const client = getConvexClient();
  return client.query(query as any, args);
}

// Helper function to run actions
export async function fetchAction<Action extends keyof typeof api>(
  action: Action,
  args: any
) {
  const client = getConvexClient();
  return client.action(action as any, args);
} 