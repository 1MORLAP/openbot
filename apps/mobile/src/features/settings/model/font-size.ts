import * as SecureStore from "expo-secure-store";
import { Uniwind } from "uniwind";
import { create } from "zustand";

/**
 * Font size scales the app's text and nothing else: icons, controls and spacing keep their size.
 * HeroUI sizes text through the `--text-*` variables, which change live for every theme.
 */
const key = "openbot.mobile.font-size.v1";
export const FONT_SIZE_MIN = 0.7;
export const FONT_SIZE_MAX = 2;

/** The size that 100% stands for on every device: text 15% larger than the platform standard. */
const BASE = 1.15;

// Tailwind's type scale in points. Line heights are ratios, so they follow the size.
const TYPE_SCALE: Record<string, number> = {
  "--text-xs": 12,
  "--text-sm": 14,
  "--text-base": 16,
  "--text-lg": 18,
  "--text-xl": 20,
  "--text-2xl": 24,
  "--text-3xl": 30,
  "--text-4xl": 36,
};
const THEMES = ["light", "dark", "eink"] as const;

export const useFontSize = create<{ value: number; ready: boolean }>(() => ({ value: 1, ready: false }));

/** The factor applied to text: the setting times the base size. */
export function fontScaleFor(value: number): number {
  return value * BASE;
}

function apply(value: number): void {
  const scale = fontScaleFor(value);
  const variables = Object.fromEntries(Object.entries(TYPE_SCALE).map(([name, size]) => [name, size * scale]));
  for (const theme of THEMES) Uniwind.updateCSSVariables(theme, variables);
}

function clamp(value: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, value));
}

export async function loadFontSize(): Promise<void> {
  try {
    const stored = Number(await SecureStore.getItemAsync(key));
    const value = Number.isFinite(stored) && stored > 0 ? clamp(stored) : 1;
    apply(value);
    useFontSize.setState({ value });
  } finally {
    useFontSize.setState({ ready: true });
  }
}

/** Applies at once and keeps the choice for the next start. */
export async function saveFontSize(value: number): Promise<void> {
  const next = clamp(value);
  apply(next);
  useFontSize.setState({ value: next });
  await SecureStore.setItemAsync(key, String(next));
}

/** The current text factor, for text sized outside the type scale, such as the composer. */
export function useFontScale(): number {
  return fontScaleFor(useFontSize((state) => state.value));
}
