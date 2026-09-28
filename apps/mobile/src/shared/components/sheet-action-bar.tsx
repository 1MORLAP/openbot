import { router } from "expo-router";
import { Typography } from "heroui-native";
import { createContext, useContext, useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

export interface SheetAction {
  dirty: boolean;
  canSave: boolean;
  pending: boolean;
  label: string;
  pendingLabel: string;
  onSave: () => void;
}

/**
 * A sheet scroll view provides this so the save action can hand it over and have it drawn as a bar
 * above the scrolling form, where it stays put and the keyboard never covers it.
 */
export const SheetActionContext = createContext<((action: SheetAction | null) => void) | null>(null);

/**
 * Android shows no header buttons on a form sheet, so a form's Cancel and Save are an ordinary row
 * of buttons at its top. Save is dimmed until there is something to save.
 */
export function SheetActionBar({ action, topInset }: { action: SheetAction; topInset: boolean }) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const enabled = action.dirty && action.canSave && !action.pending;
  return (
    <View
      className="flex-row items-center justify-between gap-3 border-b border-border bg-sheet px-4 pb-2"
      style={{ paddingTop: (topInset ? insets.top : 0) + 8 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        disabled={action.pending}
        onPress={() => {
          void haptics.impact("light");
          router.back();
        }}
        className="min-h-11 items-center justify-center rounded-full border-2 border-border px-5"
        style={({ pressed }) => ({ opacity: action.pending ? 0.4 : pressed ? 0.6 : 1 })}
      >
        <Typography.Paragraph weight="semibold">{t("common.cancel")}</Typography.Paragraph>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.pending ? action.pendingLabel : action.label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={() => {
          void haptics.impact("light");
          action.onSave();
        }}
        className="min-h-11 items-center justify-center rounded-full border-2 border-foreground bg-foreground px-5"
        style={({ pressed }) => ({ opacity: !enabled ? 0.4 : pressed ? 0.6 : 1 })}
      >
        <Typography.Paragraph weight="semibold" className="text-background">
          {action.pending ? action.pendingLabel : action.label}
        </Typography.Paragraph>
      </Pressable>
    </View>
  );
}

/** Hands a form's save action to the surrounding sheet, or returns false when there is none. */
export function useRegisterSheetAction(action: SheetAction, active: boolean): boolean {
  const register = useContext(SheetActionContext);
  const onSave = useRef(action.onSave);
  onSave.current = action.onSave;
  const { dirty, canSave, pending, label, pendingLabel } = action;
  useEffect(() => {
    if (!active || !register) return;
    register({ dirty, canSave, pending, label, pendingLabel, onSave: () => onSave.current() });
    return () => register(null);
  }, [active, register, dirty, canSave, pending, label, pendingLabel]);
  return active && register !== null;
}
