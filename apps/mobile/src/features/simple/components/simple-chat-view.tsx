import { router } from "expo-router";
import { Button, Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { ArrowLeft, Hash, Info, Mic, Paperclip, Send, Square } from "lucide-react-native";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BloubAvatarThumbnail } from "@/features/agents/components/bloub-avatar";
import { ChatMarkdown } from "@/features/chat/components/chat-markdown";
import { exchangeLabel, RoutineMarkerRow } from "@/features/chat/components/chat-message-list";
import { ChatQuestionPrompt } from "@/features/chat/components/chat-question-prompt";
import type { ChatViewProps } from "@/features/chat/components/chat-view";
import { useVoiceDictation } from "@/features/chat/components/use-voice-dictation";
import { mentionDraft } from "@/features/chat/model/chat-mentions";
import type { ChatMessage } from "@/features/chat/model/chat-messages";
import { useFontScale } from "@/features/settings/model/font-size";
import { toggleDetailsPane, usePaneLayout } from "@/features/workspace/components/split-layout";
import type { MobileAgent } from "@/features/workspace/context/mobile-workspace-context";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";
import { DisplayZoom } from "../../../../modules/display-zoom";

type Translate = ReturnType<typeof useText>["t"];

/** Changing the zoom restarts the app, so it is read once. */
const APP_ZOOM = DisplayZoom?.getZoom() ?? 1;
const BUTTON_SIZE = 44;
const INPUT_PADDING = 10;
/** The input's 2 pt border on each side. */
const INPUT_BORDER = 4;

function IconButton({
  label,
  onPress,
  disabled = false,
  filled = false,
  bare = false,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
  /** No outline: a plain icon, as in the header. */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      className={`items-center justify-center rounded-full ${filled ? "bg-foreground" : ""} ${bare ? "" : `border-2 ${filled ? "border-foreground" : "border-border bg-background"}`}`}
      style={({ pressed }) => ({
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function activityText(props: ChatViewProps, t: Translate): string | null {
  const activity = props.activity;
  if (activity) {
    if (activity.phase === "waiting") return t("mobile.chat.activity.waitingForAnswer");
    if (activity.phase === "responding") return t("mobile.chat.activity.responding");
    return activity.detail ?? t("mobile.chat.activity.thinking");
  }
  if (props.activities?.length) {
    const names = props.activities
      .map((item) => props.agents.find((agent) => agent.id === item.agentId)?.name)
      .filter(Boolean);
    return names.length
      ? `${names.join(", ")} · ${t("mobile.chat.activity.thinking")}`
      : t("mobile.chat.activity.thinking");
  }
  return props.activeTurnId ? t("mobile.chat.activity.thinking") : null;
}

function MessageRow({
  message,
  props,
  agentsById,
  colors,
  t,
}: {
  message: ChatMessage;
  props: ChatViewProps;
  agentsById: ReadonlyMap<string, MobileAgent>;
  colors: { foreground: string; background: string };
  t: Translate;
}) {
  switch (message.kind) {
    case "message": {
      const user = message.author === "user";
      const speaker = props.target.kind === "channel" && message.speaker ? message.speaker.name : null;
      return (
        <View className={`gap-1 py-2 ${user ? "items-end" : "items-start"}`}>
          {speaker && !user ? (
            <Typography.Paragraph type="body-sm" weight="bold">
              {speaker}
            </Typography.Paragraph>
          ) : null}
          {message.attachments?.map((file) => (
            <View key={file.id} className="flex-row items-center gap-2 rounded-2xl border border-border px-3 py-2">
              <Paperclip color={colors.foreground} size={18} strokeWidth={2} />
              <Typography.Paragraph type="body-sm" numberOfLines={1}>
                {file.name}
              </Typography.Paragraph>
            </View>
          ))}
          {message.body.trim() ? (
            <View className={user ? "max-w-[85%] rounded-3xl rounded-br-md bg-foreground px-4 py-3" : "w-full"}>
              <ChatMarkdown
                body={message.body}
                color={user ? colors.background : colors.foreground}
                live={message.streaming}
                animationEnabled={false}
                agents={props.agents}
              />
            </View>
          ) : null}
          {message.failureReason ? (
            <Typography.Paragraph type="body-sm" className="text-danger-text">
              {message.failureReason}
            </Typography.Paragraph>
          ) : null}
        </View>
      );
    }
    case "plan":
      return (
        <View className="my-2 gap-2 rounded-3xl border border-border p-4">
          <Typography.Paragraph weight="bold">{message.heading ?? t("mobile.chat.plan.title")}</Typography.Paragraph>
          {message.steps.map((step) => (
            <Typography.Paragraph key={step.id} weight={step.state === "active" ? "bold" : "normal"}>
              {step.state === "done" ? "☑" : step.state === "active" ? "▶" : "☐"} {step.text}
            </Typography.Paragraph>
          ))}
          {message.stopped ? (
            <Typography.Paragraph type="body-sm">{t("mobile.chat.plan.stopped")}</Typography.Paragraph>
          ) : null}
        </View>
      );
    case "question":
      return (
        <View className="py-2">
          <ChatQuestionPrompt
            prompt={message.prompt}
            controller={props.questionForm?.messageId === message.id ? props.questionForm : undefined}
            canSend={props.canSend}
            onActivate={props.onSelectQuestion ? () => props.onSelectQuestion?.(message.id) : undefined}
          />
        </View>
      );
    case "routine":
      return <RoutineMarkerRow message={message} muted={colors.foreground} />;
    case "exchange":
    case "channel-routing": {
      const label =
        message.kind === "channel-routing"
          ? t(
              message.event.action === "assigned"
                ? "mobile.chat.exchange.assignedTo"
                : "mobile.chat.exchange.continuingWith",
            )
          : exchangeLabel(message.exchange, t);
      const ids =
        message.kind === "channel-routing"
          ? [message.event.agentId]
          : message.exchange.direction === "incoming"
            ? [message.exchange.senderAgentId]
            : message.exchange.recipientAgentIds;
      const names = ids
        .map((id) =>
          id
            ? (agentsById.get(id)?.name ?? t("mobile.chat.exchange.unknownAgent"))
            : message.kind === "channel-routing" && message.event.agentId === null
              ? message.event.agentName
              : t("mobile.chat.exchange.unknownAgent"),
        )
        .join(", ");
      return (
        <Typography.Paragraph
          type="body-sm"
          align="center"
          className="my-1.5 self-center rounded-full border border-border px-4 py-1"
        >
          {label}{" "}
          <Typography.Paragraph type="body-sm" weight="bold">
            {names}
          </Typography.Paragraph>
        </Typography.Paragraph>
      );
    }
    default:
      return null;
  }
}

/**
 * The chat of the plain interface: a solid header, the transcript as static text, and a bordered
 * composer with the mic beside it. It takes the same inputs as the animated phone chat.
 */
export function SimpleChatView(props: ChatViewProps) {
  const { target, projectedMessages, canSend, readOnly, questionForm, readBoundary, markRead, send } = props;
  const { t, errorMessage } = useText();
  const insets = useSafeAreaInsets();
  const [foreground, background] = useThemeColor(["foreground", "background"]);
  const colors = { foreground: String(foreground), background: String(background) };
  // The composer is a native input outside the type scale, so it follows the font size itself.
  const fontScale = useFontScale();
  const lineHeight = Math.round(24 * fontScale);
  const inputHeight = Math.max(BUTTON_SIZE, lineHeight + INPUT_PADDING * 2 + INPUT_BORDER);
  const { mode, detailsFit, detailsOpen } = usePaneLayout();
  // Back returns to the chat list unless the list is already beside the chat.
  const showBack = mode !== "wide";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ body: string; baseline: ReadonlySet<string> } | null>(null);
  const dictation = useVoiceDictation({ enabled: canSend && !readOnly, onDraft: setDraft });
  const agentsById = useMemo(() => new Map(props.agents.map((agent) => [agent.id, agent])), [props.agents]);
  const answersQuestion = Boolean(
    questionForm?.question && !questionForm.question.isSecret && questionForm.replyInChat,
  );

  useEffect(() => {
    if (readBoundary) markRead();
  }, [markRead, readBoundary]);

  // The sent message shows until the host transcript has it.
  useEffect(() => {
    if (!pending) return;
    if (
      projectedMessages.some(
        (item) => item.kind === "message" && item.author === "user" && !pending.baseline.has(item.id),
      )
    )
      setPending(null);
  }, [pending, projectedMessages]);

  const rows = useMemo(() => {
    const visible = projectedMessages.filter((message) => message.kind !== "thinking");
    const withPending: ChatMessage[] = pending
      ? [...visible, { id: "pending", kind: "message", author: "user", body: pending.body, streaming: false }]
      : visible;
    return [...withPending].reverse();
  }, [pending, projectedMessages]);

  const activity = activityText(props, t);
  const canStop = Boolean(props.stopTurn && props.activeTurnId && !stopping);

  async function submit() {
    if (dictation.phase !== "idle") await dictation.finish();
    const body = draft.trim();
    if (!body || sending || !canSend) return;
    setError(null);
    if (answersQuestion && questionForm) {
      if (questionForm.disabled) return;
      setDraft("");
      questionForm.answer([mentionDraft(body).text]);
      return;
    }
    setDraft("");
    setSending(true);
    setPending({ body, baseline: new Set(projectedMessages.map((item) => item.id)) });
    try {
      const receipt = await send(body, [], null);
      if (!receipt || typeof receipt === "object") setPending(null);
    } catch (cause) {
      setPending(null);
      setDraft(body);
      setError(errorMessage(cause, t("mobile.chat.composer.sendFailed")));
      void haptics.notification("error");
    } finally {
      setSending(false);
    }
  }

  function stop() {
    const turnId = props.activeTurnId;
    if (!props.stopTurn || !turnId) return;
    setStopping(true);
    props
      .stopTurn(turnId)
      .catch((cause: unknown) => setError(errorMessage(cause, t("mobile.chat.composer.stopFailed"))))
      .finally(() => setStopping(false));
  }

  function leaveChat() {
    if (router.canGoBack()) router.back();
    else router.replace("/connected");
  }
  // A swipe to the right returns to the chat list, like Back.
  const swipeBack = Gesture.Fling()
    .direction(Directions.RIGHT)
    .enabled(showBack)
    .runOnJS(true)
    .onEnd(() => leaveChat());

  function openInfo() {
    if (detailsFit) {
      toggleDetailsPane(detailsOpen);
      return;
    }
    if (target.kind === "channel")
      router.push({
        pathname: "/channel-info/[channelId]",
        params: { channelId: target.id, serverId: target.serverId },
      });
    else router.push({ pathname: "/agent-info/[agentId]", params: { agentId: target.id, serverId: target.serverId } });
  }

  const listening = dictation.phase === "listening" || dictation.phase === "starting";
  // Android 15 draws edge to edge, so the window no longer shrinks for the keyboard. A spacer under
  // the composer takes the keyboard's height; the keyboard also covers the navigation bar inset.
  // The keyboard library measures in unzoomed points, so its height is divided by the app zoom.
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardSpace = useAnimatedStyle(() => ({
    height: Math.max(0, -keyboard.height.get() / APP_ZOOM - insets.bottom),
  }));
  const queued = props.queue?.queued.length ?? 0;

  return (
    <GestureDetector gesture={swipeBack}>
      <View className="flex-1 bg-background">
        <View
          className="flex-row items-center gap-3 border-b border-border px-3 pb-1.5"
          style={{ paddingTop: insets.top }}
        >
          {showBack ? (
            <IconButton bare label={t("common.back")} onPress={leaveChat}>
              <ArrowLeft color={colors.foreground} size={22} strokeWidth={2} />
            </IconButton>
          ) : null}
          {target.kind === "agent" ? (
            <BloubAvatarThumbnail
              agentId={target.id}
              serverId={target.serverId}
              seed={target.avatarSeed}
              hue={target.avatarHue}
              size={40}
            />
          ) : (
            <View className="size-10 items-center justify-center rounded-full border-2 border-foreground">
              <Hash color={colors.foreground} size={20} strokeWidth={2.2} />
            </View>
          )}
          <View className="min-w-0 flex-1">
            <Typography.Paragraph weight="bold" numberOfLines={1}>
              {target.name}
            </Typography.Paragraph>
            <Typography.Paragraph type="body-sm" numberOfLines={1}>
              {activity ?? (canSend ? t("mobile.workspace.status.online") : t("mobile.workspace.status.offline"))}
            </Typography.Paragraph>
          </View>
          <IconButton
            label={
              detailsFit
                ? t(detailsOpen ? "mobile.workspace.split.hideDetails" : "mobile.workspace.split.showDetails")
                : t("mobile.agent.menu.info")
            }
            onPress={openInfo}
            filled={detailsOpen}
            bare
          >
            <Info color={detailsOpen ? colors.background : colors.foreground} size={22} strokeWidth={2} />
          </IconButton>
        </View>

        <FlatList
          inverted
          data={rows}
          keyExtractor={(item) => item.id}
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View className="w-full max-w-[760px] self-center">
              <MessageRow message={item} props={props} agentsById={agentsById} colors={colors} t={t} />
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center py-16" style={{ transform: [{ scaleY: -1 }] }}>
              <Typography.Paragraph align="center">
                {props.historyLoadFailed
                  ? t("mobile.chat.history.loadFailed")
                  : props.ready
                    ? t("mobile.chat.composer.ask", { name: target.name })
                    : canSend
                      ? t("mobile.chat.history.loading")
                      : t("mobile.chat.history.waiting")}
              </Typography.Paragraph>
              {props.historyLoadFailed ? (
                <Button variant="secondary" onPress={props.fetchHistory}>
                  <Button.Label>{t("common.tryAgain")}</Button.Label>
                </Button>
              ) : null}
            </View>
          }
          ListFooterComponent={
            props.hasOlder ? (
              <View className="items-center py-3">
                <Button
                  variant="outline"
                  className="rounded-full"
                  isDisabled={props.olderLoading}
                  onPress={props.loadOlder}
                >
                  <Button.Label>
                    {props.olderLoading
                      ? t("mobile.chat.history.loadingOlder")
                      : props.olderError
                        ? t("mobile.chat.history.retryOlder")
                        : t("mobile.chat.history.loadOlder")}
                  </Button.Label>
                </Button>
              </View>
            ) : null
          }
        />

        {props.notice ? (
          <View className="border-t border-border px-4 py-2">
            <Typography.Paragraph type="body-sm">{props.notice}</Typography.Paragraph>
          </View>
        ) : null}
        {activity || queued || error ? (
          <View className="mx-3 mb-1 flex-row items-center gap-3 rounded-full border border-border py-1.5 pr-1.5 pl-4">
            <Typography.Paragraph
              type="body-sm"
              weight="semibold"
              className={`min-w-0 flex-1 ${error ? "text-danger-text" : ""}`}
              numberOfLines={2}
            >
              {error ?? activity ?? ""}
            </Typography.Paragraph>
            {queued && props.queue ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onPress={() =>
                  router.push({ pathname: "/queued-messages", params: { chat: props.queue?.chatId ?? "" } })
                }
              >
                <Button.Label>{t("mobile.workspace.shell.queued", { count: queued })}</Button.Label>
              </Button>
            ) : null}
            {canStop ? (
              <Button variant="outline" size="sm" className="rounded-full" onPress={stop}>
                <Square color={colors.foreground} size={14} strokeWidth={2.5} fill={colors.foreground} />
                <Button.Label>{t("mobile.workspace.shell.stop")}</Button.Label>
              </Button>
            ) : null}
          </View>
        ) : null}

        {readOnly ? null : (
          <View className="flex-row items-end gap-2 px-3 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              editable={canSend}
              multiline
              placeholder={
                listening
                  ? t("mobile.workspace.shell.listening")
                  : answersQuestion
                    ? t("mobile.workspace.shell.answer")
                    : t("mobile.chat.composer.ask", { name: target.name })
              }
              placeholderTextColor={colors.foreground}
              className="min-w-0 flex-1 border-2 border-border px-5 text-body text-foreground"
              style={{
                minHeight: inputHeight,
                maxHeight: 220,
                borderRadius: inputHeight / 2,
                paddingTop: INPUT_PADDING,
                paddingBottom: INPUT_PADDING,
                fontSize: 16 * fontScale,
                lineHeight,
                // Android adds font-dependent padding above and below a line, which sits one line
                // off-centre in a pill on some fonts; without it the line centres exactly.
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
              accessibilityLabel={t("mobile.chat.composer.ask", { name: target.name })}
            />
            {/* The buttons sit centred on the input's last line, so a one-line input lines up exactly. */}
            <View className="flex-row gap-2" style={{ marginBottom: (inputHeight - BUTTON_SIZE) / 2 }}>
              {dictation.available ? (
                <IconButton
                  label={listening ? t("mobile.chat.composer.stopDictation") : t("mobile.chat.composer.dictate")}
                  onPress={() => (listening ? void dictation.finish() : dictation.start(draft))}
                  disabled={!canSend}
                  filled={listening}
                >
                  <Mic color={listening ? colors.background : colors.foreground} size={22} strokeWidth={2} />
                </IconButton>
              ) : null}
              <IconButton
                label={t("mobile.chat.composer.send")}
                onPress={() => void submit()}
                disabled={!canSend || sending || (!draft.trim() && !listening)}
                filled
              >
                <Send color={colors.background} size={20} strokeWidth={2} />
              </IconButton>
            </View>
          </View>
        )}
        <Animated.View style={keyboardSpace} />
      </View>
    </GestureDetector>
  );
}
