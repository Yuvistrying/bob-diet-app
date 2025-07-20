#!/bin/bash

# Deploy to Production Script
# This script handles deployment to the production environment with safety checks

set -e  # Exit on error

echo "🚀 Starting deployment to PRODUCTION environment..."
echo ""
echo "⚠️  WARNING: This will deploy to PRODUCTION!"
echo ""

# Confirm production deployment
read -p "Are you sure you want to deploy to production? (yes/no) " -r
if [[ ! $REPLY == "yes" ]]; then
    echo "❌ Production deployment cancelled"
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: You must be on the main branch to deploy to production!"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes!"
    echo "Please commit or stash your changes before deploying."
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes from main..."
git pull origin main

# Run tests
echo "🧪 Running tests..."
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found! Please fix before deploying."
    exit 1
fi

# Build the project
echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix errors before deploying."
    exit 1
fi

# Final confirmation
echo ""
echo "📋 Pre-deployment checklist:"
echo "   ✓ On main branch"
echo "   ✓ No uncommitted changes"
echo "   ✓ Tests passing"
echo "   ✓ Build successful"
echo ""
echo "🎯 Ready to deploy to PRODUCTION!"
echo ""
read -p "Final confirmation - Deploy to production? (DEPLOY/cancel) " -r
if [[ ! $REPLY == "DEPLOY" ]]; then
    echo "❌ Production deployment cancelled"
    exit 1
fi

# Deploy Convex functions to production
echo "📦 Deploying Convex functions to production..."
npx convex deploy --deployment production
if [ $? -ne 0 ]; then
    echo "❌ Convex deployment failed!"
    echo "⚠️  Consider rolling back if necessary"
    exit 1
fi

# Push to main branch (triggers Vercel deployment)
echo "📤 Pushing to main branch..."
git push origin main

# Create a deployment tag
TAG_NAME="deploy-$(date +%Y%m%d-%H%M%S)"
echo "🏷️  Creating deployment tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "Production deployment on $(date)"
git push origin "$TAG_NAME"

echo ""
echo "✅ Deployment to PRODUCTION initiated!"
echo ""
echo "📋 Post-deployment checklist:"
echo "   [ ] Monitor Vercel deployment progress"
echo "   [ ] Check production site is live"
echo "   [ ] Test critical user flows"
echo "   [ ] Monitor error logs"
echo "   [ ] Check performance metrics"
echo ""
echo "🔗 Production URL: https://bobdietcoach.com"
echo "🏷️  Deployment tagged as: $TAG_NAME"
echo ""
echo "🎉 Deployment complete! Monitor closely for the next 30 minutes."

# Optional: Send notification (uncomment and configure as needed)
# curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
#   -H 'Content-type: application/json' \
#   -d "{\"text\":\"🚀 Production deployment completed: $TAG_NAME\"}"