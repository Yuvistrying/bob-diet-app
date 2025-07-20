# Deployment Guide - Bob Diet Coach 🚀

This guide covers deploying Bob Diet Coach to staging and production environments using Vercel.

## 📋 Prerequisites

Before deploying, ensure you have:

- [ ] Vercel account with a team (for staging environment)
- [ ] Production Convex project created
- [ ] Production Clerk application configured
- [ ] Polar.sh webhook endpoints ready
- [ ] All API keys for production (Anthropic, OpenAI)
- [ ] Domain names for staging and production

## 🏗️ Environment Setup

### 1. Staging Environment

Staging allows testing changes before production deployment.

#### Create Staging Branch

```bash
git checkout -b staging
git push -u origin staging
```

#### Vercel Staging Setup

1. In Vercel Dashboard → Project Settings → Git
2. Add a new branch:
   - Branch: `staging`
   - Environment: Create new "Staging" environment
   - Domain: `staging.bobdietcoach.com` (or your choice)

#### Staging Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables → Staging:

```env
# Convex (Staging)
CONVEX_DEPLOYMENT=dev:staging-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://staging-deployment.convex.cloud

# Clerk (Staging Instance)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_staging_...
CLERK_SECRET_KEY=sk_test_staging_...

# Use same auth URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/pricing

# Polar.sh (Staging)
POLAR_ACCESS_TOKEN=polar_oat_staging_...
POLAR_ORGANIZATION_ID=staging_org_id
POLAR_WEBHOOK_SECRET=staging_webhook_secret

# AI Services (Can use same keys)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...

# App URL
NEXT_PUBLIC_APP_URL=https://staging.bobdietcoach.com
```

### 2. Production Environment

Production is your live environment serving real users.

#### Vercel Production Setup

1. Ensure `main` branch is set as production branch
2. Add production domain: `bobdietcoach.com`
3. Enable "Staged Deployments" for safety

#### Production Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables → Production:

```env
# Convex (Production)
CONVEX_DEPLOYMENT=prod:production-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://production-deployment.convex.cloud

# Clerk (Production Instance)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Auth URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/pricing

# Polar.sh (Production)
POLAR_ACCESS_TOKEN=polar_oat_prod_...
POLAR_ORGANIZATION_ID=prod_org_id
POLAR_WEBHOOK_SECRET=prod_webhook_secret

# AI Services (Production Keys)
ANTHROPIC_API_KEY=sk-ant-api03-prod-...
OPENAI_API_KEY=sk-proj-prod-...

# App URL
NEXT_PUBLIC_APP_URL=https://bobdietcoach.com
```

## 🔄 Deployment Process

### Deploying to Staging

1. **Merge changes to staging branch**

   ```bash
   git checkout staging
   git merge feature/your-feature
   git push origin staging
   ```

2. **Deploy Convex functions**

   ```bash
   npx convex deploy --deployment staging
   ```

3. **Verify deployment**
   - Check Vercel dashboard for build status
   - Visit staging URL
   - Run through test scenarios

### Deploying to Production

1. **Test thoroughly on staging first!**

2. **Create a pull request**

   ```bash
   git checkout main
   git pull origin main
   git merge staging
   git push origin main
   ```

3. **Deploy Convex to production**

   ```bash
   npx convex deploy --deployment production
   ```

4. **For staged production deployment**
   - Push to main branch
   - In Vercel dashboard, deployment won't auto-assign to domain
   - Test the deployment URL
   - If everything works, promote to production domain

5. **Post-deployment checks**
   - [ ] Homepage loads
   - [ ] Authentication works
   - [ ] Chat interface responds
   - [ ] Payments process correctly
   - [ ] Webhooks are received

## 🛡️ Security Checklist

Before each production deployment:

- [ ] No console.logs with sensitive data
- [ ] API keys are not exposed in code
- [ ] Environment variables are properly set
- [ ] CORS settings are restrictive
- [ ] Authentication is required for all protected routes
- [ ] Rate limiting is in place
- [ ] Error messages don't expose system details

## 📊 Monitoring

### Vercel Analytics

- Monitor Core Web Vitals
- Track deployment performance
- Set up alerts for errors

### Convex Dashboard

- Monitor function execution
- Check database performance
- Review error logs

### Error Tracking (Recommended)

Set up Sentry or similar:

```env
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

## 🔥 Rollback Procedures

### Quick Rollback via Vercel

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

### Git Rollback

```bash
# Find the last good commit
git log --oneline

# Revert to it
git revert HEAD
git push origin main
```

### Convex Rollback

```bash
# List deployments
npx convex deployment list

# Revert to previous version
npx convex deploy --deployment production --version previous-version
```

## 🚨 Emergency Procedures

### Take Site Offline

1. In Vercel → Settings → Functions
2. Set all functions to "Disabled"
3. Or use Vercel's maintenance mode

### Database Issues

1. Access Convex dashboard
2. Pause all functions if needed
3. Contact Convex support for critical issues

### High Traffic/DDoS

1. Enable Vercel's DDoS protection
2. Implement rate limiting
3. Scale up Vercel plan if needed

## 📝 Deployment Checklist

### Pre-Deployment

- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Database migrations prepared (if any)
- [ ] Environment variables verified
- [ ] Staging deployment successful
- [ ] Alpha/beta testers notified

### Deployment

- [ ] Deploy during low-traffic hours
- [ ] Monitor deployment progress
- [ ] Verify Convex functions deployed
- [ ] Check all environment variables

### Post-Deployment

- [ ] Smoke test critical paths
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify webhooks working
- [ ] Update status page (if applicable)

## 🔧 Troubleshooting

### Build Fails

1. Check build logs in Vercel
2. Verify all dependencies are installed
3. Ensure environment variables are set
4. Try building locally: `npm run build`

### Convex Connection Issues

1. Verify CONVEX_DEPLOYMENT is correct
2. Check Convex dashboard for errors
3. Ensure convex.json is not committed
4. Run `npx convex dev` to test connection

### Authentication Problems

1. Verify Clerk keys match environment
2. Check redirect URLs are correct
3. Ensure middleware.ts is properly configured
4. Test with Clerk dashboard

### Payment Webhook Failures

1. Verify webhook secret is correct
2. Check Polar.sh webhook logs
3. Ensure webhook endpoint is public
4. Test with Polar.sh webhook tester

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Convex Deployment Guide](https://docs.convex.dev/production)
- [Clerk Production Checklist](https://clerk.dev/docs/production)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## 🆘 Support Contacts

- **Vercel Support**: support.vercel.com
- **Convex Support**: support@convex.dev
- **Clerk Support**: support@clerk.dev
- **Internal**: devops@bobdietcoach.com

---

Remember: **Always test on staging before deploying to production!** 🧪➡️🚀
