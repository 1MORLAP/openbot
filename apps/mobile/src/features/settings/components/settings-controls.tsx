import { MenuView } from "@expo/ui/community/menu";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { ChevronsUpDown } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Switch, View } from "react-native";

import { haptics } from "@/shared/lib/haptics";

interface Choice<T extends string> {
  value: T;
  label: string;
}

/** A few mutually exclusive choices side by side, the selected one filled. */
export function SegmentedChoice<T extends string>({
  label,
  choices,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2.5 px-4 py-3.5">
      <Typography.Paragraph>{label}</Typography.Paragraph>
      <View accessibilityRole="radiogroup" className="flex-row rounded-full border border-border p-1">
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => {
                if (selected) return;
                void haptics.selection();
                onChange(choice.value);
              }}
              className={`min-h-10 flex-1 items-center justify-center rounded-full px-2 ${selected ? "bg-foreground" : ""}`}
            >
              <Typography.Paragraph
                type="body-sm"
                weight={selected ? "semibold" : "normal"}
                className={selected ? "text-background" : "text-foreground"}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {choice.label}
              </Typography.Paragraph>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A row showing the current choice; tapping it opens a menu of all choices. */
export function MenuChoiceRow<T extends string>({
  label,
  choices,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const foreground = String(useThemeColor("foreground"));
  const current = choices.find((choice) => choice.value === value)?.label ?? value;
  // The menu anchors to the value pill; Android sizes a menu's host to its content, so the row
  // itself stays an ordinary full-width view.
  return (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-2" style={{ opacity: disabled ? 0.45 : 1 }}>
      <Typography.Paragraph className="min-w-0 flex-1" numberOfLines={2}>
        {label}
      </Typography.Paragraph>
      <MenuView
        actions={choices.map((choice) => ({
          id: choice.value,
          title: choice.label,
          state: choice.value === value ? ("on" as const) : ("off" as const),
        }))}
        onPressAction={({ nativeEvent }) => {
          const next = choices.find((choice) => choice.value === nativeEvent.event);
          if (!next || next.value === value || disabled) return;
          void haptics.selection();
          onChange(next.value);
        }}
      >
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${current}`}
          accessibilityState={{ disabled }}
          className="flex-row items-center gap-1.5 rounded-full border border-border py-1.5 pr-2.5 pl-3.5"
        >
          <Typography.Paragraph weight="semibold" numberOfLines={1}>
            {current}
          </Typography.Paragraph>
          <ChevronsUpDown color={foreground} size={16} strokeWidth={2} />
        </View>
      </MenuView>
    </View>
  );
}

/** An on/off row: the label on the left, a switch on the right. */
export function ToggleRow({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const [foreground, background, control] = useThemeColor(["foreground", "background", "default"]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => {
        void haptics.selection();
        onChange(!value);
      }}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Typography.Paragraph className="min-w-0 flex-1">{label}</Typography.Paragraph>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          void haptics.selection();
          onChange(next);
        }}
        trackColor={{ false: String(control), true: String(foreground) }}
        thumbColor={String(background)}
      />
    </Pressable>
  );
}

/** A round icon badge for the leading side of a settings row. */
export function SettingsIcon({ children }: { children: ReactNode }) {
  return <View className="size-9 items-center justify-center rounded-full border border-border">{children}</View>;
}
