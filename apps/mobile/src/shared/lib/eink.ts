import { useEffect, useState } from "react";
import { useReducedMotion as useSystemReducedMotion } from "react-native-reanimated";
import { useUniwind } from "uniwind";

/** True while the e-ink theme is active. */
export function useEinkMode(): boolean {
  return useUniwind().theme === "eink";
}

/** The platform colour scheme for native controls. The e-ink theme is a light theme. */
export function useNativeColorScheme(): "light" | "dark" {
  return useUniwind().theme === "dark" ? "dark" : "light";
}

/**
 * Reduced motion for components that choose between animated and static rendering. E-ink panels
 * repaint the whole region on every frame, so the e-ink theme always counts as reduced motion.
 */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const eink = useEinkMode();
  return system || eink;
}

/**
 * Holds a fast-changing value and releases it at most once per interval while `enabled`. Streaming
 * replies update many times a second, which on e-ink means a flashing repaint per token.
 */
export function useThrottledValue<T>(value: T, intervalMs: number, enabled: boolean): T {
  const [shown, setShown] = useState(value);
  const [lastShownAt, setLastShownAt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const wait = Math.max(0, lastShownAt + intervalMs - Date.now());
    const timer = setTimeout(() => {
      setShown(value);
      setLastShownAt(Date.now());
    }, wait);
    return () => clearTimeout(timer);
  }, [enabled, intervalMs, lastShownAt, value]);
  return enabled ? shown : value;
}
