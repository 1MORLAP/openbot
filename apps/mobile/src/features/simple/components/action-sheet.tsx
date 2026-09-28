import type { MenuAction } from "@expo/ui/community/menu";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

/**
 * A plain sheet of actions at the bottom: no motion, no ripple, no dimming, large rows. Native
 * dropdown menus are drawn by a second UI toolkit that does not survive inside a scrolling list,
 * and their animation is a poor fit for e-ink. An action with `subactions` opens a second page.
 */
export function ActionSheet({
  title,
  actions,
  onSelect,
  onClose,
}: {
  title: string;
  actions: readonly MenuAction[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const foreground = String(useThemeColor("foreground"));
  const [page, setPage] = useState<MenuAction | null>(null);
  const shown = (page?.subactions ?? actions).filter((action) => !action.attributes?.hidden);

  return (
    <Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={onClose}
          className="absolute inset-0"
        />
        <View
          className="mx-3 self-center overflow-hidden rounded-3xl border-2 border-foreground bg-background"
          style={{ width: "100%", maxWidth: 520, marginBottom: insets.bottom + 12, maxHeight: "80%" }}
        >
          <View className="min-h-14 flex-row items-center gap-1 px-3">
            {page ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
                hitSlop={8}
                onPress={() => setPage(null)}
                className="size-10 items-center justify-center"
              >
                <ChevronLeft color={foreground} size={22} strokeWidth={2} />
              </Pressable>
            ) : null}
            <Typography.Paragraph weight="bold" numberOfLines={1} className="min-w-0 flex-1 px-2">
              {page?.title ?? title}
            </Typography.Paragraph>
          </View>
          <ScrollView bounces={false}>
            {shown.map((action) => {
              const disabled = action.attributes?.disabled === true;
              const destructive = action.attributes?.destructive === true;
              const opensPage = Boolean(action.subactions?.length);
              return (
                <Pressable
                  key={action.id ?? action.title}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected: action.state === "on" }}
                  disabled={disabled}
                  onPress={() => {
                    void haptics.selection();
                    if (opensPage) {
                      setPage(action);
                      return;
                    }
                    onClose();
                    onSelect(action.id ?? action.title);
                  }}
                  className="min-h-14 flex-row items-center gap-3 border-t border-border px-5"
                  style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
                >
                  <Typography.Paragraph
                    weight={action.state === "on" ? "bold" : "normal"}
                    className={`min-w-0 flex-1 ${destructive ? "text-danger-text" : ""}`}
                  >
                    {action.title}
                  </Typography.Paragraph>
                  {opensPage ? <ChevronRight color={foreground} size={20} strokeWidth={2} /> : null}
                  {action.state === "on" ? <Check color={foreground} size={20} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
