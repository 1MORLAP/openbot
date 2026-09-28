import { ListGroup, Typography } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { Children, type PropsWithChildren, type ReactNode } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { SheetScrollView } from "@/shared/components/sheet-scroll-view";
import { haptics } from "@/shared/lib/haptics";

export function SettingsContent({ children }: PropsWithChildren) {
  return (
    <SheetScrollView
      scrollEdgeEffect={false}
      contentContainerClassName="gap-6 px-4 pb-safe-offset-6 pt-4"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </SheetScrollView>
  );
}

export function SettingsSection({
  title,
  footer,
  children,
}: PropsWithChildren<{ title?: string; footer?: ReactNode }>) {
  return (
    <View className="gap-2">
      {title ? (
        <Typography type="body-xs" weight="bold" className="px-2 tracking-openbot-wide uppercase">
          {title}
        </Typography>
      ) : null}
      {/* Outlined cards read as groups on every theme, including e-ink where the fill is white. */}
      <ListGroup
        variant="secondary"
        className="overflow-hidden rounded-grouped border border-border bg-grouped p-0 shadow-none"
      >
        {Children.map(Children.toArray(children), (child, index) =>
          child ? (
            <View>
              {index > 0 ? <View className="h-px bg-border" /> : null}
              {child}
            </View>
          ) : null,
        )}
      </ListGroup>
      {footer ? (
        <Typography.Paragraph type="body-xs" className="px-2 text-grouped-secondary">
          {footer}
        </Typography.Paragraph>
      ) : null}
    </View>
  );
}

export function SettingsNote({ children }: PropsWithChildren) {
  return (
    <View className="px-4 pb-3">
      <Typography.Paragraph type="body-xs" className="text-grouped-secondary">
        {children}
      </Typography.Paragraph>
    </View>
  );
}

export function SettingsRow({
  children,
  supportingText,
  onPress,
  trailing,
  disabled = false,
  leading,
  disclosure = true,
}: PropsWithChildren<{
  supportingText?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  disabled?: boolean;
  leading?: ReactNode;
  disclosure?: boolean;
}>) {
  const muted = String(useCSSVariable("--openbot-text-grouped-secondary"));
  const content = (
    <>
      {leading}
      <View className="min-w-0 flex-1 gap-1">
        {children}
        {supportingText ? (
          <Typography.Paragraph type="body-xs" className="text-grouped-secondary">
            {supportingText}
          </Typography.Paragraph>
        ) : null}
      </View>
      {/* A wide picker must not squeeze its label into one letter per line on narrow panes. */}
      {trailing ? (
        <View className="max-w-[60%] shrink">{trailing}</View>
      ) : onPress && disclosure ? (
        <ChevronRight size={20} color={muted} strokeWidth={2} />
      ) : null}
    </>
  );
  return onPress ? (
    <ListGroup.Item
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void haptics.impact("soft");
        onPress();
      }}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3"
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.6 : 1 })}
    >
      {content}
    </ListGroup.Item>
  ) : (
    <View className="min-h-14 flex-row items-center gap-3 px-4 py-3">{content}</View>
  );
}
