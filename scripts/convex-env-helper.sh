#!/bin/bash

# Convex Environment Variable Helper
# Usage: ./scripts/convex-env-helper.sh [dev|staging|prod] [set|list] [KEY] [VALUE]

ENV=$1
ACTION=$2
KEY=$3
VALUE=$4

case "$ENV" in
  dev)
    echo "🟢 Working with DEV environment (acoustic-scorpion-920)"
    if [ "$ACTION" = "set" ]; then
      npx convex env set "$KEY" "$VALUE"
    elif [ "$ACTION" = "list" ]; then
      npx convex env list
    else
      echo "Usage: $0 dev [set|list] [KEY] [VALUE]"
    fi
    ;;
    
  staging)
    echo "🟡 Working with STAGING environment (small-mammoth-405)"
    echo "⚠️  IMPORTANT: This requires manual action!"
    echo ""
    echo "1. First run: npx convex deploy --deployment prod:small-mammoth-405"
    echo "2. Then run: npx convex dashboard"
    echo "3. Go to Settings → Environment Variables"
    echo "4. Add: $KEY = $VALUE"
    echo ""
    echo "OR get a staging deploy key from Convex dashboard and use:"
    echo "CONVEX_DEPLOY_KEY='your-key' npx convex env set $KEY '$VALUE'"
    ;;
    
  prod)
    echo "🔴 Working with PRODUCTION environment (fine-viper-112)"
    echo "⚠️  SAFETY FIRST: Use the dashboard!"
    echo ""
    echo "1. Run: npx convex deploy"
    echo "2. Then: npx convex dashboard"
    echo "3. Go to Settings → Environment Variables"
    echo "4. Add: $KEY = $VALUE"
    ;;
    
  *)
    echo "Usage: $0 [dev|staging|prod] [set|list] [KEY] [VALUE]"
    echo ""
    echo "Examples:"
    echo "  $0 dev set FRONTEND_URL http://localhost:5174"
    echo "  $0 dev list"
    echo "  $0 staging set POLAR_SERVER sandbox"
    echo "  $0 prod set POLAR_SERVER production"
    exit 1
    ;;
esac