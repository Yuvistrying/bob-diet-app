# Sentry Multi-Environment Setup Guide

## Overview

This guide covers setting up Sentry across all environments (development, staging, and production) for the Bob Diet Coach application. This setup allows you to:

- Test Sentry integration locally before deploying
- Catch errors early in development
- Verify everything works in staging before production
- Track issues across different environments

## Configuration Approach

### Option 1: Single Sentry Project (Recommended for Start)
Use one Sentry project for all environments. Sentry will automatically separate issues by environment.

**Pros:**
- Simpler setup
- Single DSN to manage
- Easy to compare issues across environments

**Cons:**
- All environments share the same quota
- Less granular control over alerts

### Option 2: Separate Projects per Environment
Create separate Sentry projects for dev, staging, and production.

**Pros:**
- Separate quotas for each environment
- Environment-specific alerts and settings
- Better isolation

**Cons:**
- More complex setup
- Multiple DSNs to manage

## Setup Instructions

### 1. Create Your Sentry Account & Project(s)

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Create your organization
3. Create your project(s):
   - **Single Project**: Name it `bob-diet-coach`
   - **Multiple Projects**: Create `bob-diet-coach-dev`, `bob-diet-coach-staging`, `bob-diet-coach-prod`

### 2. Collect Your Credentials

For each project/environment, collect:

- **DSN**: Found in Settings → Client Keys
- **Auth Token**: Settings → Auth Tokens (create one with proper scopes)
- **Organization Slug**: Your org name
- **Project Slug**: Your project name

### 3. Configure Environment Variables

#### Local Development (.env.local)
```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_DEV_DSN@o0.ingest.sentry.io/0
SENTRY_ORG=your-org-name
SENTRY_PROJECT=bob-diet-coach
SENTRY_AUTH_TOKEN=sntrys_YOUR_AUTH_TOKEN

# Optional: Force environment name
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
```

#### Staging (Vercel Staging Environment)
```env
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_STAGING_DSN@o0.ingest.sentry.io/0
SENTRY_ORG=your-org-name
SENTRY_PROJECT=bob-diet-coach-staging
SENTRY_AUTH_TOKEN=sntrys_YOUR_AUTH_TOKEN
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
```

#### Production (Vercel Production Environment)
```env
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_PROD_DSN@o0.ingest.sentry.io/0
SENTRY_ORG=your-org-name
SENTRY_PROJECT=bob-diet-coach-prod
SENTRY_AUTH_TOKEN=sntrys_YOUR_AUTH_TOKEN
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
```

### 4. Environment Detection

The Sentry configuration automatically detects the environment using this hierarchy:

1. `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (if explicitly set)
2. `VERCEL_ENV` (automatically set by Vercel)
3. `NODE_ENV` (development/production)
4. Defaults to 'development'

### 5. Performance Sampling by Environment

The configuration automatically adjusts sampling rates:

- **Development/Staging**: 100% transaction sampling for complete visibility
- **Production**: 10% transaction sampling to manage costs

```javascript
tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
```

## Running the Sentry Wizard

After setting up your environment variables, you can run the Sentry wizard to ensure everything is configured correctly:

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard will:
- Detect your existing configuration
- Update any outdated patterns
- Add any missing integrations
- Create example pages if needed

**Note**: Since we've already set up most configurations manually, the wizard should recognize this and only make minor adjustments if needed.

## Testing Your Setup

### 1. Local Development
```bash
npm run dev
```
- Visit `/sentry-example-page`
- Trigger test errors
- Check your Sentry dashboard (dev project)

### 2. Staging Deployment
```bash
git push origin staging
```
- Visit `https://staging.yourdomain.com/sentry-example-page`
- Test errors appear in staging project/environment

### 3. Production Deployment
```bash
git push origin main
```
- Verify in production project/environment

## Monitoring & Alerts

### Environment-Specific Alerts

Set up different alert thresholds per environment:

#### Development
- High threshold for alerts (reduce noise)
- Focus on new issue types
- No rate limiting alerts

#### Staging
- Medium thresholds
- Test alert integrations
- Performance baseline monitoring

#### Production
- Strict thresholds
- Immediate alerts for critical errors
- Performance degradation alerts
- User impact monitoring

### Recommended Alert Rules

1. **New Issue Alert** (All Environments)
   - Condition: First occurrence
   - Action: Email/Slack notification

2. **Error Rate Spike** (Staging/Production)
   - Development: > 50 errors/hour
   - Staging: > 20 errors/hour
   - Production: > 10 errors/hour

3. **Performance Alert** (Production)
   - P95 response time > 3 seconds
   - Database query time > 1 second

## Cost Management

### Free Tier Optimization

With environments active in all stages:

1. **Use Lower Sampling in Dev**
   ```javascript
   // In sentry config
   tracesSampleRate: 
     process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'development' ? 0.01 : 
     process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === 'staging' ? 0.1 : 
     0.1,
   ```

2. **Aggressive Filtering**
   - Filter more errors in dev/staging
   - Only critical errors in production

3. **Separate Projects**
   - Each gets its own free tier quota
   - 5K errors × 3 environments = 15K total

## Best Practices

### 1. Environment Hygiene
- Clear environment names in Sentry UI
- Consistent naming across services
- Tag releases with environment

### 2. Development Workflow
```bash
# Before committing
- Test locally with Sentry active
- Verify errors appear correctly
- Check performance metrics

# Before merging to staging
- Ensure no dev-specific errors
- Clean up test errors
```

### 3. Staging Validation
- Run full test suite with Sentry
- Verify all integrations work
- Test error grouping/filtering
- Validate performance baselines

### 4. Production Monitoring
- Set up dashboards per environment
- Daily error rate reviews
- Weekly performance analysis
- Monthly quota optimization

## Environment-Specific Features

### Development Only
- Verbose logging
- All transactions sampled
- Detailed breadcrumbs
- No PII masking (for debugging)

### Staging
- Production-like configuration
- Test alert channels
- Performance benchmarking
- Limited PII masking

### Production
- Optimized sampling
- Full PII protection
- Critical alerts only
- Session replay for errors

## Troubleshooting

### Errors Not Appearing
1. Check DSN is set correctly
2. Verify environment detection:
   ```javascript
   console.log('[Sentry] Environment:', process.env.NODE_ENV);
   ```
3. Check browser console for Sentry init logs

### Wrong Environment
1. Set `NEXT_PUBLIC_SENTRY_ENVIRONMENT` explicitly
2. Check Vercel environment variables
3. Verify in Sentry UI under issue details

### Performance Issues
1. Reduce sampling rates in development
2. Disable session replay in dev
3. Filter more breadcrumb types

## Quick Reference

### Commands
```bash
# Install/Update Sentry
npm install @sentry/nextjs@latest

# Run wizard
npx @sentry/wizard@latest -i nextjs

# Test locally
npm run dev
# Visit /sentry-example-page

# Deploy to staging
git push origin staging

# Deploy to production
git push origin main
```

### Environment Variables Template
```env
# Required
NEXT_PUBLIC_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=sntrys_xxx

# Optional
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development|staging|production
```

That's it! You now have Sentry active across all environments for comprehensive error and performance monitoring.