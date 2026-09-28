import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import { Info, SlidersHorizontal } from "lucide-react-native";
import { mobileUserName } from "@/features/auth/api/mobile-user-name";
import { useMobileSession } from "@/features/auth/context/mobile-session-context";
import { SettingsContent, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { SettingsIcon } from "@/features/settings/components/settings-controls";
import { ProfileAvatar } from "@/shared/components/profile-avatar";
import { useText } from "@/shared/lib/text";

export function SettingsScreen() {
  const { session } = useMobileSession();
  const { t } = useText();
  const displayName = session ? mobileUserName(session.user) : t("mobile.settings.home.profile");
  const foreground = String(useThemeColor("foreground"));
  return (
    <SettingsContent>
      <SettingsSection>
        <SettingsRow
          onPress={() => router.push("/settings/profile")}
          supportingText={session?.user.email}
          leading={
            <ProfileAvatar
              neutral
              name={displayName}
              imageUrl={session?.user.avatarUrl ? new URL(session.user.avatarUrl, session.apiUrl).toString() : null}
              size={48}
            />
          }
        >
          <Typography.Paragraph weight="semibold">{displayName}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title={t("mobile.settings.home.preferences")}>
        <SettingsRow
          onPress={() => router.push("/settings/general")}
          supportingText={t("mobile.settings.home.generalHint")}
          leading={
            <SettingsIcon>
              <SlidersHorizontal color={foreground} size={18} strokeWidth={2} />
            </SettingsIcon>
          }
        >
          <Typography.Paragraph>{t("mobile.settings.home.general")}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection>
        <SettingsRow
          onPress={() => router.push("/settings/about")}
          leading={
            <SettingsIcon>
              <Info color={foreground} size={18} strokeWidth={2} />
            </SettingsIcon>
          }
        >
          <Typography.Paragraph>{t("mobile.settings.home.about")}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
    </SettingsContent>
  );
}
