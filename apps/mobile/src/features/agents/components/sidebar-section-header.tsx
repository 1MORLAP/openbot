import { MenuView } from "@expo/ui/community/menu";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { ChevronRight, Ellipsis } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";
import { useSectionActions } from "@/features/agents/components/use-section-actions";
import { useReducedMotion } from "@/shared/lib/eink";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

export function SidebarSectionHeader({
  id,
  name,
  empty,
  visibleSectionIds,
  collapsed,
  onToggle,
}: {
  id: string;
  name: string;
  empty: boolean;
  visibleSectionIds: string[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useText();
  const muted = String(useThemeColor("muted"));
  const reducedMotion = useReducedMotion();
  const { actions, onAction } = useSectionActions({ id, name, visibleSectionIds });
  return (
    <View className="px-4 pt-5 pb-2">
      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(collapsed ? "mobile.agent.section.expand" : "mobile.agent.section.collapse", { name })}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => {
            void haptics.selection();
            onToggle();
          }}
          className="min-h-12 flex-1 flex-row items-center gap-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Animated.View
            style={{
              transform: [{ rotate: collapsed ? "0deg" : "90deg" }],
              transitionProperty: "transform",
              transitionDuration: reducedMotion ? 0 : 120,
              transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
            }}
          >
            <ChevronRight size={16} color={muted} />
          </Animated.View>
          <Typography.Paragraph className="flex-1 text-muted">{name}</Typography.Paragraph>
        </Pressable>
        <MenuView actions={actions} onPressAction={({ nativeEvent }) => onAction(nativeEvent.event)}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("mobile.agent.section.options", { name })}
            className="size-12 items-center justify-center"
          >
            <Ellipsis size={20} color={muted} />
          </View>
        </MenuView>
      </View>
      {empty && !collapsed ? (
        <Typography.Paragraph type="body-sm" className="text-muted">
          {t("mobile.agent.section.empty")}
        </Typography.Paragraph>
      ) : null}
    </View>
  );
}
