#!/bin/bash

# Test webhook with dev product ID (should be processed)
echo "Testing with DEV product ID (should be processed):"
curl -X POST https://acoustic-scorpion-920.convex.site/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "webhook-id: test-$(date +%s)" \
  -H "webhook-timestamp: $(date +%s)" \
  -H "webhook-signature: test-signature" \
  -d '{
    "type": "subscription.created",
    "data": {
      "id": "test-sub-dev",
      "product_id": "45065efa-b427-43b0-a0eb-244bc4144e03",
      "status": "active",
      "metadata": {
        "userId": "test-user-dev"
      },
      "customer_id": "test-customer",
      "price_id": "test-price",
      "currency": "USD",
      "recurring_interval": "month",
      "amount": 2000,
      "current_period_start": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "current_period_end": "'$(date -u -v+1m +%Y-%m-%dT%H:%M:%SZ)'",
      "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "cancel_at_period_end": false
    }
  }'

echo -e "\n\nTesting with PRODUCTION product ID (should be ignored):"
curl -X POST https://acoustic-scorpion-920.convex.site/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "webhook-id: test-$(date +%s)-prod" \
  -H "webhook-timestamp: $(date +%s)" \
  -H "webhook-signature: test-signature" \
  -d '{
    "type": "subscription.created",
    "data": {
      "id": "test-sub-prod",
      "product_id": "e3d735a5-22f8-4c27-a7cf-d636c9a7a44b",
      "status": "active",
      "metadata": {
        "userId": "test-user-prod"
      },
      "customer_id": "test-customer",
      "price_id": "test-price",
      "currency": "USD",
      "recurring_interval": "month",
      "amount": 2000,
      "current_period_start": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "current_period_end": "'$(date -u -v+1m +%Y-%m-%dT%H:%M:%SZ)'",
      "started_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "cancel_at_period_end": false
    }
  }'