# Convex Authentication Fix

The error "No auth provider found matching the given token" means Convex can't validate Clerk tokens.

## Required Environment Variables in Convex Production

Make sure these are set in your Convex production deployment:

1. **CLERK_FRONTEND_API_URL** = `https://clerk.bobdietcoach.ai`
   - This is CRITICAL for authentication to work
   - It tells Convex where to validate Clerk tokens

2. **FRONTEND_URL** = `https://bobdietcoach.ai`
   - Used for redirect URLs

3. Remove **CLERK_SECRET_KEY** if it exists (not needed in Convex)

## Other Required Variables

- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- POLAR_ACCESS_TOKEN
- POLAR_ORGANIZATION_ID
- POLAR_WEBHOOK_SECRET = `0114a959684e464fbc2673a478c36bb4`

## To Verify

1. Go to your Convex dashboard
2. Select your production deployment (fine-viper-112)
3. Go to Settings → Environment Variables
4. Make sure CLERK_FRONTEND_API_URL is set correctly
5. Save and restart the deployment if needed

## Important

The CLERK_FRONTEND_API_URL must match your Clerk domain exactly. This is what allows Convex to authenticate users.
