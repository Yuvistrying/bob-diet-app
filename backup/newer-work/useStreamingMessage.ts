import { useState, useEffect, useCallback } from 'react';

interface StreamingOptions {
  wordsPerMinute?: number;
  showCursor?: boolean;
  cursorChar?: string;
}

export function useStreamingMessage(
  fullText: string,
  isActive: boolean,
  options: StreamingOptions = {}
) {
  const {
    wordsPerMinute = 300,
    showCursor = true,
    cursorChar = '▋'
  } = options;

  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive || !fullText) {
      setDisplayText('');
      setIsComplete(false);
      return;
    }

    // Calculate delay based on words per minute
    const words = fullText.split(' ');
    const delayMs = (60 * 1000) / wordsPerMinute; // ms per word

    let currentIndex = 0;
    setIsComplete(false);

    const timer = setInterval(() => {
      if (currentIndex < words.length) {
        const partial = words.slice(0, currentIndex + 1).join(' ');
        const cursor = showCursor && currentIndex < words.length - 1 ? ` ${cursorChar}` : '';
        setDisplayText(partial + cursor);
        currentIndex++;
      } else {
        setDisplayText(fullText);
        setIsComplete(true);
        clearInterval(timer);
      }
    }, delayMs);

    return () => clearInterval(timer);
  }, [fullText, isActive, wordsPerMinute, showCursor, cursorChar]);

  const restart = useCallback(() => {
    setDisplayText('');
    setIsComplete(false);
  }, []);

  return { displayText, isComplete, restart };
}