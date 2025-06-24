// iOS Dark Mode Design System Tokens

export const designTokens = {
  colors: {
    background: {
      primary: '#000000',
      secondary: '#1C1C1E',
      elevated: '#2C2C2E',
      overlay: 'rgba(0, 0, 0, 0.8)'
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8E8E93',
      tertiary: '#636366',
      inverted: '#000000'
    },
    accent: {
      primary: '#FF6B35',
      secondary: '#007AFF',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30'
    },
    ui: {
      separator: '#38383A',
      border: '#48484A',
      cardBackground: '#1C1C1E',
      inputBackground: '#2C2C2E'
    }
  },
  
  typography: {
    fontFamily: {
      primary: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      mono: "'SF Mono', Menlo, monospace"
    },
    sizes: {
      heading1: '56px',
      heading2: '32px',
      heading3: '24px',
      body: '17px',
      bodySmall: '15px',
      caption: '13px',
      micro: '11px'
    },
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7
    }
  },
  
  spacing: {
    unit: 4,
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
    xxxl: '64px'
  },
  
  borderRadius: {
    none: '0px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    pill: '9999px',
    circle: '50%'
  },
  
  shadows: {
    none: 'none',
    sm: '0 1px 3px rgba(0, 0, 0, 0.12)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)'
  },
  
  animation: {
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '350ms'
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
    }
  },
  
  layout: {
    safeAreaInsets: {
      top: '44px',
      bottom: '34px',
      left: '0px',
      right: '0px'
    },
    containerPadding: '16px',
    contentMaxWidth: '428px',
    gridColumns: 12,
    gutterWidth: '16px'
  },
  
  components: {
    statusBar: {
      height: '44px',
      background: 'transparent',
      textColor: '#FFFFFF',
      style: 'light-content'
    },
    
    navigationBar: {
      height: '44px',
      background: 'transparent',
      blur: true,
      items: {
        iconSize: '24px',
        spacing: '16px'
      }
    },
    
    button: {
      primary: {
        background: '#FF6B35',
        text: '#FFFFFF',
        borderRadius: '12px',
        height: '56px',
        fontSize: '17px',
        fontWeight: 600,
        padding: '16px 24px'
      },
      secondary: {
        background: '#2C2C2E',
        text: '#FFFFFF',
        borderRadius: '12px',
        height: '48px',
        fontSize: '15px',
        fontWeight: 500,
        padding: '12px 20px'
      },
      tertiary: {
        background: 'transparent',
        text: '#007AFF',
        fontSize: '17px',
        fontWeight: 400
      },
      icon: {
        size: '44px',
        iconSize: '24px',
        borderRadius: '22px',
        background: '#2C2C2E'
      }
    },
    
    card: {
      background: '#1C1C1E',
      borderRadius: '16px',
      padding: '16px',
      spacing: '12px',
      shadow: 'none'
    },
    
    input: {
      height: '48px',
      background: '#2C2C2E',
      borderRadius: '12px',
      padding: '12px 16px',
      fontSize: '17px',
      placeholderColor: '#636366',
      textColor: '#FFFFFF',
      borderWidth: '0px'
    },
    
    toggle: {
      width: '51px',
      height: '31px',
      thumbSize: '27px',
      activeColor: '#007AFF',
      inactiveColor: '#39393D'
    },
    
    list: {
      itemHeight: '56px',
      separatorColor: '#38383A',
      separatorInset: '16px',
      padding: '0 16px',
      groupSpacing: '35px',
      sectionHeaderHeight: '28px',
      sectionHeaderFontSize: '13px',
      sectionHeaderColor: '#8E8E93'
    },
    
    chat: {
      bubbleMaxWidth: '80%',
      bubblePadding: '12px 16px',
      bubbleSpacing: '8px',
      userBubbleBackground: '#007AFF',
      otherBubbleBackground: '#2C2C2E',
      inputBarHeight: '56px',
      inputBarBackground: '#1C1C1E'
    },
    
    modal: {
      background: '#1C1C1E',
      borderRadius: '16px',
      padding: '24px',
      overlayOpacity: 0.5,
      maxWidth: '90%',
      animation: 'slide-up'
    },
    
    badge: {
      height: '20px',
      minWidth: '20px',
      borderRadius: '10px',
      padding: '2px 6px',
      fontSize: '12px',
      background: '#FF3B30',
      textColor: '#FFFFFF'
    }
  },
  
  iconography: {
    style: 'SF Symbols',
    sizes: {
      sm: '16px',
      md: '24px',
      lg: '32px',
      xl: '48px'
    },
    strokeWidth: '1.5px',
    color: '#FFFFFF'
  },
  
  interactions: {
    tapTargetMinSize: '44px',
    swipeThreshold: '50px',
    longPressDuration: '500ms',
    doubleTapInterval: '300ms',
    scrollBounce: true,
    pullToRefresh: true,
    hapticFeedback: {
      light: true,
      medium: true,
      heavy: false
    }
  },
  
  accessibility: {
    minimumContrastRatio: 4.5,
    focusIndicatorWidth: '2px',
    focusIndicatorColor: '#007AFF',
    voiceOverEnabled: true,
    dynamicTypeSupported: true
  }
};

// Helper function to get CSS variables from design tokens
export function getCSSVariables(mode: 'dark' | 'light' = 'dark') {
  if (mode === 'light') {
    // Will be implemented when light mode JSON is provided
    return {};
  }
  
  return {
    // Background colors
    '--background': designTokens.colors.background.primary,
    '--background-secondary': designTokens.colors.background.secondary,
    '--background-elevated': designTokens.colors.background.elevated,
    '--background-overlay': designTokens.colors.background.overlay,
    
    // Text colors
    '--foreground': designTokens.colors.text.primary,
    '--foreground-secondary': designTokens.colors.text.secondary,
    '--foreground-tertiary': designTokens.colors.text.tertiary,
    '--foreground-inverted': designTokens.colors.text.inverted,
    
    // Accent colors
    '--primary': designTokens.colors.accent.primary,
    '--secondary': designTokens.colors.accent.secondary,
    '--success': designTokens.colors.accent.success,
    '--warning': designTokens.colors.accent.warning,
    '--destructive': designTokens.colors.accent.error,
    
    // UI colors
    '--separator': designTokens.colors.ui.separator,
    '--border': designTokens.colors.ui.border,
    '--card': designTokens.colors.ui.cardBackground,
    '--input': designTokens.colors.ui.inputBackground,
    
    // Component specific
    '--muted': designTokens.colors.background.elevated,
    '--muted-foreground': designTokens.colors.text.secondary,
    '--accent': designTokens.colors.accent.secondary,
    '--accent-foreground': designTokens.colors.text.primary,
    '--popover': designTokens.colors.background.elevated,
    '--popover-foreground': designTokens.colors.text.primary,
    
    // Typography
    '--font-sans': designTokens.typography.fontFamily.primary,
    '--font-mono': designTokens.typography.fontFamily.mono,
    
    // Border radius
    '--radius': designTokens.borderRadius.md,
    '--radius-sm': designTokens.borderRadius.sm,
    '--radius-md': designTokens.borderRadius.md,
    '--radius-lg': designTokens.borderRadius.lg,
    '--radius-xl': designTokens.borderRadius.xl,
    
    // Shadows
    '--shadow-sm': designTokens.shadows.sm,
    '--shadow': designTokens.shadows.md,
    '--shadow-lg': designTokens.shadows.lg,
    
    // Animation
    '--animation-fast': designTokens.animation.duration.fast,
    '--animation-normal': designTokens.animation.duration.normal,
    '--animation-slow': designTokens.animation.duration.slow,
    '--animation-easing': designTokens.animation.easing.default,
    '--animation-spring': designTokens.animation.easing.spring
  };
}