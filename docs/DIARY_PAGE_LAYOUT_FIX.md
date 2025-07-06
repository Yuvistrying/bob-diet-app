# Diary Page Layout Fix Documentation

## Overview
This document describes fixes applied to the diary page to prevent tabs from scrolling and ensure proper content visibility.

## Problems Fixed

### 1. Tabs Scrolling Out of View
**Issue**: Food/Weight toggle tabs were scrolling with content, disappearing when users scrolled down.

**Solution**: Added `flex-shrink-0` to tabs container:
```tsx
<div className="border-b border-border flex-shrink-0">
  <TabsList>...</TabsList>
</div>
```

### 2. Content Cutoff at Bottom
**Issue**: Weight logs and food entries were being cut off by the bottom navigation.

**Solution**: Adjusted padding:
- Food tab: `pb-20` (increased from `pb-16`)
- Weight tab: `pb-24` (increased from `pb-16`)

### 3. Full Log History Button Cutoff
**Issue**: The collapsible "Full Log History" section was partially hidden.

**Solution**: 
- Changed margin from `mb-16` to `mb-4`
- Combined with increased container padding

## Implementation Details

### Page Structure
```tsx
<div className="flex flex-col bg-background h-full">
  <Tabs className="w-full h-full flex flex-col">
    {/* Fixed tabs header */}
    <div className="border-b border-border flex-shrink-0">
      <TabsList>...</TabsList>
    </div>
    
    {/* Scrollable content */}
    <TabsContent value="food" className="mt-0 flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto pb-20">
        {/* Food logs */}
      </div>
    </TabsContent>
    
    <TabsContent value="weight" className="mt-0 flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto pb-24">
        {/* Weight logs */}
      </div>
    </TabsContent>
  </Tabs>
  
  <BottomNav />
</div>
```

### Key CSS Classes
- `flex-shrink-0`: Prevents tabs from shrinking/scrolling
- `flex-1 overflow-hidden`: Makes content area fill remaining space
- `h-full overflow-y-auto`: Enables scrolling within content area
- `pb-20`/`pb-24`: Bottom padding to clear navigation

### Full Log History Section
```tsx
<div className="max-w-lg mx-auto mb-4 border border-border rounded-lg">
  {/* Collapsible history content */}
</div>
```
- Reduced `mb-16` to `mb-4` to prevent cutoff
- Works with container's `pb-24` for proper spacing

## Visual Layout
```
┌─────────────────────────┐
│ [Food] [Weight] (Fixed) │
├─────────────────────────┤
│                         │
│   Scrollable Content    │
│                         │
│   ↕️ Scrolls            │
│                         │
│   [Bottom Padding]      │
├─────────────────────────┤
│   [Bottom Navigation]   │
└─────────────────────────┘
```

## Testing Checklist
- [ ] Tabs remain visible when scrolling content
- [ ] No content cut off at bottom of food tab
- [ ] No content cut off at bottom of weight tab
- [ ] Full Log History fully visible when expanded
- [ ] Smooth scrolling within each tab
- [ ] Bottom navigation doesn't cover content

## Common Pitfalls
- Don't remove `flex-shrink-0` from tabs container
- Don't reduce bottom padding below `pb-20`
- Ensure `overflow-hidden` on TabsContent
- Keep consistent structure across both tabs

## Related Files
- `/app/(app)/diary/page.tsx` - Main diary page
- `/app/components/BottomNav.tsx` - Navigation component

Last Updated: January 2025