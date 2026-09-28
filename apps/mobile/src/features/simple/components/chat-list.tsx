import { type MenuAction, MenuView } from "@expo/ui/community/menu";
import { type ChannelSummary, SIDEBAR_UNASSIGNED_SECTION_ID } from "@openbot/contracts/ipc";
import { router } from "expo-router";
import { Button, Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { ChevronDown, ChevronRight, Ellipsis, Hash, Layers3, Plus, Search, Settings } from "lucide-react-native";
import { type ReactNode, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BloubAvatarThumbnail } from "@/features/agents/components/bloub-avatar";
import { useChatSectionMenu } from "@/features/agents/components/use-chat-section-menu";
import { useSectionActions } from "@/features/agents/components/use-section-actions";
import { mobileUserName } from "@/features/auth/api/mobile-user-name";
import { useMobileSession } from "@/features/auth/context/mobile-session-context";
import { useChannels } from "@/features/channels/components/use-channels";
import { markdownPreviewText } from "@/features/chat/model/chat-markdown-parser";
import { useAppDrawer } from "@/features/servers/components/app-drawer-shell";
import { ActionSheet } from "@/features/simple/components/action-sheet";
import { toggleSectionCollapsed, useCollapsedSections } from "@/features/simple/model/collapsed-sections";
import { useOpenChat } from "@/features/workspace/components/details-pane";
import { useAgentUnread } from "@/features/workspace/components/use-live-workspace";
import { type MobileAgent, useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { canToggleAgentPin } from "@/features/workspace/model/agent-pins";
import { mobileSidebarItems } from "@/features/workspace/model/sidebar-layout";
import { ProfileAvatar } from "@/shared/components/profile-avatar";
import { formatUpdatedAt } from "@/shared/lib/format-updated-at";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

const AVATAR = 44;

interface RowMenu {
  actions: MenuAction[];
  onAction: (id: string) => void;
}

/** A chat in the list. A long press opens its actions: pin, move to a section, hide, info. */
function Row({
  selected,
  label,
  name,
  onPress,
  leading,
  title,
  time,
  preview,
  unread,
  menu,
}: {
  selected: boolean;
  label: string;
  name: string;
  onPress: () => void;
  leading: ReactNode;
  title: string;
  time: string;
  preview: string;
  unread: boolean;
  menu: RowMenu;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        onLongPress={() => {
          void haptics.impact();
          setOpen(true);
        }}
        className={`mx-2 my-0.5 flex-row items-center gap-3 rounded-2xl border-2 px-3 py-2.5 ${selected ? "border-foreground bg-surface-secondary" : "border-transparent"}`}
        style={({ pressed }) => ({ minHeight: 68, opacity: pressed ? 0.7 : 1 })}
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
      {open ? (
        <ActionSheet title={name} actions={menu.actions} onSelect={menu.onAction} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function AgentRow({ agent, selected }: { agent: MobileAgent; selected: boolean }) {
  const { t } = useText();
  const unread = useAgentUnread(agent.id);
  const { hideAgent, markAgentRead, markAgentUnread, pinnedAgentIds, pinnedChannelIds, toggleAgentPin } =
    useMobileWorkspace();
  const sectionMenu = useChatSectionMenu(agent.serverId, agent.id);
  const pinned = pinnedAgentIds.includes(agent.id);
  const menu: RowMenu = {
    actions: [
      {
        id: "pin",
        title: t(pinned ? "mobile.agent.pin.unpin" : "mobile.agent.pin.pin"),
        attributes: { disabled: !canToggleAgentPin([...pinnedAgentIds, ...pinnedChannelIds], agent.id) },
      },
      ...sectionMenu.androidActions,
      { id: "read", title: t(unread ? "mobile.agent.menu.markRead" : "mobile.agent.menu.markUnread") },
      { id: "hide", title: t("mobile.agent.menu.hide") },
      { id: "info", title: t("mobile.agent.menu.info") },
    ],
    onAction: (id) => {
      sectionMenu.onAction(id);
      if (id === "pin") toggleAgentPin(agent.id);
      if (id === "read") (unread ? markAgentRead : markAgentUnread)(agent.id);
      if (id === "hide") hideAgent(agent.id);
      if (id === "info")
        router.push({ pathname: "/agent-info/[agentId]", params: { agentId: agent.id, serverId: agent.serverId } });
    },
  };
  return (
    <Row
      menu={menu}
      name={agent.name}
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
  const { hideChannel, pinnedAgentIds, pinnedChannelIds, toggleChannelPin } = useMobileWorkspace();
  const sectionMenu = useChatSectionMenu(serverId, channel.id);
  const pinned = pinnedChannelIds.includes(channel.id);
  const menu: RowMenu = {
    actions: [
      {
        id: "pin",
        title: t(pinned ? "mobile.agent.pin.unpin" : "mobile.agent.pin.pin"),
        attributes: { disabled: !canToggleAgentPin([...pinnedAgentIds, ...pinnedChannelIds], channel.id) },
      },
      ...sectionMenu.androidActions,
      { id: "hide", title: t("mobile.agent.menu.hide") },
      { id: "info", title: t("mobile.agent.menu.info") },
    ],
    onAction: (id) => {
      sectionMenu.onAction(id);
      if (id === "pin") toggleChannelPin(channel.id, serverId);
      if (id === "hide") hideChannel(channel.id, serverId);
      if (id === "info")
        router.push({ pathname: "/channel-info/[channelId]", params: { channelId: channel.id, serverId } });
    },
  };
  return (
    <Row
      menu={menu}
      name={channel.name}
      selected={selected}
      label={t("mobile.workspace.shell.openChat", { name: channel.name })}
      onPress={() => router.push({ pathname: "/channel/[channelId]", params: { channelId: channel.id, serverId } })}
      leading={
        <View
          className="items-center justify-center rounded-full border-2 border-foreground bg-background"
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

/**
 * A section's title. Tapping it folds the section away or opens it again; the dots open its
 * actions. The default group of chats without a section has the same header.
 */
function SectionHeader({
  id,
  name,
  empty,
  collapsed,
  visibleSectionIds,
  onToggle,
}: {
  id: string;
  name: string;
  empty: boolean;
  collapsed: boolean;
  visibleSectionIds: string[];
  onToggle: () => void;
}) {
  const { t } = useText();
  const foreground = String(useThemeColor("foreground"));
  const [open, setOpen] = useState(false);
  const { actions, onAction } = useSectionActions({ id, name, visibleSectionIds });
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <View className="pt-3 pl-5 pr-2">
      <View className="flex-row items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(collapsed ? "mobile.agent.section.expand" : "mobile.agent.section.collapse", { name })}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => {
            void haptics.selection();
            onToggle();
          }}
          className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Chevron color={foreground} size={18} strokeWidth={2.5} />
          <Typography
            type="body-xs"
            weight="bold"
            numberOfLines={1}
            className="tracking-openbot-wide min-w-0 flex-1 uppercase"
          >
            {name}
          </Typography>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("mobile.agent.section.options", { name })}
          onPress={() => {
            void haptics.selection();
            setOpen(true);
          }}
          className="size-11 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ellipsis color={foreground} size={20} strokeWidth={2} />
        </Pressable>
      </View>
      {empty && !collapsed ? (
        <Typography.Paragraph type="body-sm" className="pb-2">
          {t("mobile.agent.section.empty")}
        </Typography.Paragraph>
      ) : null}
      {open ? <ActionSheet title={name} actions={actions} onSelect={onAction} onClose={() => setOpen(false)} /> : null}
    </View>
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
      className="size-10 items-center justify-center rounded-full"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {children}
    </Pressable>
  );
}

/** The signed-in person: their picture (or initials) and name, opening the profile. */
function AccountButton() {
  const { t } = useText();
  const { session } = useMobileSession();
  const name = session ? mobileUserName(session.user) : t("mobile.settings.home.profile");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() => {
        void haptics.selection();
        router.push("/settings/profile");
      }}
      className="min-w-0 flex-1 flex-row items-center gap-2.5 rounded-full py-1 pr-2"
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <ProfileAvatar
        neutral
        name={name}
        imageUrl={session?.user.avatarUrl ? new URL(session.user.avatarUrl, session.apiUrl).toString() : null}
        size={40}
      />
      <Typography.Paragraph weight="semibold" numberOfLines={1} className="min-w-0 flex-1">
        {name}
      </Typography.Paragraph>
    </Pressable>
  );
}

/**
 * The chat list of the plain interface: every bot and channel of the selected server, grouped by
 * the desktop's sidebar sections, with the open chat outlined. Search and New sit at the top; the
 * signed-in account, Servers and Settings at the bottom.
 */
export function SimpleChatList() {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const foreground = String(useThemeColor("foreground"));
  const openChat = useOpenChat();
  const { openDrawer } = useAppDrawer();
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
  const collapsed = useCollapsedSections(activeServer.id);
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
      collapsed,
      t,
    ).map((item) =>
      // Next to sections of the person's own, the default group is simply what is not in one.
      item.kind === "section" && item.id === SIDEBAR_UNASSIGNED_SECTION_ID && sidebar?.layout?.sections.length
        ? { ...item, name: t("mobile.agent.section.unassigned") }
        : item,
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
  }, [
    activeAgents,
    channels.channels,
    collapsed,
    hiddenChannelIds,
    pinnedAgentIds,
    pinnedChannelIds,
    sidebar?.layout,
    t,
  ]);
  const sectionIds = useMemo(
    () => items.flatMap((item) => (item.kind === "section" && item.id !== "pinned" ? [item.id] : [])),
    [items],
  );
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
      <View className="flex-row items-center gap-1 px-4" style={{ paddingTop: insets.top }}>
        <Typography.Paragraph weight="semibold" numberOfLines={1} className="min-w-0 flex-1">
          {hasServer
            ? activeServer.state === "online"
              ? activeServer.name
              : `${activeServer.name} · ${status}`
            : t("mobile.agent.home.chooseServer")}
        </Typography.Paragraph>
        <HeaderButton label={t("mobile.workspace.shell.search")} onPress={() => router.push("/search-agents")}>
          <Search color={foreground} size={22} strokeWidth={2} />
        </HeaderButton>
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
          style={{ height: 40, width: 40 }}
        >
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("mobile.agent.home.chatOptions")}
            className="size-10 items-center justify-center rounded-full"
          >
            <Plus color={foreground} size={22} strokeWidth={2} />
          </View>
        </MenuView>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
        renderItem={({ item }) =>
          item.kind === "section" ? (
            item.id === "pinned" ? (
              <View className="px-5 pt-4 pb-1">
                <Typography type="body-xs" weight="bold" className="tracking-openbot-wide uppercase">
                  {item.name}
                </Typography>
              </View>
            ) : (
              <SectionHeader
                id={item.id}
                name={item.name}
                empty={item.empty}
                visibleSectionIds={sectionIds}
                collapsed={collapsed.has(item.id)}
                onToggle={() => toggleSectionCollapsed(activeServer.id, item.id)}
              />
            )
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
      <View
        className="flex-row items-center gap-2 border-t border-border px-3 pt-2.5"
        style={{ paddingBottom: insets.bottom + 10 }}
      >
        <AccountButton />
        <HeaderButton label={t("mobile.workspace.shell.servers")} onPress={openDrawer}>
          <Layers3 color={foreground} size={22} strokeWidth={2} />
        </HeaderButton>
        <HeaderButton label={t("mobile.workspace.shell.settings")} onPress={() => router.push("/settings")}>
          <Settings color={foreground} size={22} strokeWidth={2} />
        </HeaderButton>
      </View>
    </View>
  );
}
