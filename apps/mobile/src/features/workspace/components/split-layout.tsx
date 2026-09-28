import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";
import { create } from "zustand";

import { useEinkMode } from "@/shared/lib/eink";

/** From this width the chat list stays beside the chat. */
const WIDE_MIN_WIDTH = 900;
/** From this width a strip of bot pictures stays beside the chat; below it one screen shows at a time. */
const COMPACT_MIN_WIDTH = 600;
/** The bot strip's width in the compact layout. */
export const BOT_STRIP_WIDTH = 76;
/** The chat never gets narrower than this; details that would squeeze it open as a page instead. */
const CHAT_MIN_WIDTH = 360;

/**
 * The measured width of the signed-in shell. The window size can lag behind the app's display
 * zoom, so layout decisions use what the shell actually got.
 */
export const ShellWidthContext = createContext<number | null>(null);

/**
 * `wide`: chat list | chat, as on a landscape tablet. `compact`: bot strip | chat, the list is the
 * home screen and Back or a swipe returns to it. `phone`: one screen at a time.
 */
type ShellMode = "wide" | "compact" | "phone";

interface PaneLayout {
  mode: ShellMode;
  /** More than one pane: the chat keeps a neighbour and opening another chat replaces it. */
  split: boolean;
  listWidth: number;
  detailsWidth: number;
  /** Details can open beside the chat without squeezing it below its minimum width. */
  detailsFit: boolean;
  detailsOpen: boolean;
}

const useDetailsChoice = create<{ open: boolean }>(() => ({ open: false }));

export function usePaneLayout(): PaneLayout {
  const window = useWindowDimensions();
  const width = useContext(ShellWidthContext) ?? window.width;
  const open = useDetailsChoice((state) => state.open);
  const mode: ShellMode = width >= WIDE_MIN_WIDTH ? "wide" : width >= COMPACT_MIN_WIDTH ? "compact" : "phone";
  const listWidth = Math.round(Math.min(380, Math.max(300, width * 0.32)));
  const detailsWidth = Math.round(Math.min(340, Math.max(240, width * 0.28)));
  const beside = mode === "wide" ? listWidth : mode === "compact" ? BOT_STRIP_WIDTH : width;
  const detailsFit = mode !== "phone" && width - beside - detailsWidth >= CHAT_MIN_WIDTH;
  return {
    mode,
    split: mode !== "phone",
    listWidth,
    detailsWidth,
    detailsFit,
    detailsOpen: detailsFit && open,
  };
}

export function toggleDetailsPane(currentlyOpen: boolean): void {
  useDetailsChoice.setState({ open: !currentlyOpen });
}

/**
 * The plain interface: static list, chat and composer without motion, swipes or glass. E-ink
 * panels need it on any size, and tablets use it because the phone chat is laid out for the
 * full window.
 */
export function useSimpleInterface(): boolean {
  const eink = useEinkMode();
  const { split } = usePaneLayout();
  return eink || split;
}
