import { MenuView } from "@expo/ui/community/menu";
import type { ChannelSummary } from "@openbot/contracts/ipc";
import { router } from "expo-router";
import { Button, Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { Hash, Plus, Search, Settings } from "lucide-react-native";
import { type ReactNode, useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BloubAvatarThumbnail } from "@/features/agents/components/bloub-avatar";
import { useChannels } from "@/features/channels/components/use-channels";
import { markdownPreviewText } from "@/features/chat/model/chat-markdown-parser";
import { useOpenChat } from "@/features/workspace/components/details-pane";
import { useAgentUnread } from "@/features/workspace/components/use-live-workspace";
import { type MobileAgent, useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { mobileSidebarItems } from "@/features/workspace/model/sidebar-layout";
import { formatUpdatedAt } from "@/shared/lib/format-updated-at";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

const AVATAR = 44;

function Row({
  selected,
  label,
  onPress,
  leading,
  title,
  time,
  preview,
  unread,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  leading: ReactNode;
  title: string;
  time: string;
  preview: string;
  unread: boolean;
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
      className={`flex-row items-center gap-3 border-b border-border px-4 py-3 ${selected ? "border-l-8 border-l-foreground bg-surface-secondary" : ""}`}
      style={({ pressed }) => ({ minHeight: 72, opacity: pressed ? 0.7 : 1 })}
    >
      {leading}
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-baseline gap-2">
          <Typography.Paragraph weight={unread ? "bold" : "semibold"} className="min-w-0 flex-1" numberOfLines={1}>
            {unread ? `● ${title}` : title}
          </Typography.Paragraph>
          {time ? (
            <Typography.Paragraph type="body-xs" numberOfLines={1}>
              {time}
            </Typography.Paragraph>
          ) : null}
        </View>
        {preview ? (
          <Typography.Paragraph type="body-sm" numberOfLines={1}>
            {preview}
          </Typography.Paragraph>
        ) : null}
      </View>
    </Pressable>
  );
}

function AgentRow({ agent, selected }: { agent: MobileAgent; selected: boolean }) {
  const { t } = useText();
  const unread = useAgentUnread(agent.id);
  return (
    <Row
      selected={selected}
      label={t("mobile.workspace.shell.openChat", { name: agent.name })}
      onPress={() => router.push({ pathname: "/chat/[agentId]", params: { agentId: agent.id } })}
      leading={
        <BloubAvatarThumbnail
          agentId={agent.id}
          serverId={agent.serverId}
          seed={agent.avatarSeed}
          hue={agent.avatarHue}
          imageUrl={agent.avatarUrl}
          size={AVATAR}
        />
      }
      title={agent.name}
      time={agent.updatedLabel}
      preview={markdownPreviewText(agent.preview)}
      unread={unread}
    />
  );
}

function ChannelRow({ channel, serverId, selected }: { channel: ChannelSummary; serverId: string; selected: boolean }) {
  const { t } = useText();
  const foreground = useThemeColor("foreground");
  const preview = channel.lastMessage ? `${channel.lastMessage.authorName}: ${channel.lastMessage.text}` : "";
  return (
    <Row
      selected={selected}
      label={t("mobile.workspace.shell.openChat", { name: channel.name })}
      onPress={() => router.push({ pathname: "/channel/[channelId]", params: { channelId: channel.id, serverId } })}
      leading={
        <View
          className="items-center justify-center rounded-xl border-2 border-border bg-background"
          style={{ width: AVATAR, height: AVATAR }}
        >
          <Hash color={String(foreground)} size={22} strokeWidth={2.2} />
        </View>
      }
      title={channel.name}
      time={formatUpdatedAt(channel.lastMessage?.at ?? null)}
      preview={markdownPreviewText(preview)}
      unread={channel.unreadCount > 0}
    />
  );
}

function HeaderButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      className="size-12 items-center justify-center rounded-xl"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {children}
    </Pressable>
  );
}

/**
 * The chat list of the plain interface: every bot and channel of the selected server, grouped by
 * the desktop's sidebar sections, with the open chat inverted. `phone` adds the actions the
 * tablet shell keeps in its navigation rail.
 */
export function SimpleChatList({ phone = false }: { phone?: boolean }) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const foreground = String(useThemeColor("foreground"));
  const openChat = useOpenChat();
  const {
    activeAgents,
    activeServer,
    hiddenChannelIds,
    pinnedAgentIds,
    pinnedChannelIds,
    servers,
    sidebarByServer,
    refreshServers,
    serverDirectoryState,
  } = useMobileWorkspace();
  const channels = useChannels(activeServer.id);
  const sidebar = sidebarByServer[activeServer.id];
  const items = useMemo(() => {
    const visibleChannels = channels.channels.filter(
      (channel) => !channel.archived && !hiddenChannelIds.includes(channel.id),
    );
    const pinnedAgents = pinnedAgentIds
      .map((id) => activeAgents.find((agent) => agent.id === id))
      .filter((agent): agent is MobileAgent => Boolean(agent));
    const pinnedChannels = visibleChannels.filter((channel) => pinnedChannelIds.includes(channel.id));
    const rest = mobileSidebarItems(
      sidebar?.layout ?? null,
      activeAgents.filter((agent) => !pinnedAgentIds.includes(agent.id)),
      visibleChannels.filter((channel) => !pinnedChannelIds.includes(channel.id)),
      undefined,
      t,
    );
    const pinned = [
      ...pinnedChannels.map((channel) => ({ kind: "channel" as const, id: channel.id, channel })),
      ...pinnedAgents.map((agent) => ({ kind: "agent" as const, id: agent.id, agent })),
    ];
    return pinned.length
      ? [
          { kind: "section" as const, id: "pinned", name: t("mobile.workspace.shell.pinned"), empty: false },
          ...pinned,
          ...rest,
        ]
      : rest;
  }, [activeAgents, channels.channels, hiddenChannelIds, pinnedAgentIds, pinnedChannelIds, sidebar?.layout, t]);
  const status =
    activeServer.state === "online"
      ? t("mobile.workspace.status.online")
      : activeServer.state === "error"
        ? t("mobile.workspace.status.error")
        : activeServer.state === "connecting"
          ? t("mobile.workspace.status.reconnecting")
          : t("mobile.workspace.status.offline");
  const hasServer = servers.some((server) => server.id === activeServer.id);

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-row items-center gap-2 border-b-2 border-border px-4 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="min-w-0 flex-1">
          <Typography.Heading type="h3" numberOfLines={1}>
            {t("mobile.workspace.shell.chats")}
          </Typography.Heading>
          <Typography.Paragraph type="body-sm" numberOfLines={1}>
            {hasServer ? `${activeServer.name} · ${status}` : t("mobile.agent.home.chooseServer")}
          </Typography.Paragraph>
        </View>
        {phone ? (
          <HeaderButton label={t("mobile.workspace.shell.search")} onPress={() => router.push("/search-agents")}>
            <Search color={foreground} size={24} strokeWidth={2} />
          </HeaderButton>
        ) : null}
        <MenuView
          actions={[
            { id: "add-agent", title: t("mobile.agent.home.addAgent") },
            ...(channels.supported ? [{ id: "add-channel", title: t("mobile.agent.home.newChannel") }] : []),
            ...(sidebar?.layout ? [{ id: "add-section", title: t("mobile.agent.sectionForm.newTitle") }] : []),
            { id: "hidden-chats", title: t("mobile.agent.hidden.title") },
          ]}
          onPressAction={({ nativeEvent }) => {
            if (nativeEvent.event === "add-agent") router.push("/add-agent");
            if (nativeEvent.event === "add-channel")
              router.push({ pathname: "/add-channel", params: { serverId: activeServer.id } });
            if (nativeEvent.event === "add-section")
              router.push({ pathname: "/section-form", params: { serverId: activeServer.id } });
            if (nativeEvent.event === "hidden-chats") router.push("/hidden-chats");
          }}
          style={{ height: 48, width: 48 }}
        >
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("mobile.agent.home.chatOptions")}
            className="size-12 items-center justify-center rounded-xl"
          >
            <Plus color={foreground} size={26} strokeWidth={2} />
          </View>
        </MenuView>
        {phone ? (
          <HeaderButton label={t("mobile.workspace.shell.settings")} onPress={() => router.push("/settings")}>
            <Settings color={foreground} size={24} strokeWidth={2} />
          </HeaderButton>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16, flexGrow: 1 }}
        renderItem={({ item }) =>
          item.kind === "section" ? (
            <View className="border-b border-border bg-surface-secondary px-4 pt-4 pb-1.5">
              <Typography type="body-xs" weight="bold" className="tracking-openbot-wide uppercase">
                {item.name}
              </Typography>
            </View>
          ) : item.kind === "agent" ? (
            <AgentRow agent={item.agent} selected={openChat?.id === item.agent.id} />
          ) : (
            <ChannelRow channel={item.channel} serverId={activeServer.id} selected={openChat?.id === item.channel.id} />
          )
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-4 px-8 py-16">
            <Typography.Paragraph align="center">
              {serverDirectoryState === "error"
                ? t("mobile.agent.home.serversFailed")
                : !hasServer
                  ? t("mobile.agent.home.chooseServer")
                  : activeServer.state !== "online"
                    ? t("mobile.agent.home.waiting")
                    : t("mobile.agent.home.noAgents")}
            </Typography.Paragraph>
            {serverDirectoryState === "error" ? (
              <Button variant="secondary" onPress={() => void refreshServers().catch(() => undefined)}>
                <Button.Label>{t("common.tryAgain")}</Button.Label>
              </Button>
            ) : null}
          </View>
        }
      />
    </View>
  );
}
