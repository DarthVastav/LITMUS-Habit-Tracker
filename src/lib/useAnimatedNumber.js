import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Symmetric ease — slow at both ends, quick through the middle, so the
// colour sweep reads as deliberate rather than mechanical.
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Animate a plain number towards `target` over `duration` ms.
 *
 * CSS custom properties can't be transitioned (they're unregistered, so the
 * browser treats them as strings and swaps them instantly). Since the whole
 * palette is derived from one hue, animating that single number in JS moves
 * every colour together — and lets the hue travel the long way round the
 * wheel instead of cross-fading through grey.
 *
 * Re-targeting mid-flight is fine: the next run starts from wherever the
 * value currently sits, so rapid changes chain smoothly.
 */
export function useAnimatedNumber(target, duration = 900) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const frameRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Don't animate in from nowhere on first paint.
    if (!mountedRef.current) {
      mountedRef.current = true;
      valueRef.current = target;
      setValue(target);
      return undefined;
    }

    if (prefersReducedMotion()) {
      valueRef.current = target;
      setValue(target);
      return undefined;
    }

    const from = valueRef.current;
    if (from === target) return undefined;

    const startedAt = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const next = from + (target - from) * easeInOut(t);
      valueRef.current = next;
      setValue(next);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}
