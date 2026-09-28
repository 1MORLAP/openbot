import * as Device from "expo-device";

import { isAndroid } from "@/shared/lib/platform";

// Manufacturers whose Android devices ship electrophoretic panels. The list only picks the
// first-launch default; the Appearance setting always wins once the user has chosen.
const EINK_MANUFACTURERS = ["onyx", "boox", "bigme", "boyue", "likebook", "meebook", "hisense", "pocketbook", "mooink"];

export function isEinkDevice(): boolean {
  if (!isAndroid) return false;
  const names = [Device.manufacturer, Device.brand, Device.modelName].map((value) => value?.toLowerCase() ?? "");
  return names.some((name) => EINK_MANUFACTURERS.some((maker) => name.includes(maker)));
}
