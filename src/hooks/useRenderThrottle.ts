/**
 * useRenderThrottle — Limits re-render frequency for TV displays.
 *
 * Batches rapid state updates into a single render per interval,
 * preventing layout thrashing on high-frequency event streams.
 *
 * Usage:
 *   const throttledData = useRenderThrottle(rawData, 500);
 */
import { useState, useEffect, useRef } from 'react';

export function useRenderThrottle<T>(value: T, intervalMs = 500): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdateRef = useRef(Date.now());
  const pendingRef = useRef<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    pendingRef.current = value;
    const elapsed = Date.now() - lastUpdateRef.current;

    if (elapsed >= intervalMs) {
      // Enough time passed — update immediately
      setThrottled(value);
      lastUpdateRef.current = Date.now();
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      // Schedule update for remaining time
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setThrottled(pendingRef.current);
        lastUpdateRef.current = Date.now();
      }, intervalMs - elapsed);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, intervalMs]);

  return throttled;
}
