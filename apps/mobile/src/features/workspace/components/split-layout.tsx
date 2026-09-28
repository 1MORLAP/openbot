import { useWindowDimensions } from "react-native";
import { create } from "zustand";

/** Width, in dp, from which the chat list stays beside the open chat. */
const SPLIT_MIN_WIDTH = 600;
/** Width from which the details pane opens beside the chat without asking. */
const DETAILS_DEFAULT_WIDTH = 900;

interface PaneLayout {
  /** Bots and chat side by side, instead of one screen at a time. */
  split: boolean;
  listWidth: number;
  detailsWidth: number;
  detailsOpen: boolean;
}

// null follows the screen width; a tap on the details button pins the choice until restart.
const useDetailsChoice = create<{ open: boolean | null }>(() => ({ open: null }));

export function usePaneLayout(): PaneLayout {
  const { width } = useWindowDimensions();
  const choice = useDetailsChoice((state) => state.open);
  const split = width >= SPLIT_MIN_WIDTH;
  return {
    split,
    listWidth: Math.round(Math.min(360, Math.max(240, width * 0.3))),
    detailsWidth: Math.round(Math.min(340, Math.max(220, width * 0.26))),
    detailsOpen: split && (choice ?? width >= DETAILS_DEFAULT_WIDTH),
  };
}

export function toggleDetailsPane(currentlyOpen: boolean): void {
  useDetailsChoice.setState({ open: !currentlyOpen });
}
