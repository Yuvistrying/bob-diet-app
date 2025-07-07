// iOS Dark Mode Component Configurations

import { designTokens } from "./tokens";

// Button configurations
export const buttonConfig = {
  primary: {
    base: "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-95",
    style: `bg-[${designTokens.colors.accent.primary}] text-white rounded-[${designTokens.components.button.primary.borderRadius}] h-[${designTokens.components.button.primary.height}] text-[${designTokens.components.button.primary.fontSize}] px-6`,
    hover: "hover:opacity-90",
    focus: "focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/50",
  },
  secondary: {
    base: "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-95",
    style: `bg-[${designTokens.colors.background.elevated}] text-white rounded-[${designTokens.components.button.secondary.borderRadius}] h-[${designTokens.components.button.secondary.height}] text-[${designTokens.components.button.secondary.fontSize}] px-5`,
    hover: "hover:bg-[#3C3C3E]",
    focus: "focus:outline-none focus:ring-2 focus:ring-white/20",
  },
  tertiary: {
    base: "inline-flex items-center justify-center gap-2 whitespace-nowrap font-normal transition-all disabled:pointer-events-none disabled:opacity-50",
    style: `bg-transparent text-[${designTokens.colors.accent.secondary}] text-[${designTokens.components.button.tertiary.fontSize}]`,
    hover: "hover:opacity-70",
    focus: "focus:outline-none focus:underline",
  },
  icon: {
    base: "inline-flex items-center justify-center transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-95",
    style: `w-[${designTokens.components.button.icon.size}] h-[${designTokens.components.button.icon.size}] bg-[${designTokens.colors.background.elevated}] rounded-[${designTokens.components.button.icon.borderRadius}]`,
    hover: "hover:bg-[#3C3C3E]",
    focus: "focus:outline-none focus:ring-2 focus:ring-white/20",
  },
};

// Input configurations
export const inputConfig = {
  base: "w-full transition-all font-[17px] placeholder:text-[#636366] text-white bg-[#2C2C2E] border-0 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50",
  style: `h-[${designTokens.components.input.height}] rounded-[${designTokens.components.input.borderRadius}] px-4`,
  error: "ring-2 ring-[#FF3B30]/50",
  disabled: "opacity-50 cursor-not-allowed",
};

// Card configurations
export const cardConfig = {
  base: "transition-all",
  style: `bg-[${designTokens.colors.ui.cardBackground}] rounded-[${designTokens.components.card.borderRadius}] p-[${designTokens.components.card.padding}]`,
  interactive: "hover:bg-[#2C2C2E] active:scale-[0.98] cursor-pointer",
  border: "border border-[#48484A]",
};

// Chat bubble configurations
export const chatBubbleConfig = {
  container: "flex w-full",
  bubble: {
    base: `max-w-[${designTokens.components.chat.bubbleMaxWidth}] rounded-2xl ${designTokens.components.chat.bubblePadding}`,
    user: `bg-[${designTokens.components.chat.userBubbleBackground}] text-white ml-auto`,
    assistant: `bg-[${designTokens.components.chat.otherBubbleBackground}] text-white`,
    tail: {
      user: "rounded-br-sm",
      assistant: "rounded-bl-sm",
    },
  },
  timestamp: "text-xs text-[#8E8E93] mt-1",
  spacing: `mb-[${designTokens.components.chat.bubbleSpacing}]`,
};

// Modal configurations
export const modalConfig = {
  overlay: `fixed inset-0 bg-black/[${designTokens.components.modal.overlayOpacity}] backdrop-blur-sm z-50`,
  content: {
    base: "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
    style: `bg-[${designTokens.colors.background.secondary}] rounded-[${designTokens.components.modal.borderRadius}] p-[${designTokens.components.modal.padding}] max-w-[${designTokens.components.modal.maxWidth}] w-full`,
    animation:
      "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300",
  },
};

// Navigation bar configurations
export const navigationConfig = {
  container: `h-[${designTokens.components.navigationBar.height}] flex items-center justify-between px-4 backdrop-blur-xl bg-black/50`,
  title: "text-[17px] font-semibold text-white",
  button:
    "w-[44px] h-[44px] flex items-center justify-center rounded-full active:bg-white/10",
  icon: `w-[${designTokens.components.navigationBar.items.iconSize}] h-[${designTokens.components.navigationBar.items.iconSize}] text-white`,
};

// List configurations
export const listConfig = {
  container: "w-full",
  item: {
    base: `flex items-center justify-between h-[${designTokens.components.list.itemHeight}] px-[${designTokens.components.list.padding}]`,
    interactive: "active:bg-white/5 cursor-pointer transition-colors",
    separator: `border-b border-[${designTokens.components.list.separatorColor}] last:border-0`,
  },
  section: {
    header: `h-[${designTokens.components.list.sectionHeaderHeight}] px-[${designTokens.components.list.padding}] flex items-center`,
    title: `text-[${designTokens.components.list.sectionHeaderFontSize}] text-[${designTokens.components.list.sectionHeaderColor}] uppercase tracking-wide`,
    spacing: `mb-[${designTokens.components.list.groupSpacing}]`,
  },
};

// Badge configurations
export const badgeConfig = {
  base: "inline-flex items-center justify-center font-medium",
  style: `h-[${designTokens.components.badge.height}] min-w-[${designTokens.components.badge.minWidth}] rounded-[${designTokens.components.badge.borderRadius}] px-1.5 text-[${designTokens.components.badge.fontSize}]`,
  variants: {
    default: `bg-[${designTokens.components.badge.background}] text-white`,
    success: `bg-[${designTokens.colors.accent.success}] text-white`,
    warning: `bg-[${designTokens.colors.accent.warning}] text-white`,
    secondary: `bg-[${designTokens.colors.background.elevated}] text-white`,
  },
};

// Toggle/Switch configurations
export const toggleConfig = {
  container: `relative inline-flex h-[${designTokens.components.toggle.height}] w-[${designTokens.components.toggle.width}] cursor-pointer items-center rounded-full transition-colors`,
  track: {
    inactive: `bg-[${designTokens.components.toggle.inactiveColor}]`,
    active: `bg-[${designTokens.components.toggle.activeColor}]`,
  },
  thumb: `absolute left-[2px] inline-block h-[${designTokens.components.toggle.thumbSize}] w-[${designTokens.components.toggle.thumbSize}] transform rounded-full bg-white shadow-lg transition-transform`,
  thumbActive: "translate-x-[20px]",
};

// Safe area configurations for mobile
export const safeAreaConfig = {
  top: `pt-[${designTokens.layout.safeAreaInsets.top}]`,
  bottom: `pb-[${designTokens.layout.safeAreaInsets.bottom}]`,
  full: `pt-[${designTokens.layout.safeAreaInsets.top}] pb-[${designTokens.layout.safeAreaInsets.bottom}]`,
};

// Animation utilities
export const animationConfig = {
  fadeIn: "animate-in fade-in duration-300",
  fadeOut: "animate-out fade-out duration-300",
  slideUp: "animate-in slide-in-from-bottom duration-300",
  slideDown: "animate-out slide-out-to-bottom duration-300",
  scaleIn: "animate-in zoom-in-95 duration-200",
  scaleOut: "animate-out zoom-out-95 duration-200",
  spring: `transition-all duration-[${designTokens.animation.duration.normal}] ${designTokens.animation.easing.spring}`,
};
