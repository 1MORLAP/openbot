import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { Layers3, type LucideIcon, MessagesSquare, Plus, Search, Settings } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppDrawer } from "@/features/servers/components/app-drawer-shell";
import { toggleChatListPane, usePaneLayout } from "@/features/workspace/components/split-layout";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

function RailButton({
  icon: Icon,
  label,
  active = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const [foreground, background] = useThemeColor(["foreground", "background"]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      className={`w-20 items-center gap-1 rounded-2xl px-1 py-2 ${active ? "bg-foreground" : ""}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Icon color={String(active ? background : foreground)} size={26} strokeWidth={2} />
      <Typography
        weight="semibold"
        className={`text-caption ${active ? "text-background" : "text-foreground"}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

/** The tablet shell's always-visible navigation: every top-level place is one tap away. */
export function NavRail() {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const { listOpen } = usePaneLayout();
  const { openDrawer } = useAppDrawer();
  return (
    <View
      className="w-24 items-center justify-between border-r border-border bg-background"
      style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
    >
      <View className="items-center gap-3">
        <RailButton
          icon={MessagesSquare}
          label={t("mobile.workspace.shell.chats")}
          active={listOpen}
          onPress={() => toggleChatListPane(listOpen)}
        />
        <RailButton
          icon={Search}
          label={t("mobile.workspace.shell.search")}
          onPress={() => router.push("/search-agents")}
        />
        <RailButton icon={Plus} label={t("mobile.workspace.shell.new")} onPress={() => router.push("/add-agent")} />
      </View>
      <View className="items-center gap-3">
        <RailButton icon={Layers3} label={t("mobile.workspace.shell.servers")} onPress={openDrawer} />
        <RailButton
          icon={Settings}
          label={t("mobile.workspace.shell.settings")}
          onPress={() => router.push("/settings")}
        />
      </View>
    </View>
  );
}
