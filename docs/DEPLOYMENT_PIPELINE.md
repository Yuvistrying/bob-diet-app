# Professional 3-Stage Deployment Pipeline

## Overview

We've implemented a professional deployment pipeline with complete environment isolation. Each stage has its own infrastructure, preventing any cross-contamination of data, users, or configurations.

## The Pipeline Flow

### 1. 🚧 **Local Development** (Heavy Dev)
**Purpose**: Rapid iteration and feature development

```bash
npm run dev          # Start Next.js on http://localhost:5174
npx convex dev       # Start Convex dev server (separate terminal)
```

**Infrastructure**:
- **Convex**: `acoustic-scorpion-920` (dev instance)
- **Clerk**: Test instance (`dear-starling-14.clerk.accounts.dev`)
- **Polar**: Dev organization (sandbox mode)
- **Database**: Isolated dev data

**When to use**:
- Building new features
- Debugging issues
- Testing integrations
- Breaking things safely

### 2. 🎭 **Staging Environment** (When Ready)
**Purpose**: Production-like testing before release

```bash
git checkout staging
git merge feature-branch  # or develop directly on staging
git push origin staging   # Auto-deploys to Vercel
```

**Infrastructure**:
- **URL**: `https://bob-diet-app-git-staging-yuvals-projects-54aba814.vercel.app`
- **Convex**: `small-mammoth-405` (staging instance)
- **Clerk**: Staging instance (`evolving-penguin-29.clerk.accounts.dev`)
- **Polar**: Staging organization (sandbox mode)
- **Database**: Isolated staging data
- **Visual**: Shows "STAGING" indicator

**When to use**:
- Testing complete features
- Sharing with team for review
- Testing payment flows (sandbox)
- Final validation before production

### 3. 🚀 **Production** (Like True Pros)
**Purpose**: Live environment for real users

```bash
git checkout main
git merge staging         # Only after staging tests pass
git push origin main      # Auto-deploys to Vercel
```

**Infrastructure**:
- **URL**: `https://bobdietcoach.ai`
- **Convex**: `fine-viper-112` (production instance)
- **Clerk**: Production instance
- **Polar**: Production organization (live payments)
- **Database**: Real user data
- **Visual**: No environment indicator

**When to deploy**:
- Staging tests are 100% passing
- Feature is complete and polished
- Team has approved
- You're ready to monitor for 30 minutes post-deploy

## Environment Isolation

Each environment is completely isolated:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    LOCAL    │     │   STAGING   │     │ PRODUCTION  │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ Clerk Dev   │     │ Clerk Stage │     │ Clerk Prod  │
│ Convex Dev  │     │Convex Stage│     │ Convex Prod │
│ Polar Dev   │     │ Polar Stage │     │ Polar Prod  │
│ Test Data   │     │ Stage Data  │     │ Real Data   │
└─────────────┘     └─────────────┘     └─────────────┘
      ↓                    ↓                    ↓
  Break Things        Test Safely          Ship It! 
```

## Quick Commands

### Switch Environments
```bash
# Local development (default)
npm run dev
npx convex dev

# Deploy to staging
git push origin staging

# Deploy to production
git push origin main
```

### Environment Variables
- **Local**: `.env.local` (gitignored)
- **Staging**: Set in Vercel dashboard (Preview environment)
- **Production**: Set in Vercel dashboard (Production environment)

### Check Deployments
```bash
# Local
http://localhost:5174

# Staging
https://bob-diet-app-git-staging-yuvals-projects-54aba814.vercel.app

# Production
https://bobdietcoach.ai
```

## Best Practices

### 1. Never Skip Staging
- Always test in staging first
- Wait for build to complete
- Test critical user flows
- Check error logs

### 2. Feature Branch Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Develop locally
# ... make changes ...

# Test in staging
git checkout staging
git merge feature/new-feature
git push origin staging

# If all good, merge to production
git checkout main
git merge staging
git push origin main
```

### 3. Post-Deployment Checklist
- [ ] Check build logs in Vercel
- [ ] Test auth flow
- [ ] Test payment flow
- [ ] Check Convex logs
- [ ] Monitor for 30 minutes
- [ ] Check error tracking (Sentry - coming soon)

## Common Issues

### Deployment Failed
1. Check Vercel build logs
2. Verify environment variables are set
3. Check for TypeScript errors: `npm run typecheck`
4. Ensure Convex schema is deployed

### Wrong Environment
1. Check URL in browser
2. Look for environment indicator
3. Verify Convex deployment: `npx convex dashboard`

### Data Not Syncing
1. Each environment has isolated data
2. User accounts don't transfer between environments
3. This is by design for safety

## The Professional Touch

This pipeline ensures:
- **Safety**: Can't accidentally break production
- **Confidence**: Everything tested before release
- **Speed**: Automatic deployments on push
- **Isolation**: No data contamination
- **Visibility**: Clear environment indicators

We're deploying like true pros - no more YOLO pushes to production! 🚀