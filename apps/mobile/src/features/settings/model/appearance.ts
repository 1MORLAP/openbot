import * as SecureStore from "expo-secure-store";
import { Uniwind } from "uniwind";
import { create } from "zustand";

import { isEinkDevice } from "@/shared/lib/eink-device";

export type Appearance = "system" | "light" | "dark" | "eink";
const key = "openbot.mobile.appearance.v1";
export const useAppearance = create<{ value: Appearance; ready: boolean; saving: boolean }>(() => ({
  value: "system",
  ready: false,
  saving: false,
}));

function readAppearance(stored: string | null): Appearance {
  if (stored === "light" || stored === "dark" || stored === "eink" || stored === "system") return stored;
  // No saved choice yet: an e-ink reader starts in the e-ink theme, everything else follows the system.
  return isEinkDevice() ? "eink" : "system";
}

export async function loadAppearance(): Promise<void> {
  try {
    const value = readAppearance(await SecureStore.getItemAsync(key));
    Uniwind.setTheme(value);
    useAppearance.setState({ value });
  } finally {
    useAppearance.setState({ ready: true });
  }
}

export async function saveAppearance(value: Appearance): Promise<void> {
  if (!useAppearance.getState().ready || useAppearance.getState().saving) return;
  useAppearance.setState({ saving: true });
  try {
    await SecureStore.setItemAsync(key, value);
    Uniwind.setTheme(value);
    useAppearance.setState({ value });
  } finally {
    useAppearance.setState({ saving: false });
  }
}
