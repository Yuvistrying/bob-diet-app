# Polar Webhook Configuration

## Webhook URL

```
https://acoustic-scorpion-920.convex.site/webhooks/polar
```

## Usage

This webhook URL is configured in Polar.sh to handle payment events for the Bob Diet Coach application.

## Implementation

The webhook handler is implemented in `convex/http.ts` and handles subscription-related events from Polar.

## Notes

- This URL should be configured in your Polar.sh dashboard under webhook settings
- The endpoint handles POST requests for payment events
- Authentication and validation are handled by the webhook handler in Convex
