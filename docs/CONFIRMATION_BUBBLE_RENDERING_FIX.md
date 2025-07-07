# Confirmation Bubble Rendering Performance Fix

## Issue Date

January 2025

## Problem

Confirmation bubbles were re-rendering excessively (12+ times per bubble) whenever the messages array changed, causing significant performance issues and potentially contributing to persistence problems.

## Root Causes

1. **Unstable React Keys**: Bubbles were keyed by array index (`key={index}`), causing React to remount components when messages were added/removed
2. **Missing Memoization**: The ConfirmationBubble component lacked proper memoization comparison
3. **Cascading Updates**: Complex useEffect dependencies triggered unnecessary re-renders

## Solution Implemented

### 1. Stable Component Keys

Changed from array index to stable identifiers:

```jsx
// Before (unstable)
<div key={index}>
  <ConfirmationBubble ... />
</div>

// After (stable)
<div key={confirmId || `confirm-${index}`}>
  <ConfirmationBubble ... />
</div>
```

### 2. Enhanced Memoization

Added custom comparison function to ConfirmationBubble:

```jsx
const ConfirmationBubble = memo(
  ({ ... }) => { ... },
  // Custom comparison to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.confirmId === nextProps.confirmId &&
      prevProps.isConfirmed === nextProps.isConfirmed &&
      prevProps.isRejected === nextProps.isRejected &&
      prevProps.isStealthMode === nextProps.isStealthMode &&
      prevProps.isStreaming === nextProps.isStreaming &&
      JSON.stringify(prevProps.args) === JSON.stringify(nextProps.args)
    );
  }
);
```

### 3. Stable Message Keys

For regular messages, created stable keys using content hash:

```jsx
const messageKey =
  message.toolCalls?.[0]?.toolCallId ||
  `msg-${message.role}-${message.content.substring(0, 50)}-${index}`;
```

### 4. Performance Monitoring

Added development-only logging to track renders:

```jsx
if (process.env.NODE_ENV === "development") {
  console.log(`[ConfirmationBubble] Rendering ${confirmId}`, {
    isConfirmed,
    isRejected,
    timestamp: new Date().toISOString(),
  });
}
```

## Results

- **Before**: 12+ renders per bubble
- **After**: 2 renders per bubble (in development due to React Strict Mode)
- **Production**: Expected 1 render per bubble

## Verification

The fix was verified through console logs showing:

1. Each bubble now renders only twice in development
2. Stable keys prevent component unmounting/remounting
3. Memoization prevents prop-based re-renders

## Impact

- Significantly improved UI performance
- Reduced CPU usage during chat interactions
- Better stability for confirmation bubble persistence
- Smoother user experience, especially on mobile devices

## Files Modified

- `/app/(app)/chat/page.tsx` - Lines 149-264 (ConfirmationBubble component)
- `/app/(app)/chat/page.tsx` - Lines 2194-2470 (render logic with stable keys)

## Testing

Manually verified by:

1. Logging multiple food items
2. Monitoring console for render counts
3. Checking persistence across tab switches
4. Verifying no regression in functionality
