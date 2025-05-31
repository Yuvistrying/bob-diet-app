# Bundle & Performance Optimization TODO

## 🎯 High Priority Optimizations

### Bundle Size Reduction
- [ ] **Replace @tabler/icons-react with selective imports** 
  - Currently importing entire icon library (~500KB)
  - Only using 4 icons: IconDashboard, IconFolder, IconSettings, IconUsers
  - Switch to individual icon imports or tree-shaking
  - Estimated savings: ~450KB

- [ ] **Optimize @radix-ui imports**
  - Many UI components import entire @radix-ui packages
  - Use selective imports: `import { Root } from "@radix-ui/react-avatar/root"`
  - Estimated savings: ~100KB

- [ ] **Remove unused dependencies**
  - `@dnd-kit/*` packages (used only in data-table)
  - `motion` package (no usage found)
  - `next-themes` (React Router app, not Next.js)
  - `sonner` (no toast usage found)
  - `vaul` (drawer component not used)
  - Estimated savings: ~200KB

### Code Splitting & Lazy Loading
- [ ] **Lazy load dashboard components**
  - ChartAreaInteractive (~50KB with recharts)
  - DataTable (~40KB with tanstack/react-table)
  - Only load when needed

- [ ] **Split pricing components**
  - IntegratedPricing is loaded on both /pricing and dashboard
  - Create shared hook for subscription logic
  - Separate UI from business logic

- [ ] **Dynamic import for Polar SDK**
  - Only load @polar-sh/sdk when actually creating checkout
  - Estimated savings: ~30KB from initial bundle

## 🚀 Performance Optimizations

### Database Query Optimization
- [ ] **Cache subscription status**
  - Current: Fetches on every dashboard route
  - Solution: Cache with short TTL (30s)
  - Add optimistic updates for subscription changes

- [ ] **Batch Convex queries**
  - Multiple components query subscription data separately
  - Create single hook that fetches all user data
  - Reduce database round trips

- [ ] **Optimize webhook processing**
  - Current: Processes all webhook events synchronously
  - Solution: Queue non-critical updates
  - Priority: subscription.active > subscription.updated > others

### React Performance
- [ ] **Memoize expensive computations**
  - Pricing calculations in IntegratedPricing
  - Navigation active state calculations
  - Chart data transformations

- [ ] **Implement React.memo for pure components**
  - NavMain, NavSecondary, SectionCards
  - UI components that receive stable props

- [ ] **Optimize re-renders**
  - SidebarProvider creates new style object on each render
  - Extract to constants or useMemo

## 🔧 Code Organization

### Component Architecture
- [ ] **Create shared subscription hook**
  ```typescript
  // useSubscription.ts
  export function useSubscription() {
    // Combine all subscription-related queries
    // Return normalized data with loading states
  }
  ```

- [ ] **Extract business logic from components**
  - Move pricing logic to custom hooks
  - Separate API calls from UI components
  - Create reusable form handlers

- [ ] **Standardize error handling**
  - Create error boundary components
  - Implement retry logic for failed API calls
  - Add proper loading states

### File Structure Optimization
- [ ] **Group related components**
  ```
  components/
    subscription/
      - SubscriptionStatus.tsx
      - PricingCard.tsx
      - hooks/
        - useSubscription.ts
        - usePricing.ts
  ```

- [ ] **Create barrel exports**
  - Reduce import statement complexity
  - Enable better tree-shaking

## ⚡ Build Optimizations

### Vite Configuration
- [ ] **Enable chunk splitting**
  ```typescript
  // vite.config.ts
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'ui': ['@radix-ui/react-*'],
          'charts': ['recharts'],
        }
      }
    }
  }
  ```

- [ ] **Add bundle analyzer**
  - Install vite-bundle-analyzer
  - Monitor bundle size changes
  - Set up size budgets in CI

- [ ] **Optimize asset loading**
  - Compress images (fabrika.png)
  - Enable asset inlining for small files
  - Add proper caching headers

### TypeScript Optimization
- [ ] **Enable incremental compilation**
  - Configure tsconfig for faster builds
  - Use project references for large codebases

- [ ] **Optimize type imports**
  - Use `import type` for type-only imports
  - Reduce TypeScript bundle size

## 📊 Monitoring & Metrics

### Performance Tracking
- [ ] **Add Core Web Vitals monitoring**
  - Track LCP, FID, CLS
  - Monitor subscription flow performance
  - Set up alerts for performance regressions

- [ ] **Bundle size monitoring**
  - Track bundle size in CI
  - Alert on size increases >10%
  - Generate size reports on PRs

### User Experience
- [ ] **Add loading states**
  - Skeleton loaders for dashboard
  - Progressive loading for pricing
  - Error states with retry options

- [ ] **Optimize subscription flow**
  - Reduce steps in checkout process
  - Add progress indicators
  - Implement optimistic updates

## 🎁 Low Priority / Nice to Have

### Developer Experience
- [ ] **Add component documentation**
  - Storybook setup for UI components
  - Document prop types and usage
  - Add visual regression testing

- [ ] **Improve debugging**
  - Better error messages in development
  - Debug panels for Convex queries
  - Performance profiling tools

### Future Enhancements
- [ ] **Service Worker implementation**
  - Cache static assets
  - Offline capability for basic features
  - Background sync for subscription updates

- [ ] **Progressive Web App features**
  - Add PWA manifest
  - Enable app installation
  - Push notifications for subscription changes

## 📋 Estimated Impact

| Optimization | Bundle Size Savings | Performance Gain | Effort |
|--------------|-------------------|------------------|---------|
| Icon tree-shaking | ~450KB | High | Low |
| Remove unused deps | ~200KB | Medium | Low |
| Lazy loading | ~90KB (initial) | High | Medium |
| Query optimization | N/A | High | Medium |
| Component memoization | N/A | Medium | Low |
| Code splitting | ~100KB (initial) | High | High |

**Total estimated bundle reduction: ~840KB (67% smaller initial bundle)**
**Performance improvement: 40-60% faster initial load**