# Sentry Setup Guide for Bob Diet Coach

## Overview

This guide will walk you through setting up Sentry for production error monitoring and performance tracking. We've already configured the codebase - you just need to get the credentials from Sentry and add them to Vercel.

## What You Need From Sentry

### 1. Create a Sentry Account
1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Sign up with your email (recommend using your production email)
3. Choose the **Developer** plan (free tier includes 5K errors/month)

### 2. Create Your Project
1. Click **Create Project**
2. Select platform: **Next.js**
3. Configure project:
   - Project name: `bob-diet-coach` (or `bob-diet-coach-production`)
   - Team: Create a new team or use default
4. Click **Create Project**

### 3. Collect Your Credentials

After creating the project, you need to collect these values:

#### A. DSN (Data Source Name)
- Location: **Settings → Projects → [Your Project] → Client Keys (DSN)**
- Format: `https://1234567890abcdef@o123456.ingest.sentry.io/1234567`
- This goes in: `NEXT_PUBLIC_SENTRY_DSN`

#### B. Organization Slug
- Location: **Settings → General Settings**
- Usually your username or org name (e.g., `yuval-y1`)
- This goes in: `SENTRY_ORG`

#### C. Project Slug
- Location: **Settings → Projects → [Your Project]**
- The name you gave your project (e.g., `bob-diet-coach`)
- This goes in: `SENTRY_PROJECT`

#### D. Auth Token
- Location: **Settings → Account → Auth Tokens**
- Click **Create New Token**
- Scopes needed:
  - ✅ project:releases
  - ✅ org:read
  - ✅ project:write
- Name it: `bob-diet-coach-production`
- Copy the token (starts with `sntrys_`)
- This goes in: `SENTRY_AUTH_TOKEN`

## Adding to Vercel

### 1. Go to Vercel Dashboard
1. Navigate to your project
2. Go to **Settings → Environment Variables**

### 2. Add Production Variables
Add these variables for **Production** environment only:

```bash
# Public DSN (visible to client)
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_DSN_HERE@o0.ingest.sentry.io/0

# Build-time variables (for source maps)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=bob-diet-coach
SENTRY_AUTH_TOKEN=sntrys_YOUR_AUTH_TOKEN_HERE

# Optional but recommended
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

### 3. Redeploy
After adding the variables, trigger a new deployment to apply the changes.

## What's Already Configured

✅ **Sentry SDK Integration**
- Client, server, and edge configs
- Production-only initialization
- Error filtering and grouping

✅ **Performance Monitoring**
- 10% transaction sampling
- Browser tracing enabled
- Custom spans for key operations

✅ **Session Replay**
- 10% of all sessions
- 100% of sessions with errors
- Privacy: All text masked, media blocked

✅ **Error Handling**
- Global error boundary
- API route error tracking
- Convex function monitoring (when enabled)

✅ **Smart Filtering**
- Browser extension errors ignored
- Network errors grouped
- ResizeObserver errors filtered
- Convex rate limits grouped

✅ **User Context**
- Clerk user ID attached to errors
- User email for identification
- Session tracking

✅ **Release Tracking**
- Git commit SHA as release version
- Deployment tracking
- Source maps for debugging

## Testing Your Setup

### 1. Deploy to Production
Push your changes and let Vercel deploy.

### 2. Test Error Capture
Visit: `https://yourdomain.com/sentry-example-page`

Click the test buttons:
- "Throw Test Error" - Tests frontend error capture
- "Test API Error" - Tests backend error capture

### 3. Verify in Sentry Dashboard
1. Go to your Sentry project
2. Check **Issues** - You should see the test errors
3. Check **Performance** - You should see transactions
4. Check **Replays** - You should see session replays

### 4. Remove Test Page
After confirming it works, remove the test page from production.

## Monitoring Best Practices

### Daily Checks
- Error rate trends
- New error types
- Performance degradation

### Weekly Reviews
- Most frequent errors
- User impact analysis
- Performance bottlenecks

### Monthly Analysis
- Error patterns
- Release health
- Cost optimization

## Alert Configuration

In Sentry, set up these alerts:

1. **Critical Error Alert**
   - Condition: First seen error
   - Action: Email immediately

2. **Error Rate Spike**
   - Condition: Error rate > 10/hour
   - Action: Email + Slack (if configured)

3. **Performance Alert**
   - Condition: P95 > 3 seconds
   - Action: Email notification

4. **Crash Free Rate**
   - Condition: < 99.5%
   - Action: Email + review required

## Cost Management

### Free Tier Limits
- 5,000 errors/month
- 10,000 performance events/month
- 50 replays/month
- 10GB attachments

### Optimization Tips
1. Keep sampling rates low (10% is good)
2. Filter out noise errors
3. Use error grouping
4. Archive resolved issues
5. Monitor quota usage

### When to Upgrade
- Consistently hitting error limits
- Need more team members
- Want longer data retention
- Need advanced features

## Troubleshooting

### Errors Not Appearing
1. Check environment variables in Vercel
2. Verify DSN is correct
3. Ensure production deployment
4. Check browser console for Sentry init errors

### Source Maps Not Working
1. Verify AUTH_TOKEN is set
2. Check SENTRY_ORG and SENTRY_PROJECT match
3. Look for upload errors in build logs

### Performance Issues
1. Reduce sampling rates
2. Disable session replay if needed
3. Filter more error types

## Integration with Convex

To enable Sentry in Convex functions:

```bash
# Run this after Sentry is working
npx convex functions sentry init --prod
```

This will:
- Add error tracking to all Convex functions
- Link errors to your Sentry project
- Provide better error context

## Need Help?

1. Check Sentry docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
2. Our implementation: See files marked with "sentry" in the codebase
3. Sentry support: https://sentry.zendesk.com/

## Quick Checklist

- [ ] Created Sentry account
- [ ] Created Next.js project in Sentry
- [ ] Collected DSN
- [ ] Collected Organization slug
- [ ] Collected Project slug
- [ ] Created and collected Auth Token
- [ ] Added all variables to Vercel Production
- [ ] Deployed to production
- [ ] Tested error capture
- [ ] Configured alerts
- [ ] Removed test page

That's it! Your production app now has comprehensive error and performance monitoring.