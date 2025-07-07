# Color System Documentation

## Semantic Color Variables

Our app uses semantic color variables that automatically adapt to light/dark themes. Here's how to use them:

### Background Colors

- `bg-background` - Main page/app background
- `bg-card` - Cards, panels, elevated surfaces
- `bg-popover` - Popovers, dropdowns, modals
- `bg-input` - Input fields, text areas
- `bg-muted` - Subtle backgrounds, disabled states
- `bg-accent` - Hover states, selected items
- `bg-primary` - Primary buttons, user chat bubbles
- `bg-secondary` - Secondary buttons, badges
- `bg-destructive` - Error states, delete buttons

### Text Colors

- `text-foreground` - Main body text
- `text-card-foreground` - Text on cards
- `text-popover-foreground` - Text in popovers
- `text-muted-foreground` - Subtle text, placeholders, labels
- `text-primary-foreground` - Text on primary backgrounds
- `text-secondary-foreground` - Text on secondary backgrounds
- `text-accent-foreground` - Text on accent backgrounds
- `text-destructive-foreground` - Text on destructive backgrounds

### Border Colors

- `border-border` - All borders (cards, inputs, dividers)
- `border-input` - Input field borders (same as border)
- `border-ring` - Focus rings

### Special Cases

- `ring-ring` - Focus ring color
- `shadow-*` - Use Tailwind shadow utilities

## Component Usage Guide

### Chat Messages

```tsx
// User messages
<div className="bg-primary text-primary-foreground rounded-2xl">

// Assistant messages
<div className="text-foreground">

// System/tool messages
<div className="text-muted-foreground">
```

### Cards

```tsx
<div className="bg-card text-card-foreground border border-border rounded-lg">
  <h3 className="text-foreground font-semibold">Title</h3>
  <p className="text-muted-foreground">Description</p>
</div>
```

### Inputs

```tsx
<input className="bg-input text-foreground placeholder-muted-foreground border-border" />
```

### Buttons

```tsx
// Primary
<button className="bg-primary text-primary-foreground hover:bg-primary/90">

// Secondary
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">

// Ghost
<button className="hover:bg-accent hover:text-accent-foreground">

// Destructive
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
```

### Status Indicators

```tsx
// Success
<div className="text-green-600 dark:text-green-400">

// Warning
<div className="text-yellow-600 dark:text-yellow-400">

// Error
<div className="text-destructive">

// Info
<div className="text-primary">
```

## Migration Guide

### From Hard-coded Colors

| Old                                    | New                       |
| -------------------------------------- | ------------------------- |
| `bg-white dark:bg-black`               | `bg-background`           |
| `bg-white dark:bg-gray-900`            | `bg-card`                 |
| `bg-gray-50 dark:bg-gray-950`          | `bg-muted`                |
| `bg-gray-100 dark:bg-gray-800`         | `bg-muted`                |
| `bg-gray-200 dark:bg-gray-800`         | `bg-accent` or `bg-muted` |
| `text-gray-900 dark:text-gray-100`     | `text-foreground`         |
| `text-gray-800 dark:text-gray-200`     | `text-foreground`         |
| `text-gray-600 dark:text-gray-400`     | `text-muted-foreground`   |
| `text-gray-500 dark:text-gray-400`     | `text-muted-foreground`   |
| `border-gray-200 dark:border-gray-800` | `border-border`           |
| `border-gray-300 dark:border-gray-700` | `border-border`           |

## Notes

1. Always use semantic colors instead of hard-coded values
2. For hover states, use opacity modifiers: `hover:bg-primary/90`
3. For disabled states, use `bg-muted text-muted-foreground`
4. Keep color usage consistent across similar components
5. Test in both light and dark modes
