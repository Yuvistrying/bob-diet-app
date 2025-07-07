// Simple logger utility with dev/prod support
const isDevelopment = process.env.NODE_ENV === 'development';

// Get local timestamp for logs
const getLocalTimestamp = () => {
  return new Date().toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const logger = {
  // Always log errors
  error: (...args: any[]) => console.error(`[${getLocalTimestamp()}]`, ...args),
  
  // Only log warnings in development
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(`[${getLocalTimestamp()}]`, ...args);
    }
  },
  
  // Only log info/debug in development
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log(`[${getLocalTimestamp()}]`, ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(`[${getLocalTimestamp()}]`, ...args);
    }
  },
  
  // Group related logs (dev only)
  group: (label: string, fn: () => void) => {
    if (isDevelopment) {
      console.group(label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  }
};