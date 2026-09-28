import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { Typography } from "heroui-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import { useChannels } from "@/features/channels/components/use-channels";
import { SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { type MobileAgent, useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { useText } from "@/shared/lib/text";

type AgentPage =
  | "/agent-info/[agentId]"
  | "/agent-info/[agentId]/files"
  | "/agent-info/[agentId]/routines"
  | "/agent-info/[agentId]/memories"
  | "/agent-info/[agentId]/skills"
  | "/agent-info/[agentId]/usage";
type ChannelPage =
  | "/channel-info/[channelId]"
  | "/channel-info/[channelId]/routines"
  | "/channel-info/[channelId]/memories";

type OpenChat = { kind: "agent"; id: string } | { kind: "channel"; id: string; serverId: string };

/** The chat shown in the middle pane, read from the route. */
export function useOpenChat(): OpenChat | null {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ serverId?: string }>();
  const [, kind, id] = pathname.split("/");
  if (!id) return null;
  if (kind === "chat") return { kind: "agent", id: decodeURIComponent(id) };
  if (kind === "channel" && params.serverId)
    return { kind: "channel", id: decodeURIComponent(id), serverId: params.serverId };
  return null;
}

/** Third pane: who the open chat is with, and the pages that manage it. Pages open as sheets. */
export function DetailsPane({ chat }: { chat: OpenChat }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      {chat.kind === "agent" ? <AgentDetails agentId={chat.id} /> : <ChannelDetails chat={chat} />}
    </ScrollView>
  );
}

function AgentDetails({ agentId }: { agentId: string }) {
  const { t } = useText();
  const { agents } = useMobileWorkspace();
  const agent = agents.find((candidate) => candidate.id === agentId);
  if (!agent) return null;
  const open = (pathname: AgentPage) =>
    router.push({ pathname, params: { agentId: agent.id, serverId: agent.serverId } });
  const runtime = [agent.provider, agent.model, agent.reasoningEffort].filter(Boolean).join(" · ");
  return (
    <>
      <View className="items-center gap-2">
        <BloubAvatar
          agentId={agent.id}
          serverId={agent.serverId}
          hue={agent.avatarHue}
          seed={agent.avatarSeed}
          size={72}
        />
        <Typography.Heading type="h4" align="center">
          {agent.name}
        </Typography.Heading>
        {agent.title ? (
          <Typography.Paragraph align="center" weight="semibold">
            {agent.title}
          </Typography.Paragraph>
        ) : null}
        {runtime ? (
          <Typography.Paragraph type="body-sm" align="center">
            {runtime}
          </Typography.Paragraph>
        ) : null}
      </View>
      {agent.description ? <Typography.Paragraph type="body-sm">{agent.description}</Typography.Paragraph> : null}
      <AgentPages agent={agent} open={open} label={t} />
    </>
  );
}

function AgentPages({
  open,
  label,
}: {
  agent: MobileAgent;
  open: (pathname: AgentPage) => void;
  label: ReturnType<typeof useText>["t"];
}) {
  return (
    <SettingsSection>
      <SettingsRow onPress={() => open("/agent-info/[agentId]")}>
        <Typography.Paragraph>{label("mobile.agent.menu.info")}</Typography.Paragraph>
      </SettingsRow>
      <SettingsRow onPress={() => open("/agent-info/[agentId]/files")}>
        <Typography.Paragraph>{label("mobile.agent.info.files.title")}</Typography.Paragraph>
      </SettingsRow>
      <SettingsRow onPress={() => open("/agent-info/[agentId]/routines")}>
        <Typography.Paragraph>{label("mobile.agent.info.routines.title")}</Typography.Paragraph>
      </SettingsRow>
      <SettingsRow onPress={() => open("/agent-info/[agentId]/memories")}>
        <Typography.Paragraph>{label("mobile.agent.info.memories.title")}</Typography.Paragraph>
      </SettingsRow>
      <SettingsRow onPress={() => open("/agent-info/[agentId]/skills")}>
        <Typography.Paragraph>{label("mobile.agent.info.skills.title")}</Typography.Paragraph>
      </SettingsRow>
      <SettingsRow onPress={() => open("/agent-info/[agentId]/usage")}>
        <Typography.Paragraph>{label("mobile.agent.info.usage.title")}</Typography.Paragraph>
      </SettingsRow>
    </SettingsSection>
  );
}

function ChannelDetails({ chat }: { chat: { id: string; serverId: string } }) {
  const { t } = useText();
  const { agents } = useMobileWorkspace();
  const { channels } = useChannels(chat.serverId);
  const channel = channels.find((candidate) => candidate.id === chat.id);
  if (!channel) return null;
  const members = channel.members
    .map((member) => agents.find((agent) => agent.id === member.agentId && agent.serverId === chat.serverId))
    .filter((agent): agent is MobileAgent => Boolean(agent));
  const open = (pathname: ChannelPage) =>
    router.push({ pathname, params: { channelId: channel.id, serverId: chat.serverId } });
  return (
    <>
      <Typography.Heading type="h4" align="center">
        {channel.name}
      </Typography.Heading>
      <SettingsSection title={t("mobile.workspace.split.members")}>
        {members.map((agent) => (
          <SettingsRow
            key={agent.id}
            leading={
              <BloubAvatar
                agentId={agent.id}
                serverId={agent.serverId}
                hue={agent.avatarHue}
                seed={agent.avatarSeed}
                size={32}
              />
            }
            onPress={() => router.push({ pathname: "/chat/[agentId]", params: { agentId: agent.id } })}
          >
            <Typography.Paragraph>{agent.name}</Typography.Paragraph>
          </SettingsRow>
        ))}
      </SettingsSection>
      <SettingsSection>
        <SettingsRow onPress={() => open("/channel-info/[channelId]")}>
          <Typography.Paragraph>{t("mobile.channel.route.info")}</Typography.Paragraph>
        </SettingsRow>
        <SettingsRow onPress={() => open("/channel-info/[channelId]/routines")}>
          <Typography.Paragraph>{t("mobile.channel.route.routines")}</Typography.Paragraph>
        </SettingsRow>
        <SettingsRow onPress={() => open("/channel-info/[channelId]/memories")}>
          <Typography.Paragraph>{t("mobile.channel.route.memories")}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
