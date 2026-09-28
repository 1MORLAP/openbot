import type { MenuAction } from "@expo/ui/community/menu";
import type { SidebarLayoutAction } from "@openbot/contracts/ipc";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { haptics } from "@/shared/lib/haptics";
import { currentText, useText } from "@/shared/lib/text";

/**
 * What a sidebar section can do: move up or down among the visible sections and, for a section of
 * the person's own, rename or delete it. `onAction` takes an action id from `actions`.
 */
export function useSectionActions({
  id,
  name,
  visibleSectionIds,
}: {
  id: string;
  name: string;
  visibleSectionIds: string[];
}): { actions: MenuAction[]; onAction: (action: string) => void } {
  const { t } = useText();
  const { activeServer, sidebarByServer, mutateSidebarLayout } = useMobileWorkspace();
  const layout = sidebarByServer[activeServer.id]?.layout;
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const custom = layout?.sections.some((section) => section.id === id);
  const index = layout?.order.indexOf(id) ?? -1;
  const visibleIndex = visibleSectionIds.indexOf(id);
  const disabled = activeServer.state !== "online" || saving;
  async function run(action: SidebarLayoutAction) {
    if (pending.current || disabled) return;
    pending.current = true;
    setSaving(true);
    try {
      await mutateSidebarLayout(activeServer.id, action);
      void (action.type === "move" ? haptics.selection() : haptics.notification("success"));
    } catch (error) {
      void haptics.notification("error");
      const text = currentText();
      Alert.alert(
        text.t("mobile.agent.section.changeFailed"),
        text.errorMessage(error, text.t("mobile.agent.section.tryAgain")),
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  const actions: MenuAction[] = [
    { id: "up", title: t("mobile.agent.section.moveUp"), attributes: { disabled: disabled || visibleIndex <= 0 } },
    {
      id: "down",
      title: t("mobile.agent.section.moveDown"),
      attributes: { disabled: disabled || visibleIndex >= visibleSectionIds.length - 1 },
    },
    ...(custom
      ? [
          { id: "rename", title: t("common.rename"), attributes: { disabled } },
          { id: "delete", title: t("mobile.agent.section.delete"), attributes: { disabled, destructive: true } },
        ]
      : []),
  ];
  return {
    actions,
    onAction: (action) => {
      if (action === "up" || action === "down")
        void run({
          type: "move",
          sectionId: id,
          direction: action,
          steps: Math.abs(
            index -
              (layout?.order.indexOf(visibleSectionIds[visibleIndex + (action === "up" ? -1 : 1)] ?? id) ?? index),
          ),
        });
      if (action === "rename")
        router.push({ pathname: "/section-form", params: { serverId: activeServer.id, sectionId: id } });
      if (action === "delete")
        Alert.alert(t("mobile.agent.section.deleteTitle", { name }), t("mobile.agent.section.deleteBody"), [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => void run({ type: "delete", sectionId: id }),
          },
        ]);
    },
  };
}
