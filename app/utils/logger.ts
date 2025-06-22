// Simple logger utility with dev/prod support
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  // Always log errors
  error: (...args: any[]) => console.error(...args),
  
  // Only log warnings in development
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  // Only log info/debug in development
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
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