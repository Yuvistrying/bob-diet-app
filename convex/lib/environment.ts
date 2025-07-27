/**
 * Environment detection for multi-tenant Convex setup
 * Since we're using the same Convex instance for dev and staging,
 * we need to know which environment is making the request
 */

export function getEnvironment(clerkUserId?: string | null): "development" | "staging" | "production" {
  // In production Convex, always return production
  if (process.env.CONVEX_DEPLOYMENT?.includes("fine-viper")) {
    return "production";
  }
  
  // For dev Convex (acoustic-scorpion), we need to detect if it's staging or local dev
  // We can use the Clerk user ID pattern or other indicators
  
  // Option 1: Check if running in Convex cloud (staging) vs local (dev)
  // When deployed to Convex cloud, certain env vars are set
  if (process.env.CONVEX_CLOUD_URL) {
    // This is running in Convex cloud, but we need to distinguish between
    // calls from staging frontend vs local dev
    // For now, we'll need to pass this info from the frontend
    return "development"; // Default to dev for safety
  }
  
  return "development";
}

export function getClerkFrontendUrl(environment: ReturnType<typeof getEnvironment>): string {
  switch (environment) {
    case "staging":
      return process.env.CLERK_STAGING_FRONTEND_API_URL || "";
    case "production":
      return process.env.CLERK_PRODUCTION_FRONTEND_API_URL || "";
    default:
      return process.env.CLERK_DEV_FRONTEND_API_URL || process.env.CLERK_FRONTEND_API_URL || "";
  }
}

export function getPolarConfig(environment: ReturnType<typeof getEnvironment>) {
  switch (environment) {
    case "staging":
      return {
        accessToken: process.env.POLAR_STAGING_ACCESS_TOKEN || "",
        organizationId: process.env.POLAR_STAGING_ORGANIZATION_ID || "",
      };
    case "production":
      return {
        accessToken: process.env.POLAR_PRODUCTION_ACCESS_TOKEN || "",
        organizationId: process.env.POLAR_PRODUCTION_ORGANIZATION_ID || "",
      };
    default:
      return {
        accessToken: process.env.POLAR_DEV_ACCESS_TOKEN || process.env.POLAR_ACCESS_TOKEN || "",
        organizationId: process.env.POLAR_DEV_ORGANIZATION_ID || process.env.POLAR_ORGANIZATION_ID || "",
      };
  }
}