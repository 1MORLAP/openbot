import { requireOptionalNativeModule } from "expo-modules-core";

interface VoiceInputModule {
  isAvailable(): boolean;
  /** Opens the system voice input dialog. Null when the user closes it. */
  recognize(language: string | null, prompt: string | null): Promise<string | null>;
}

/** Android only. Null on iOS and in tests. */
export const VoiceInput = requireOptionalNativeModule<VoiceInputModule>("VoiceInput");
