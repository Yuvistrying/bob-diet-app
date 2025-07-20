# Production Setup Checklist for Bob Diet Coach

## ✅ Completed
1. **Vercel Deployment**
   - Project created: `bob-diet-app`
   - Production URL: `https://bob-diet-app-yuvals-projects-54aba814.vercel.app`
   - All environment variables added via CLI
   - Build successful and app deployed

## 📋 Next Steps - External Service Updates

### 1. Clerk (Authentication)
Update your Clerk dashboard at https://dashboard.clerk.com:
- Add production URL to allowed origins:
  - `https://bob-diet-app-yuvals-projects-54aba814.vercel.app`
  - `https://*.vercel.app` (for preview deployments)
- Add redirect URLs:
  - Sign-in: `https://bob-diet-app-yuvals-projects-54aba814.vercel.app/sign-in`
  - Sign-up: `https://bob-diet-app-yuvals-projects-54aba814.vercel.app/sign-up`
  - After sign-in: `https://bob-diet-app-yuvals-projects-54aba814.vercel.app/chat`
  - After sign-up: `https://bob-diet-app-yuvals-projects-54aba814.vercel.app/pricing`

### 2. Convex (Database)
Deploy to production:
```bash
# Create production deployment
npx convex deploy --prod

# Update NEXT_PUBLIC_CONVEX_URL in Vercel
vercel env rm NEXT_PUBLIC_CONVEX_URL production
echo "YOUR_NEW_PRODUCTION_CONVEX_URL" | vercel env add NEXT_PUBLIC_CONVEX_URL production
```

### 3. Polar.sh (Payments)
Update webhook URL in Polar.sh dashboard:
- Webhook URL: `https://bob-diet-app-yuvals-projects-54aba814.vercel.app/api/webhooks/polar`
- Enable all subscription events

### 4. Update NEXT_PUBLIC_APP_URL
Already set to production URL in Vercel.

## 🌐 Optional: Custom Domain
To add a custom domain (e.g., bobdietcoach.com):
```bash
# Add domain to Vercel
vercel domains add bobdietcoach.com

# Update DNS records as instructed by Vercel
```

## 🧪 Testing Production
1. Visit: https://bob-diet-app-yuvals-projects-54aba814.vercel.app
2. Test sign-up flow
3. Test onboarding
4. Test food logging
5. Test subscription flow

## 📝 Environment Management
```bash
# View all environment variables
vercel env ls

# Pull env vars locally
vercel env pull .env.production

# Add/update a variable
echo "VALUE" | vercel env add KEY production

# Remove a variable
vercel env rm KEY production
```

## 🚀 Deployment Commands
```bash
# Deploy to production
vercel --prod

# Deploy to preview (for testing)
vercel

# Check deployment status
vercel ls

# View logs
vercel logs
```

## 🔄 Setting Up Staging Environment
```bash
# Create staging branch
git checkout -b staging
git push -u origin staging

# Configure Vercel to deploy staging branch
vercel git branch staging --scope yuvals-projects-54aba814

# Add staging-specific env vars
echo "VALUE" | vercel env add KEY preview
```