import { useEffect } from "react";
import { Easing, ReduceMotion, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { useEinkMode } from "@/shared/lib/eink";

export const DISCONNECTED_APPEARANCE = { saturation: 0.15, opacity: 0.6 };

const CONNECTION_TRANSITION = {
  duration: 280,
  easing: Easing.bezier(0.77, 0, 0.175, 1),
  reduceMotion: ReduceMotion.System,
};

export function useConnectionAppearance(disconnected: boolean) {
  // Faded grey on e-ink is unreadable; offline state shows in the header and disabled controls.
  const eink = useEinkMode();
  const fade = disconnected && !eink;
  const faded = useSharedValue(fade ? 1 : 0);

  useEffect(() => {
    faded.set(withTiming(fade ? 1 : 0, CONNECTION_TRANSITION));
  }, [fade, faded]);

  return useDerivedValue(() => ({
    saturation: 1 - faded.get() * (1 - DISCONNECTED_APPEARANCE.saturation),
    opacity: 1 - faded.get() * (1 - DISCONNECTED_APPEARANCE.opacity),
  }));
}
