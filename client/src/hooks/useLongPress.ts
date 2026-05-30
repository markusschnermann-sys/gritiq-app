/**
 * useLongPress — fires a callback after the user holds a touch for `delay` ms.
 * Cancels immediately on move (>8px) or pointer-up.
 * Returns event handlers to spread onto any element.
 */
import { useRef, useCallback } from "react";

interface UseLongPressOptions {
  delay?: number;       // ms to hold before firing (default 450)
  moveThreshold?: number; // px of movement before cancel (default 8)
  onStart?: () => void;
  onCancel?: () => void;
}

export function useLongPress(
  callback: () => void,
  options: UseLongPressOptions = {},
) {
  const { delay = 450, moveThreshold = 8, onStart, onCancel } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const firedRef = useRef(false);

  const clear = useCallback((cancelled = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (cancelled && !firedRef.current) onCancel?.();
    firedRef.current = false;
  }, [onCancel]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't block default scroll unless we fire the longpress
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    firedRef.current = false;
    onStart?.();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      callback();
    }, delay);
  }, [callback, delay, onStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - startXRef.current);
    const dy = Math.abs(e.touches[0].clientY - startYRef.current);
    if (dx > moveThreshold || dy > moveThreshold) {
      clear(true);
    }
  }, [clear, moveThreshold]);

  const onTouchEnd = useCallback(() => {
    clear(!firedRef.current);
  }, [clear]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
