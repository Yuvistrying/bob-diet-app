# Sentry Integration for Production Environment

## Overview

This guide covers setting up Sentry error tracking and performance monitoring for the Bob Diet Coach production environment only. Since dev and staging are primarily used by you, we'll focus on comprehensive production monitoring.

## Why Sentry for Production Only?

- **Real Users**: Production has actual users experiencing real issues
- **Critical Errors**: Need immediate alerts for production problems
- **Performance Impact**: Monitor real-world performance metrics
- **Cost Efficiency**: Single project keeps costs down
- **Debug Locally**: Dev/staging issues can be debugged directly

## Setup Steps

### 1. Create Sentry Account & Project

1. **Sign up at [sentry.io](https://sentry.io)**
   - Use your production email
   - Choose the "Developer" plan to start (free tier)

2. **Create a New Project**
   - Platform: Next.js
   - Project Name: `bob-diet-coach-production`
   - Team: Your team name

3. **Get Your DSN**
   - Found in Project Settings → Client Keys
   - Format: `https://xxx@yyy.ingest.sentry.io/zzz`

### 2. Install Sentry SDK

```bash
npm install --save @sentry/nextjs
```

### 3. Run Sentry Configuration Wizard

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard will:
- Create `sentry.client.config.ts`
- Create `sentry.server.config.ts`
- Create `sentry.edge.config.ts`
- Update `next.config.js`
- Create `.sentryclirc` (add to .gitignore!)

### 4. Configure for Production Only

Update `sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    
    // Environment
    environment: 'production',
    
    // Integrations
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Facebook related
      'fb_xd_fragment',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // Common false positives
      'Non-Error promise rejection captured',
      // Convex temporary issues
      'ConvexError: Rate limited',
    ],
    
    beforeSend(event, hint) {
      // Filter out non-production errors
      if (window.location.hostname === 'localhost') {
        return null;
      }
      
      // Filter out known non-issues
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) {
        return null;
      }
      
      return event;
    },
  });
}
```

### 5. Add Environment Variables

Add to Vercel Production Environment:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
SENTRY_ORG=your-org-name
SENTRY_PROJECT=bob-diet-coach-production
SENTRY_AUTH_TOKEN=your-auth-token
```

### 6. Enhanced Error Boundary

Update `app/components/ErrorBoundary.tsx`:

```typescript
import * as Sentry from "@sentry/nextjs";

componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error("ErrorBoundary caught an error:", error, errorInfo);
  
  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo);
      scope.setTag('error_boundary', true);
      Sentry.captureException(error);
    });
  }
  
  // Continue with existing error logging...
}
```

### 7. Custom Error Tracking

Create `lib/monitoring.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

export function trackError(error: Error, context?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error tracked:', error, context);
    return;
  }
  
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('error_context', context);
    }
    Sentry.captureException(error);
  });
}

export function trackCriticalError(
  message: string, 
  error: Error, 
  context?: Record<string, any>
) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('Critical error:', message, error, context);
    return;
  }
  
  Sentry.withScope((scope) => {
    scope.setLevel('error');
    scope.setTag('critical', true);
    if (context) {
      scope.setContext('critical_context', context);
    }
    Sentry.captureException(error, {
      tags: { critical: true },
      extra: { message },
    });
  });
}
```

### 8. Integrate with Key Areas

#### API Route Error Handling

Update `app/api/chat/stream-v2/route.ts`:

```typescript
import { trackError, trackCriticalError } from '@/lib/monitoring';

// In catch blocks:
catch (error: any) {
  trackError(error, {
    stage: 'stream_creation',
    userId,
    threadId,
    model: 'claude-sonnet-4',
  });
  // ... existing error handling
}
```

#### Convex Error Tracking

Enable Convex's built-in Sentry integration:

```bash
# For production deployment only
npx convex functions sentry init --prod
```

This will:
- Add Sentry tracking to all Convex functions
- Capture unhandled errors automatically
- Link errors to your Sentry project

### 9. Performance Monitoring

Add to critical pages:

```typescript
// app/(app)/chat/page.tsx
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function ChatPage() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const transaction = Sentry.startTransaction({
        name: 'chat-page-load',
        op: 'navigation',
      });
      
      // Set transaction on scope
      Sentry.getCurrentHub().configureScope(scope => 
        scope.setSpan(transaction)
      );
      
      // End transaction when page loads
      return () => {
        transaction.finish();
      };
    }
  }, []);
  
  // ... rest of component
}
```

### 10. User Context

Add user identification in `app/providers/ConvexClientProvider.tsx`:

```typescript
import * as Sentry from "@sentry/nextjs";
import { useUser } from "@clerk/nextjs";

// Inside provider component:
const { user } = useUser();

useEffect(() => {
  if (user && process.env.NODE_ENV === 'production') {
    Sentry.setUser({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
    });
  }
}, [user]);
```

## Monitoring & Alerts

### 1. Set Up Alerts

In Sentry Dashboard:
- **Error Rate Alert**: > 10 errors/hour
- **New Issue Alert**: First occurrence of new error
- **Performance Alert**: P95 response time > 3s
- **Crash Free Session Rate**: < 99.5%

### 2. Important Metrics to Track

- **Error Rate**: Errors per hour/day
- **Crash Free Users**: % of users without crashes
- **Transaction Performance**: API response times
- **User Feedback**: Linked to specific errors
- **Release Health**: Error rates per release

## Testing Sentry Integration

### 1. Test Error Capture

Add temporary test button (remove after testing):

```typescript
// In a test component
<button onClick={() => {
  throw new Error("Test Sentry error capture");
}}>
  Test Sentry
</button>
```

### 2. Verify in Dashboard

1. Trigger test error in production
2. Check Sentry dashboard (1-2 min delay)
3. Verify error details captured
4. Check user context attached
5. Test alert notifications

### 3. Remove Test Code

Don't forget to remove test buttons!

## Cost Considerations

**Free Tier Includes**:
- 5K errors/month
- 10K performance transactions
- 50 replays/month
- 1 team member

**When to Upgrade**:
- Exceeding error limits regularly
- Need more team members
- Want longer data retention (90 days+)
- Need advanced features

## Best Practices

### 1. Error Grouping

Use fingerprinting for similar errors:

```typescript
beforeSend(event, hint) {
  // Group all Convex rate limit errors together
  if (event.exception?.values?.[0]?.value?.includes('Rate limited')) {
    event.fingerprint = ['convex-rate-limit'];
  }
  return event;
}
```

### 2. Sensitive Data

Never log:
- API keys
- User passwords
- Payment information
- Personal health data

### 3. Performance Budget

Keep transaction sampling low:
- Start with 10% (0.1)
- Increase only if needed
- Monitor quota usage

## Maintenance

### Monthly Tasks

1. **Review Error Trends**
   - Most common errors
   - New error types
   - Error rate changes

2. **Check Performance**
   - Slowest transactions
   - Database query times
   - API response times

3. **Clean Up**
   - Archive resolved issues
   - Update ignore patterns
   - Review alert thresholds

### Release Process

1. **Before Deploy**
   - Note current error rate
   - Check critical issues

2. **After Deploy**
   - Monitor for 30 minutes
   - Watch for error spikes
   - Check performance impact

3. **If Issues**
   - Quick rollback if needed
   - Investigate in Sentry
   - Fix and redeploy

## Quick Reference

### Key Commands

```bash
# Install
npm install --save @sentry/nextjs

# Configure
npx @sentry/wizard@latest -i nextjs

# Test locally (won't send to Sentry)
NODE_ENV=development npm run dev

# Deploy to production
git push origin main
```

### Environment Variables (Vercel Production)

```
NEXT_PUBLIC_SENTRY_DSN=your-dsn-here
SENTRY_ORG=your-org
SENTRY_PROJECT=bob-diet-coach-production
SENTRY_AUTH_TOKEN=your-auth-token
```

### Convex Integration

```bash
# Production only
npx convex functions sentry init --prod
```

## Summary

This setup gives you:
- ✅ Production error tracking
- ✅ Performance monitoring  
- ✅ User session replays
- ✅ Real-time alerts
- ✅ Release tracking
- ✅ Convex function monitoring

All while keeping dev/staging environments clean for direct debugging. You'll know immediately when real users encounter issues in production!