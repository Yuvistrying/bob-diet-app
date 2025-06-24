// iOS Dark Mode Design System Hooks

import { useEffect, useState, useRef } from 'react';
import { designTokens } from './tokens';

// Hook for haptic feedback (iOS devices)
export function useHapticFeedback() {
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    // Check if we're on iOS and have the Taptic Engine API
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(30);
          break;
      }
    }
  };

  return { triggerHaptic };
}

// Hook for safe area insets (for notch/Dynamic Island)
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: parseInt(designTokens.layout.safeAreaInsets.top),
    bottom: parseInt(designTokens.layout.safeAreaInsets.bottom),
    left: 0,
    right: 0
  });

  useEffect(() => {
    // Check for iOS safe area environment variables
    const computedStyle = getComputedStyle(document.documentElement);
    const safeAreaTop = computedStyle.getPropertyValue('env(safe-area-inset-top)');
    const safeAreaBottom = computedStyle.getPropertyValue('env(safe-area-inset-bottom)');
    
    if (safeAreaTop || safeAreaBottom) {
      setInsets({
        top: parseInt(safeAreaTop) || 44,
        bottom: parseInt(safeAreaBottom) || 34,
        left: 0,
        right: 0
      });
    }
  }, []);

  return insets;
}

// Hook for iOS-style swipe gestures
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const threshold = parseInt(designTokens.interactions.swipeThreshold);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const dx = touchEnd.x - touchStart.x;
    const dy = touchEnd.y - touchStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > threshold) {
      if (absDx > absDy) {
        // Horizontal swipe
        if (dx > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (dx < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (dy > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (dy < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    setTouchStart(null);
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  };
}

// Hook for long press detection
export function useLongPress(callback: () => void, delay = parseInt(designTokens.interactions.longPressDuration)) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>();

  const start = () => {
    timeout.current = setTimeout(() => {
      callback();
      setLongPressTriggered(true);
    }, delay);
  };

  const clear = () => {
    timeout.current && clearTimeout(timeout.current);
    setLongPressTriggered(false);
  };

  return {
    onMouseDown: () => start(),
    onMouseUp: () => clear(),
    onMouseLeave: () => clear(),
    onTouchStart: () => start(),
    onTouchEnd: () => clear(),
  };
}

// Hook for pull-to-refresh
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const threshold = 80; // pixels

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && touchStartY.current > 0) {
      const distance = e.touches[0].clientY - touchStartY.current;
      if (distance > 0) {
        setPullDistance(Math.min(distance, threshold * 1.5));
        setIsPulling(distance > threshold);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (isPulling) {
      await onRefresh();
    }
    setIsPulling(false);
    setPullDistance(0);
    touchStartY.current = 0;
  };

  return {
    isPulling,
    pullDistance,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
}

// Hook for double tap detection
export function useDoubleTap(callback: () => void) {
  const [lastTap, setLastTap] = useState(0);
  const doubleTapInterval = parseInt(designTokens.interactions.doubleTapInterval);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap < doubleTapInterval) {
      callback();
      setLastTap(0);
    } else {
      setLastTap(now);
    }
  };

  return { onTouchEnd: handleTap };
}

// Hook for iOS keyboard handling
export function useIOSKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    // iOS specific viewport height changes when keyboard appears
    let initialHeight = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = initialHeight - currentHeight;
      
      if (heightDiff > 100) {
        // Keyboard is likely visible
        setKeyboardHeight(heightDiff);
        setIsKeyboardVisible(true);
      } else {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    };

    // Visual Viewport API for better iOS support
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return { keyboardHeight, isKeyboardVisible };
}

// Hook for device detection
export function useDeviceDetection() {
  const [deviceInfo, setDeviceInfo] = useState({
    isIOS: false,
    isIPad: false,
    isIPhone: false,
    hasNotch: false,
    hasDynamicIsland: false
  });

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isIPad = /iPad/.test(userAgent);
    const isIPhone = /iPhone/.test(userAgent);
    
    // Detect notch/Dynamic Island based on screen dimensions
    const screenHeight = window.screen.height;
    const screenWidth = window.screen.width;
    
    // iPhone X and later with notch
    const hasNotch = isIPhone && (
      (screenWidth === 375 && screenHeight === 812) || // iPhone X/XS/11 Pro
      (screenWidth === 414 && screenHeight === 896) || // iPhone XR/XS Max/11/11 Pro Max
      (screenWidth === 390 && screenHeight === 844) || // iPhone 12/13/14
      (screenWidth === 428 && screenHeight === 926) || // iPhone 12/13/14 Pro Max
      (screenWidth === 393 && screenHeight === 852) || // iPhone 14 Pro
      (screenWidth === 430 && screenHeight === 932)    // iPhone 14 Pro Max
    );
    
    // iPhone 14 Pro and later with Dynamic Island
    const hasDynamicIsland = isIPhone && (
      (screenWidth === 393 && screenHeight === 852) || // iPhone 14 Pro
      (screenWidth === 430 && screenHeight === 932)    // iPhone 14 Pro Max
    );

    setDeviceInfo({
      isIOS,
      isIPad,
      isIPhone,
      hasNotch,
      hasDynamicIsland
    });
  }, []);

  return deviceInfo;
}