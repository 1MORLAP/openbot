import { Stack } from "expo-router";
import { SheetActionBar, useRegisterSheetAction } from "@/shared/components/sheet-action-bar";
import { haptics } from "@/shared/lib/haptics";
import { isAndroid, isIOS } from "@/shared/lib/platform";
import { useText } from "@/shared/lib/text";

export function SheetSaveAction({
  dirty,
  canSave,
  pending,
  label: labelProp,
  pendingLabel: pendingLabelProp,
  onSave,
}: {
  dirty: boolean;
  canSave: boolean;
  pending: boolean;
  label?: string;
  pendingLabel?: string;
  onSave: () => void;
}) {
  const { t } = useText();
  const label = labelProp ?? t("mobile.shared.save.changes");
  const pendingLabel = pendingLabelProp ?? t("common.saving");
  const action = { dirty, canSave, pending, label, pendingLabel, onSave };
  // Android draws no header buttons on a form sheet: the sheet shows the bar, or the form does.
  const inSheet = useRegisterSheetAction(action, isAndroid);
  if (isAndroid) return inSheet ? null : <SheetActionBar action={action} topInset />;
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        hidden={!dirty && !pending}
        disabled={!dirty || !canSave || pending}
        icon={isIOS ? "checkmark" : undefined}
        accessibilityLabel={pending ? pendingLabel : label}
        onPress={() => {
          if (!dirty || !canSave || pending) return;
          void haptics.impact("light");
          onSave();
        }}
      >
        {isIOS ? label : "✓"}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
