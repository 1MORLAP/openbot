import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import { type SharedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { AUTOMATIC_DICTATION_LANGUAGE, useDictationLanguage } from "@/features/settings/model/dictation-language";
import { useEinkMode } from "@/shared/lib/eink";
import { haptics } from "@/shared/lib/haptics";
import { phoneLanguages } from "@/shared/lib/phone-languages";
import { isAndroid, isIOS } from "@/shared/lib/platform";
import { speechRecognition } from "@/shared/lib/speech-recognition";
import { currentText } from "@/shared/lib/text";
import { useAppForeground } from "@/shared/lib/use-app-foreground";
import { VoiceInput } from "../../../../modules/voice-input";
import {
  applyDictationResult,
  type DictationNotice,
  type DictationPhase,
  type DictationTranscript,
  dictationDraft,
  dictationFailedNotice,
  dictationNotice,
  emptyDictationTranscript,
  hasRecognitionLocale,
  microphoneOffNotice,
  noSpeechServiceNotice,
  pickRecognitionLocale,
  pickSpeechService,
  retriesWithSystemService,
  retriesWithVoiceDialog,
  spokenText,
} from "../model/voice-dictation";

type Recognizer = NonNullable<typeof speechRecognition>;
type StartOptions = Parameters<Recognizer["start"]>[0];
type SupportedLocales = { locales: string[]; installedLocales: string[] };

interface DictationSession {
  base: string;
  transcript: DictationTranscript;
  /** Null until permission and the locale are known. */
  options: StartOptions | null;
  /**
   * The native recognizer runs for this session. Events before that belong to
   * an earlier one: `abort()` reports its `end` later, sometimes after the next
   * mic press.
   */
  native: boolean;
  heard: boolean;
  /**
   * `pending` restarts with the system service when the failed session ends, and `dialog` opens
   * the system voice input dialog instead.
   */
  fallback: "none" | "pending" | "used" | "dialog";
  /** The system voice input dialog is open; it cannot be stopped from here. */
  dialog: boolean;
}

// The recognizer is one native session for the whole app, and every mounted
// chat receives its events. Only the composer that started the session reacts.
let owner: symbol | null = null;

// A stop that never reports its end must not hold the composer. The draft
// already has the last partial result, so nothing is lost.
const STOP_TIMEOUT_MS = 3000;

/**
 * iOS answers for the phone's default locale and the network state at the time
 * of the call, which can change or differ from the dictation language. So iOS
 * only needs the module, and a failed start explains itself. Android answers
 * whether any recognition service is installed, which does not change.
 */
function recognitionAvailable(): boolean {
  if (!speechRecognition) return false;
  if (isIOS) return true;
  try {
    return speechRecognition.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/**
 * Some Android devices, e-ink readers among them, install a speech service but set none as the
 * default, so a recognizer without a package cannot start. Name one of the installed services.
 */
function speechServicePackage(module: Recognizer): string | undefined {
  if (!isAndroid) return undefined;
  try {
    return pickSpeechService(module.getDefaultRecognitionService().packageName, module.getSpeechRecognitionServices());
  } catch {
    return undefined;
  }
}

function voiceDialogAvailable(): boolean {
  try {
    return VoiceInput?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

function supportedLocales(module: Recognizer): Promise<SupportedLocales> {
  const androidRecognitionServicePackage = speechServicePackage(module);
  return module
    .getSupportedLocales(androidRecognitionServicePackage ? { androidRecognitionServicePackage } : {})
    .catch((): SupportedLocales => ({ locales: [], installedLocales: [] }));
}

async function recognitionOptions(module: Recognizer, supported: Promise<SupportedLocales>) {
  // The phone's language list, not the app's locale. OpenBot has one
  // localization, so the app's own locale can be English on a Polish phone.
  const chosen = useDictationLanguage.getState().value;
  const preferred =
    chosen !== AUTOMATIC_DICTATION_LANGUAGE
      ? [chosen]
      : [...phoneLanguages(), Intl.DateTimeFormat().resolvedOptions().locale];
  const locales = await supported;
  const lang = pickRecognitionLocale(preferred, locales.locales);
  // iOS applies this only where the recognizer supports it, and uses Apple's
  // service otherwise. Android fails without an installed language model, so
  // ask for on-device recognition only for an installed locale.
  const requiresOnDeviceRecognition =
    isIOS || (module.supportsOnDeviceRecognition() && hasRecognitionLocale(lang, locales.installedLocales));
  const androidRecognitionServicePackage = speechServicePackage(module);
  return {
    lang,
    requiresOnDeviceRecognition,
    ...(androidRecognitionServicePackage ? { androidRecognitionServicePackage } : {}),
  };
}

function showNotice(notice: DictationNotice): void {
  void haptics.notification("error");
  const { t } = currentText();
  const storeUrl = notice.storeUrl;
  Alert.alert(
    t(notice.title),
    t(notice.message),
    notice.openSettings
      ? [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("mobile.chat.dictation.openSettings"), onPress: () => void Linking.openSettings() },
        ]
      : storeUrl
        ? [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("mobile.chat.dictation.getService"),
              onPress: () => void Linking.openURL(storeUrl).catch(() => undefined),
            },
          ]
        : undefined,
  );
}

export interface VoiceDictation {
  available: boolean;
  phase: DictationPhase;
  /** Input level from 0 to 1, for the listening indicator. */
  level: SharedValue<number>;
  /** Starts listening. The speech goes after `base` in the draft. */
  start: (base: string) => void;
  /** Stops listening and keeps the text. Resolves after the final result. */
  finish: () => Promise<void>;
  /** Stops listening and puts back the draft from before the mic. */
  cancel: () => void;
}

/**
 * Live dictation into the composer draft. Each result replaces the spoken part
 * of the draft, so the user sees the text while speaking. Nothing is sent here.
 */
export function useVoiceDictation({
  enabled,
  onDraft,
}: {
  /** False stops listening and keeps the text, for example when the chat goes offline. */
  enabled: boolean;
  onDraft: (text: string) => void;
}): VoiceDictation {
  const [id] = useState(() => Symbol("dictation"));
  const [live] = useState(recognitionAvailable);
  // Android always shows the mic: without a live recognizer it opens the system voice input
  // dialog, and without that it explains which app to install.
  const available = live || isAndroid;
  // The input level redraws the indicator ten times a second, a panel flash each time on e-ink.
  const eink = useEinkMode();
  const [phase, setPhase] = useState<DictationPhase>("idle");
  const phaseRef = useRef<DictationPhase>("idle");
  const level = useSharedValue(0);
  const session = useRef<DictationSession | null>(null);
  const finished = useRef<(() => void)[]>([]);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read when the chat opens, so a mic press does not wait for the service.
  const locales = useRef<Promise<SupportedLocales> | null>(null);
  useEffect(() => {
    if (speechRecognition && live) locales.current = supportedLocales(speechRecognition);
  }, [live]);
  const onDraftRef = useRef(onDraft);
  useEffect(() => {
    onDraftRef.current = onDraft;
  });

  const update = useCallback((next: DictationPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const settle = useCallback(() => {
    if (owner === id) owner = null;
    session.current = null;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    level.set(0);
    update("idle");
    for (const resolve of finished.current.splice(0)) resolve();
  }, [id, level, update]);

  const openVoiceDialog = useCallback(
    (current: DictationSession) => {
      const module = VoiceInput;
      if (!module) {
        settle();
        showNotice(noSpeechServiceNotice);
        return;
      }
      current.native = false;
      current.dialog = true;
      update("listening");
      const chosen = useDictationLanguage.getState().value;
      const language =
        current.options?.lang ?? (chosen !== AUTOMATIC_DICTATION_LANGUAGE ? chosen : (phoneLanguages()[0] ?? null));
      void module
        .recognize(language, currentText().t("mobile.chat.dictation.voicePrompt"))
        .then((text) => {
          if (owner !== id || session.current !== current) return;
          if (text?.trim()) onDraftRef.current(dictationDraft(current.base, text.trim()));
          settle();
        })
        .catch(() => {
          if (session.current !== current) return;
          settle();
          showNotice(dictationFailedNotice);
        });
    },
    [id, settle, update],
  );

  useEffect(() => {
    if (!speechRecognition) return;
    const subscriptions = [
      speechRecognition.addListener("start", () => {
        if (owner !== id || !session.current?.native || phaseRef.current !== "starting") return;
        update("listening");
        void haptics.impact("light");
      }),
      speechRecognition.addListener("result", (event) => {
        const current = session.current;
        if (owner !== id || !current?.native) return;
        current.heard = true;
        current.transcript = applyDictationResult(current.transcript, {
          isFinal: event.isFinal,
          text: event.results[0]?.transcript ?? "",
        });
        onDraftRef.current(dictationDraft(current.base, spokenText(current.transcript)));
      }),
      speechRecognition.addListener("error", (event) => {
        const current = session.current;
        if (owner !== id || !current?.native) return;
        if (
          current.options?.requiresOnDeviceRecognition &&
          current.fallback === "none" &&
          !current.heard &&
          phaseRef.current !== "stopping" &&
          retriesWithSystemService(event.error)
        ) {
          current.fallback = "pending";
          return;
        }
        if (
          isAndroid &&
          !current.heard &&
          phaseRef.current !== "stopping" &&
          retriesWithVoiceDialog(event.error) &&
          voiceDialogAvailable()
        ) {
          current.fallback = "dialog";
          return;
        }
        const notice = dictationNotice(event.error);
        if (notice) showNotice(notice);
      }),
      speechRecognition.addListener("end", () => {
        const current = session.current;
        if (owner !== id || !current?.native) return;
        if (current.fallback === "pending" && current.options && phaseRef.current !== "stopping") {
          current.fallback = "used";
          current.options = { ...current.options, requiresOnDeviceRecognition: false };
          speechRecognition?.start(current.options);
          return;
        }
        if (current.fallback === "dialog" && phaseRef.current !== "stopping") {
          openVoiceDialog(current);
          return;
        }
        settle();
      }),
      speechRecognition.addListener("volumechange", ({ value }) => {
        // The platform reports -2 to 10, and anything below 0 is silence.
        if (owner === id && session.current?.native)
          level.set(withTiming(Math.min(1, Math.max(0, value / 10)), { duration: 100 }));
      }),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [id, level, openVoiceDialog, settle, update]);

  const start = useCallback(
    (base: string) => {
      const module = speechRecognition;
      if (!available || owner || phaseRef.current !== "idle") return;
      owner = id;
      const current: DictationSession = {
        base,
        transcript: emptyDictationTranscript,
        options: null,
        native: false,
        heard: false,
        fallback: "none",
        dialog: false,
      };
      session.current = current;
      update("starting");
      if (!module || !live) {
        // The dialog asks for the microphone itself.
        if (voiceDialogAvailable()) openVoiceDialog(current);
        else {
          settle();
          showNotice(noSpeechServiceNotice);
        }
        return;
      }
      // A cancel, or a cancel and a new press, can happen during either wait.
      // Only this session may continue.
      const stillCurrent = () => owner === id && session.current === current && phaseRef.current === "starting";
      void (async () => {
        try {
          const permission = await module.requestPermissionsAsync();
          if (!stillCurrent()) return;
          if (!permission.granted) {
            settle();
            showNotice(microphoneOffNotice);
            return;
          }
          locales.current ??= supportedLocales(module);
          const locale = await recognitionOptions(module, locales.current);
          if (!stillCurrent()) return;
          current.options = {
            ...locale,
            interimResults: true,
            continuous: true,
            addsPunctuation: true,
            iosTaskHint: "dictation",
            volumeChangeEventOptions: { enabled: !eink, intervalMillis: 100 },
          };
          current.native = true;
          module.start(current.options);
        } catch {
          if (session.current !== current) return;
          settle();
          showNotice(dictationFailedNotice);
        }
      })();
    },
    [available, eink, id, live, openVoiceDialog, settle, update],
  );

  const finish = useCallback((): Promise<void> => {
    if (owner !== id) return Promise.resolve();
    // The system dialog owns the microphone until the user closes it; its result arrives then.
    if (session.current?.dialog) return new Promise((resolve) => finished.current.push(resolve));
    if (!speechRecognition) return Promise.resolve();
    if (phaseRef.current === "starting") {
      // No speech yet: the permission prompt or the recognizer is still opening.
      speechRecognition.abort();
      settle();
      return Promise.resolve();
    }
    const module = speechRecognition;
    return new Promise((resolve) => {
      finished.current.push(resolve);
      if (phaseRef.current === "stopping") return;
      update("stopping");
      void haptics.selection();
      module.stop();
      stopTimer.current = setTimeout(() => {
        if (owner !== id) return;
        module.abort();
        settle();
      }, STOP_TIMEOUT_MS);
    });
  }, [id, settle, update]);

  const cancel = useCallback(() => {
    const current = session.current;
    if (owner !== id || !current || current.dialog) return;
    speechRecognition?.abort();
    onDraftRef.current(current.base);
    void haptics.selection();
    settle();
  }, [id, settle]);

  const foreground = useAppForeground();
  useEffect(() => {
    if (owner !== id) return;
    // Android reports the app as in the background while its permission dialog
    // is open, so the first press must not stop itself there.
    if (!enabled || (!foreground && phaseRef.current !== "starting")) void finish();
  }, [enabled, foreground, finish, id]);

  useEffect(
    () => () => {
      if (owner !== id) return;
      // The draft already holds the last result, so leaving the chat keeps it.
      speechRecognition?.abort();
      owner = null;
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [id],
  );

  return { available, phase, level, start, finish, cancel };
}
