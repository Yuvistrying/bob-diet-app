#!/bin/bash

# Script to set up Convex staging environment variables
# For use with fixed staging deployment

set -e

echo "🔧 Setting up Convex STAGING environment variables..."
echo ""

# Switch to staging deployment
echo "📝 Switching to staging deployment..."
CONVEX_DEPLOYMENT=prod:small-mammoth-405 npx convex deploy

echo ""
echo "📝 Setting environment variables..."

# Get the staging Clerk domain from user
echo ""
echo "Enter your staging Clerk Frontend API URL"
echo "(e.g., https://your-staging-app.clerk.accounts.dev):"
read -r STAGING_CLERK_URL

if [ -z "$STAGING_CLERK_URL" ]; then
    echo "❌ Error: Clerk URL cannot be empty!"
    exit 1
fi

# Set Clerk Frontend API URL for staging
echo "Setting CLERK_FRONTEND_API_URL..."
npx convex env set CLERK_FRONTEND_API_URL "$STAGING_CLERK_URL"

# Set Polar configuration
echo "Setting POLAR_SERVER..."
npx convex env set POLAR_SERVER "sandbox"

echo "Setting POLAR_PRODUCT_ID..."
npx convex env set POLAR_PRODUCT_ID "234a4887-37f5-40bc-9111-d0e7d3318484"

# Set API keys (same as production)
echo ""
echo "Do you want to copy API keys from your .env.staging file? (y/N)"
read -r COPY_KEYS

if [[ $COPY_KEYS =~ ^[Yy]$ ]]; then
    if [ -f .env.staging ]; then
        # Extract and set API keys
        ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" .env.staging | cut -d'=' -f2-)
        OPENAI_KEY=$(grep "^OPENAI_API_KEY=" .env.staging | cut -d'=' -f2-)
        POLAR_TOKEN=$(grep "^POLAR_ACCESS_TOKEN=" .env.staging | cut -d'=' -f2-)
        POLAR_ORG=$(grep "^POLAR_ORGANIZATION_ID=" .env.staging | cut -d'=' -f2-)
        POLAR_SECRET=$(grep "^POLAR_WEBHOOK_SECRET=" .env.staging | cut -d'=' -f2-)

        if [ -n "$ANTHROPIC_KEY" ]; then
            echo "Setting ANTHROPIC_API_KEY..."
            npx convex env set ANTHROPIC_API_KEY "$ANTHROPIC_KEY"
        fi

        if [ -n "$OPENAI_KEY" ]; then
            echo "Setting OPENAI_API_KEY..."
            npx convex env set OPENAI_API_KEY "$OPENAI_KEY"
        fi

        if [ -n "$POLAR_TOKEN" ]; then
            echo "Setting POLAR_ACCESS_TOKEN..."
            npx convex env set POLAR_ACCESS_TOKEN "$POLAR_TOKEN"
        fi

        if [ -n "$POLAR_ORG" ]; then
            echo "Setting POLAR_ORGANIZATION_ID..."
            npx convex env set POLAR_ORGANIZATION_ID "$POLAR_ORG"
        fi

        if [ -n "$POLAR_SECRET" ]; then
            echo "Setting POLAR_WEBHOOK_SECRET..."
            npx convex env set POLAR_WEBHOOK_SECRET "$POLAR_SECRET"
        fi
    else
        echo "⚠️  Warning: .env.staging not found. Please set API keys manually."
    fi
fi

echo ""
echo "✅ Staging environment variables set!"
echo ""

# Show current environment variables
echo "📋 Current staging environment variables:"
npx convex env list

echo ""
echo "📋 Your staging Convex URL:"
echo "https://small-mammoth-405.convex.site"

echo ""
echo "📋 Next steps:"
echo "1. Update .env.staging with your staging Clerk keys"
echo "2. Configure Vercel with staging environment variables"
echo "3. Add webhook URL to Polar: https://small-mammoth-405.convex.site/webhooks/polar"
echo "4. Deploy to staging with: ./scripts/deploy-staging.sh"

echo ""
echo "To switch back to development, run:"
echo "  npx convex dev"