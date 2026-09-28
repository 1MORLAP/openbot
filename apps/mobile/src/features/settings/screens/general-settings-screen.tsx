import { Host, Picker, Slider, Switch } from "@expo/ui";
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

// Changing either scale restarts the app, so the pickers only need the values read at startup.
function ScaleRow({
  dark,
  label,
  value,
  values,
  onChange,
}: {
  dark: boolean;
  label: string;
  value: number;
  values: readonly number[];
  onChange: (value: number) => void;
}) {
  return (
    <SettingsRow
      trailing={
        <Host matchContents colorScheme={dark ? "dark" : "light"}>
          <Picker
            selectedValue={String(value)}
            onValueChange={(next) => {
              void haptics.selection();
              onChange(Number(next));
            }}
          >
            {values.map((item) => (
              <Picker.Item key={item} label={`${Math.round(item * 100)}%`} value={String(item)} />
            ))}
          </Picker>
        </Host>
      }
    >
      <Typography.Paragraph>{label}</Typography.Paragraph>
    </SettingsRow>
  );
}

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

function ZoomRow({ dark }: { dark: boolean }) {
  const { t } = useText();
  const [zoom] = useState(() => DisplayZoom?.getZoom() ?? 1);
  const scales = DisplayZoom;
  if (!scales) return null;
  return (
    <ScaleRow
      dark={dark}
      label={t("mobile.settings.appearance.zoom")}
      value={zoom}
      values={scales.zooms}
      onChange={(next) => scales.setZoom(next)}
    />
  );
}

function LanguageSection({ dark }: { dark: boolean }) {
  const { t } = useText();
  const language = useAppLanguage();
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsSection title={t("mobile.settings.language.title")} footer={error ?? t("mobile.settings.language.footer")}>
      <SettingsRow
        trailing={
          <Host matchContents colorScheme={dark ? "dark" : "light"}>
            <Picker
              selectedValue={language.value}
              enabled={language.ready && !language.saving}
              onValueChange={(next) => {
                setError(null);
                void haptics.selection();
                void saveAppLanguage(next).catch(() => {
                  setError(t("mobile.settings.saveFailed"));
                  void haptics.notification("error");
                });
              }}
            >
              {APP_LANGUAGE_OPTIONS.map((option) => (
                <Picker.Item
                  key={option.id}
                  label={option.id === "system" ? t("mobile.settings.language.system") : option.label}
                  value={option.id}
                />
              ))}
            </Picker>
          </Host>
        }
      >
        <Typography.Paragraph>{t("mobile.settings.language.row")}</Typography.Paragraph>
      </SettingsRow>
    </SettingsSection>
  );
}

function DictationSection({ dark }: { dark: boolean }) {
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
      <SettingsRow
        trailing={
          <Host matchContents colorScheme={dark ? "dark" : "light"}>
            <Picker
              selectedValue={language.value}
              enabled={language.ready && !language.saving}
              onValueChange={(next) => {
                setError(null);
                void haptics.selection();
                void saveDictationLanguage(next).catch(() => {
                  setError(t("mobile.settings.saveFailed"));
                  void haptics.notification("error");
                });
              }}
            >
              <Picker.Item label={t("mobile.settings.dictation.automatic")} value={AUTOMATIC_DICTATION_LANGUAGE} />
              {options.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </Host>
        }
      >
        <Typography.Paragraph>{t("mobile.settings.dictation.language")}</Typography.Paragraph>
      </SettingsRow>
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
        <SettingsRow
          trailing={
            <Host matchContents colorScheme={theme === "dark" ? "dark" : "light"}>
              <Picker
                selectedValue={value}
                enabled={ready && !saving}
                onValueChange={(next) => {
                  setError(null);
                  void haptics.selection();
                  void saveAppearance(next).catch(() => {
                    setError(t("mobile.settings.appearance.saveFailed"));
                    void haptics.notification("error");
                  });
                }}
              >
                <Picker.Item label={t("mobile.settings.appearance.system")} value="system" />
                <Picker.Item label={t("mobile.settings.appearance.light")} value="light" />
                <Picker.Item label={t("mobile.settings.appearance.dark")} value="dark" />
                <Picker.Item label={t("mobile.settings.appearance.eink")} value="eink" />
              </Picker>
            </Host>
          }
        >
          <Typography.Paragraph>{t("mobile.settings.appearance.theme")}</Typography.Paragraph>
        </SettingsRow>
        <FontSizeRow dark={theme === "dark"} />
        <ZoomRow dark={theme === "dark"} />
      </SettingsSection>
      <LanguageSection dark={theme === "dark"} />
      <DictationSection dark={theme === "dark"} />
      <SettingsSection
        title={t("mobile.settings.feedback.title")}
        footer={hapticsError ?? t("mobile.settings.feedback.footer")}
      >
        <SettingsRow>
          <Host
            matchContents={{ vertical: true }}
            style={{ width: "100%" }}
            colorScheme={theme === "dark" ? "dark" : "light"}
          >
            <Switch
              value={hapticsPreference.enabled}
              disabled={!hapticsPreference.ready || hapticsPreference.saving}
              label={t("mobile.settings.feedback.haptics")}
              onValueChange={saveHaptics}
            />
          </Host>
        </SettingsRow>
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
        <SettingsRow>
          <Host
            matchContents={{ vertical: true }}
            style={{ width: "100%" }}
            colorScheme={theme === "dark" ? "dark" : "light"}
          >
            <Switch
              value={analytics.enabled}
              disabled={!analytics.ready || analytics.saving}
              label={t("mobile.settings.privacy.analytics")}
              onValueChange={saveAnalytics}
            />
          </Host>
        </SettingsRow>
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
