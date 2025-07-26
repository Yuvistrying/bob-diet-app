#!/bin/bash

# Script to set up Convex production environment variables
# Run this after switching to production deployment with `npx convex deploy`

set -e

echo "🔧 Setting up Convex PRODUCTION environment variables..."
echo ""
echo "⚠️  WARNING: This will modify PRODUCTION environment variables!"
echo "Make sure you have switched to the production deployment first."
echo ""
read -p "Have you run 'npx convex deploy' to switch to production? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Setup cancelled. Please run 'npx convex deploy' first."
    exit 1
fi

echo ""
echo "📝 Setting environment variables..."

# Set Clerk Frontend API URL for production
echo "Setting CLERK_FRONTEND_API_URL..."
npx convex env set CLERK_FRONTEND_API_URL https://clerk.bobdietcoach.ai

# Set Polar configuration for production
echo "Setting POLAR_SERVER..."
npx convex env set POLAR_SERVER "sandbox"  # Change to "production" when ready for real payments

echo "Setting POLAR_PRODUCT_ID..."
npx convex env set POLAR_PRODUCT_ID e3d735a5-22f8-4c27-a7cf-d636c9a7a44b

echo ""
echo "✅ Production environment variables set!"
echo ""
echo "📋 Next steps:"
echo "1. Verify all API keys are set (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)"
echo "2. Run 'npx convex env list' to see all variables"
echo "3. Test authentication flow"
echo "4. Deploy to Vercel production"

echo ""
echo "To switch back to development, run:"
echo "  npx convex dev"