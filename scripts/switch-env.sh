#!/bin/bash

# Environment Switcher Script
# Usage: ./scripts/switch-env.sh {dev|staging|prod}

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

case "$1" in
  dev|development)
    echo -e "${GREEN}Switching to DEVELOPMENT environment...${NC}"
    if [ -f .env.local ]; then
      cp .env.local .env
      echo "✅ Using .env.local"
      echo ""
      echo "To start development:"
      echo "  npm run dev"
      echo "  npx convex dev (in another terminal)"
    else
      echo -e "${RED}❌ .env.local not found!${NC}"
      exit 1
    fi
    ;;
    
  staging)
    echo -e "${YELLOW}Switching to STAGING environment...${NC}"
    if [ -f .env.staging ]; then
      cp .env.staging .env
      echo "✅ Using .env.staging"
      echo ""
      echo -e "${YELLOW}⚠️  Don't forget to set CONVEX_DEPLOY_KEY for preview deployments:${NC}"
      echo "  export CONVEX_DEPLOY_KEY='your-preview-deploy-key'"
      echo ""
      echo "To deploy to staging:"
      echo "  ./scripts/deploy-staging.sh"
    else
      echo -e "${RED}❌ .env.staging not found!${NC}"
      echo "Create it from .env.staging.example"
      exit 1
    fi
    ;;
    
  prod|production)
    echo -e "${RED}Switching to PRODUCTION environment...${NC}"
    if [ -f .env.production ]; then
      cp .env.production .env
      echo "✅ Using .env.production"
      echo ""
      echo -e "${RED}⚠️  PRODUCTION MODE - Be careful!${NC}"
      echo ""
      echo "To deploy to production:"
      echo "  ./scripts/deploy-production.sh"
    else
      echo -e "${RED}❌ .env.production not found!${NC}"
      exit 1
    fi
    ;;
    
  *)
    echo "Usage: $0 {dev|staging|prod}"
    echo ""
    echo "Examples:"
    echo "  $0 dev      # Switch to development environment"
    echo "  $0 staging  # Switch to staging environment"
    echo "  $0 prod     # Switch to production environment"
    exit 1
    ;;
esac

echo ""
echo "Current environment: $1"