import { Host, Slider } from "@expo/ui";
import { APP_LANGUAGE_OPTIONS } from "@openbot/i18n/languages";
import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { Type } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useUniwind } from "uniwind";
import { saveAnalyticsPreference, useAnalyticsPreference } from "@/features/analytics/preference";
import { dictationLanguageOptions } from "@/features/chat/model/voice-dictation";
import { SettingsContent, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { MenuChoiceRow, SegmentedChoice, ToggleRow } from "@/features/settings/components/settings-controls";
import { saveAppLanguage, useAppLanguage } from "@/features/settings/model/app-language";
import { saveAppearance, useAppearance } from "@/features/settings/model/appearance";
import {
  AUTOMATIC_DICTATION_LANGUAGE,
  saveDictationLanguage,
  useDictationLanguage,
} from "@/features/settings/model/dictation-language";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, saveFontSize, useFontSize } from "@/features/settings/model/font-size";
import { saveHapticsPreference, useHapticsPreference } from "@/features/settings/model/haptics";
import { useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { haptics } from "@/shared/lib/haptics";
import { speechRecognition } from "@/shared/lib/speech-recognition";
import { useText } from "@/shared/lib/text";
import { DisplayZoom } from "../../../../modules/display-zoom";

/**
 * Font size as a slider from small to large, like iOS. It applies while dragging and scales text
 * only, so the sample line and the whole app follow the thumb.
 */
function FontSizeRow({ dark }: { dark: boolean }) {
  const { t } = useText();
  const value = useFontSize((state) => state.value);
  const foreground = String(useThemeColor("foreground"));
  return (
    <View className="gap-3 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Typography.Paragraph>{t("mobile.settings.appearance.fontSize")}</Typography.Paragraph>
        <Typography.Paragraph weight="semibold">{`${Math.round(value * 100)}%`}</Typography.Paragraph>
      </View>
      <View className="flex-row items-center gap-3">
        <Type color={foreground} size={16} strokeWidth={2} />
        <Host matchContents={{ vertical: true }} style={{ flex: 1 }} colorScheme={dark ? "dark" : "light"}>
          <Slider
            value={value}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={0.05}
            onValueChange={(next) => {
              const rounded = Math.round(next * 20) / 20;
              if (rounded !== value) void saveFontSize(rounded).catch(() => undefined);
            }}
          />
        </Host>
        <Type color={foreground} size={30} strokeWidth={2} />
      </View>
      <Typography.Paragraph>{t("mobile.settings.appearance.fontSizeSample")}</Typography.Paragraph>
    </View>
  );
}

// Changing the zoom restarts the app, so the row only needs the value read at startup.
function ZoomRow() {
  const { t } = useText();
  const [zoom] = useState(() => DisplayZoom?.getZoom() ?? 1);
  const scales = DisplayZoom;
  if (!scales) return null;
  return (
    <MenuChoiceRow
      label={t("mobile.settings.appearance.zoom")}
      value={String(zoom)}
      choices={scales.zooms.map((item) => ({ value: String(item), label: `${Math.round(item * 100)}%` }))}
      onChange={(next) => scales.setZoom(Number(next))}
    />
  );
}

function LanguageSection() {
  const { t } = useText();
  const language = useAppLanguage();
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsSection title={t("mobile.settings.language.title")} footer={error ?? t("mobile.settings.language.footer")}>
      <MenuChoiceRow
        label={t("mobile.settings.language.row")}
        value={language.value}
        disabled={!language.ready || language.saving}
        choices={APP_LANGUAGE_OPTIONS.map((option) => ({
          value: option.id,
          label: option.id === "system" ? t("mobile.settings.language.system") : option.label,
        }))}
        onChange={(next) => {
          setError(null);
          void saveAppLanguage(next).catch(() => {
            setError(t("mobile.settings.saveFailed"));
            void haptics.notification("error");
          });
        }}
      />
    </SettingsSection>
  );
}

function DictationSection() {
  const { t } = useText();
  const language = useDictationLanguage();
  const [supported, setSupported] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void speechRecognition
      ?.getSupportedLocales({})
      .then(({ locales }) => {
        if (active) setSupported(locales);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  // Without the module the composer has no mic, so the setting would do nothing.
  if (!speechRecognition) return null;
  const automatic = language.value === AUTOMATIC_DICTATION_LANGUAGE;
  const options = dictationLanguageOptions(supported, automatic ? null : language.value, t);
  return (
    <SettingsSection
      title={t("mobile.settings.dictation.title")}
      footer={error ?? t("mobile.settings.dictation.footer")}
    >
      <MenuChoiceRow
        label={t("mobile.settings.dictation.language")}
        value={language.value}
        disabled={!language.ready || language.saving}
        choices={[
          { value: AUTOMATIC_DICTATION_LANGUAGE, label: t("mobile.settings.dictation.automatic") },
          ...options.map((option) => ({ value: option.value, label: option.label })),
        ]}
        onChange={(next) => {
          setError(null);
          void saveDictationLanguage(next).catch(() => {
            setError(t("mobile.settings.saveFailed"));
            void haptics.notification("error");
          });
        }}
      />
    </SettingsSection>
  );
}

export function GeneralSettingsScreen() {
  const { t } = useText();
  const { theme } = useUniwind();
  const { activeServer } = useMobileWorkspace();
  const hapticsPreference = useHapticsPreference();
  const [hapticsError, setHapticsError] = useState<string | null>(null);
  function saveHaptics(enabled: boolean) {
    setHapticsError(null);
    void saveHapticsPreference(enabled).catch(() => {
      setHapticsError(t("mobile.settings.saveFailed"));
      void haptics.notification("error");
    });
  }
  const analytics = useAnalyticsPreference();
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [retryAnalyticsValue, setRetryAnalyticsValue] = useState<boolean | null>(null);
  function saveAnalytics(enabled: boolean) {
    setAnalyticsError(null);
    setRetryAnalyticsValue(null);
    void saveAnalyticsPreference(enabled).catch(() => {
      setRetryAnalyticsValue(enabled);
      setAnalyticsError(t("mobile.settings.saveFailed"));
      void haptics.notification("error");
    });
  }
  const { value, ready, saving } = useAppearance();
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsContent>
      <SettingsSection
        title={t("mobile.settings.appearance.title")}
        footer={
          error ||
          [t("mobile.settings.appearance.footer"), DisplayZoom ? t("mobile.settings.appearance.zoomFooter") : null]
            .filter(Boolean)
            .join(" ")
        }
      >
        <SegmentedChoice
          label={t("mobile.settings.appearance.theme")}
          value={value}
          disabled={!ready || saving}
          choices={[
            { value: "system", label: t("mobile.settings.appearance.system") },
            { value: "light", label: t("mobile.settings.appearance.light") },
            { value: "dark", label: t("mobile.settings.appearance.dark") },
            { value: "eink", label: t("mobile.settings.appearance.eink") },
          ]}
          onChange={(next) => {
            setError(null);
            void saveAppearance(next).catch(() => {
              setError(t("mobile.settings.appearance.saveFailed"));
              void haptics.notification("error");
            });
          }}
        />
        <FontSizeRow dark={theme === "dark"} />
        <ZoomRow />
      </SettingsSection>
      <LanguageSection />
      <DictationSection />
      <SettingsSection
        title={t("mobile.settings.feedback.title")}
        footer={hapticsError ?? t("mobile.settings.feedback.footer")}
      >
        <ToggleRow
          label={t("mobile.settings.feedback.haptics")}
          value={hapticsPreference.enabled}
          disabled={!hapticsPreference.ready || hapticsPreference.saving}
          onChange={saveHaptics}
        />
        {hapticsError ? (
          <SettingsRow
            disabled={hapticsPreference.saving}
            disclosure={false}
            onPress={() => saveHaptics(hapticsPreference.enabled)}
          >
            <Typography.Paragraph>{t("mobile.settings.feedback.retry")}</Typography.Paragraph>
          </SettingsRow>
        ) : null}
      </SettingsSection>
      <SettingsSection
        title={t("mobile.settings.privacy.title")}
        footer={analyticsError ?? t("mobile.settings.privacy.footer")}
      >
        <ToggleRow
          label={t("mobile.settings.privacy.analytics")}
          value={analytics.enabled}
          disabled={!analytics.ready || analytics.saving}
          onChange={saveAnalytics}
        />
        {retryAnalyticsValue !== null ? (
          <SettingsRow
            disabled={analytics.saving}
            disclosure={false}
            onPress={() => saveAnalytics(retryAnalyticsValue)}
          >
            <Typography.Paragraph>{t("mobile.settings.privacy.retry")}</Typography.Paragraph>
          </SettingsRow>
        ) : null}
      </SettingsSection>
      <SettingsSection title={t("mobile.settings.conversations.title")}>
        <SettingsRow onPress={() => router.push("/settings/hidden-chats")}>
          <Typography.Paragraph>{t("mobile.settings.conversations.hiddenChats")}</Typography.Paragraph>
        </SettingsRow>
        <SettingsRow
          onPress={() => router.push({ pathname: "/settings/deleted-chats", params: { serverId: activeServer.id } })}
        >
          <Typography.Paragraph>{t("mobile.settings.conversations.deletedChannels")}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
    </SettingsContent>
  );
}
