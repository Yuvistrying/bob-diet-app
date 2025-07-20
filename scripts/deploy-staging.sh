#!/bin/bash

# Deploy to Staging Script
# This script handles deployment to the staging environment

set -e  # Exit on error

echo "🚀 Starting deployment to STAGING environment..."
echo ""

# Check if we're on staging branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "staging" ]; then
    echo "⚠️  Warning: You're not on the staging branch!"
    echo "Current branch: $CURRENT_BRANCH"
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes!"
    echo "Please commit or stash your changes before deploying."
    exit 1
fi

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

# Deploy Convex functions to staging
echo "📦 Deploying Convex functions to staging..."
npx convex deploy --deployment staging
if [ $? -ne 0 ]; then
    echo "❌ Convex deployment failed!"
    exit 1
fi

# Push to staging branch
echo "📤 Pushing to staging branch..."
git push origin staging

echo ""
echo "✅ Deployment to STAGING complete!"
echo ""
echo "🔗 Your staging deployment will be available at:"
echo "   https://staging.bobdietcoach.com"
echo ""
echo "📋 Post-deployment checklist:"
echo "   [ ] Check Vercel build status"
echo "   [ ] Test authentication flow"
echo "   [ ] Verify Convex functions are working"
echo "   [ ] Run through alpha testing scenarios"
echo ""
echo "Happy testing! 🎉"