import { router } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import { Hash, List, Settings } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BloubAvatarThumbnail } from "@/features/agents/components/bloub-avatar";
import { useChannels } from "@/features/channels/components/use-channels";
import { useOpenChat } from "@/features/workspace/components/details-pane";
import { BOT_STRIP_WIDTH } from "@/features/workspace/components/split-layout";
import { useAgentUnread } from "@/features/workspace/components/use-live-workspace";
import { type MobileAgent, useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

const AVATAR = 44;

function StripButton({
  label,
  selected,
  unread = false,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  unread?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      className={`items-center justify-center rounded-2xl border-2 p-1 ${selected ? "border-foreground" : "border-transparent"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {children}
      {unread ? (
        <View className="absolute top-0.5 right-0.5 size-3 rounded-full border-2 border-background bg-foreground" />
      ) : null}
    </Pressable>
  );
}

function AgentButton({ agent, selected }: { agent: MobileAgent; selected: boolean }) {
  const { t } = useText();
  const unread = useAgentUnread(agent.id);
  return (
    <StripButton
      label={t("mobile.workspace.shell.openChat", { name: agent.name })}
      selected={selected}
      unread={unread}
      onPress={() => router.push({ pathname: "/chat/[agentId]", params: { agentId: agent.id } })}
    >
      <BloubAvatarThumbnail
        agentId={agent.id}
        serverId={agent.serverId}
        seed={agent.avatarSeed}
        hue={agent.avatarHue}
        imageUrl={agent.avatarUrl}
        size={AVATAR}
      />
    </StripButton>
  );
}

/**
 * The compact layout's left edge: every bot as its picture, so the chat keeps nearly the whole
 * width. The list button returns to the full chat list; Settings sits at the bottom.
 */
export function BotStrip() {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const foreground = String(useThemeColor("foreground"));
  const openChat = useOpenChat();
  const { activeAgents, activeServer, hiddenChannelIds, pinnedAgentIds } = useMobileWorkspace();
  const { channels } = useChannels(activeServer.id);
  const pinned = pinnedAgentIds
    .map((id) => activeAgents.find((agent) => agent.id === id))
    .filter((agent): agent is MobileAgent => Boolean(agent));
  const agents = [...pinned, ...activeAgents.filter((agent) => !pinnedAgentIds.includes(agent.id))];
  const visibleChannels = channels.filter((channel) => !channel.archived && !hiddenChannelIds.includes(channel.id));
  return (
    <View
      className="items-center border-r border-border bg-background"
      style={{ width: BOT_STRIP_WIDTH, paddingTop: insets.top, paddingBottom: insets.bottom + 10 }}
    >
      <StripButton
        label={t("mobile.workspace.shell.chats")}
        selected={!openChat}
        onPress={() => router.navigate("/connected")}
      >
        <View className="items-center justify-center" style={{ width: AVATAR, height: AVATAR }}>
          <List color={foreground} size={22} strokeWidth={2} />
        </View>
      </StripButton>
      <View className="h-3" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="items-center gap-1.5 pb-2"
        showsVerticalScrollIndicator={false}
      >
        {agents.map((agent) => (
          <AgentButton key={agent.id} agent={agent} selected={openChat?.id === agent.id} />
        ))}
        {visibleChannels.map((channel) => (
          <StripButton
            key={channel.id}
            label={t("mobile.workspace.shell.openChat", { name: channel.name })}
            selected={openChat?.id === channel.id}
            unread={channel.unreadCount > 0}
            onPress={() =>
              router.push({
                pathname: "/channel/[channelId]",
                params: { channelId: channel.id, serverId: activeServer.id },
              })
            }
          >
            <View
              className="items-center justify-center rounded-full border-2 border-foreground"
              style={{ width: AVATAR, height: AVATAR }}
            >
              <Hash color={foreground} size={20} strokeWidth={2.2} />
            </View>
          </StripButton>
        ))}
      </ScrollView>
      <StripButton
        label={t("mobile.workspace.shell.settings")}
        selected={false}
        onPress={() => router.push("/settings")}
      >
        <View className="items-center justify-center" style={{ width: AVATAR, height: AVATAR }}>
          <Settings color={foreground} size={24} strokeWidth={2} />
        </View>
      </StripButton>
    </View>
  );
}
