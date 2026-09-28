import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";
import { create } from "zustand";

import { useEinkMode } from "@/shared/lib/eink";

/** Width, in dp, from which the chat list can stay beside the open chat. */
const SPLIT_MIN_WIDTH = 600;
/** The navigation rail's width. */
const RAIL_WIDTH = 80;
/** The chat never gets narrower than this; a side pane that would squeeze it closes instead. */
const CHAT_MIN_WIDTH = 360;

/**
 * The measured width of the signed-in shell. The window size can lag behind the app's display
 * zoom, so layout decisions use what the shell actually got.
 */
export const ShellWidthContext = createContext<number | null>(null);

interface PaneLayout {
  /** Tablet shell: navigation rail, and the chat list beside the chat when it is open. */
  split: boolean;
  listWidth: number;
  detailsWidth: number;
  listOpen: boolean;
  detailsOpen: boolean;
}

// The chat list starts open and details closed. `last` is the pane opened most recently, which
// stays when both side panes do not fit beside the chat.
const usePaneChoice = create<{ list: boolean; details: boolean; last: "list" | "details" }>(() => ({
  list: true,
  details: false,
  last: "list",
}));

export function usePaneLayout(): PaneLayout {
  const window = useWindowDimensions();
  const width = useContext(ShellWidthContext) ?? window.width;
  const choice = usePaneChoice();
  const split = width >= SPLIT_MIN_WIDTH;
  const listWidth = Math.round(Math.min(360, Math.max(260, width * 0.32)));
  const detailsWidth = Math.round(Math.min(340, Math.max(240, width * 0.28)));
  const bothFit = width - RAIL_WIDTH - listWidth - detailsWidth >= CHAT_MIN_WIDTH;
  const both = choice.list && choice.details;
  return {
    split,
    listWidth,
    detailsWidth,
    listOpen: split && choice.list && (!both || bothFit || choice.last === "list"),
    detailsOpen: split && choice.details && (!both || bothFit || choice.last === "details"),
  };
}

export function toggleChatListPane(currentlyOpen: boolean): void {
  usePaneChoice.setState(currentlyOpen ? { list: false } : { list: true, last: "list" });
}

export function toggleDetailsPane(currentlyOpen: boolean): void {
  usePaneChoice.setState(currentlyOpen ? { details: false } : { details: true, last: "details" });
}

/**
 * The plain interface: static list, chat and composer without motion, swipes or glass. E-ink
 * panels need it on any size, and the tablet shell uses it because the phone chat is laid out
 * for the full window.
 */
export function useSimpleInterface(): boolean {
  const eink = useEinkMode();
  const { split } = usePaneLayout();
  return eink || split;
}
