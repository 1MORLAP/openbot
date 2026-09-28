import * as SecureStore from "expo-secure-store";
import { useMemo } from "react";
import { z } from "zod";
import { create } from "zustand";

/** Sections the person folded away in the chat list, per server. Kept for the next start. */
const key = "openbot.mobile.collapsed-sections.v1";

const useCollapsed = create<{ byServer: Record<string, string[]> }>(() => ({ byServer: {} }));

const stored = z.record(z.string(), z.array(z.string()));

function parse(raw: string | null): Record<string, string[]> {
  if (!raw) return {};
  const result = stored.safeParse(JSON.parse(raw));
  return result.success ? result.data : {};
}

export async function loadCollapsedSections(): Promise<void> {
  try {
    useCollapsed.setState({ byServer: parse(await SecureStore.getItemAsync(key)) });
  } catch {
    // A missing or damaged value just means every section starts open.
  }
}

export function toggleSectionCollapsed(serverId: string, sectionId: string): void {
  const current = useCollapsed.getState().byServer;
  const ids = current[serverId] ?? [];
  const next = {
    ...current,
    [serverId]: ids.includes(sectionId) ? ids.filter((id) => id !== sectionId) : [...ids, sectionId],
  };
  useCollapsed.setState({ byServer: next });
  void SecureStore.setItemAsync(key, JSON.stringify(next)).catch(() => undefined);
}

export function useCollapsedSections(serverId: string): ReadonlySet<string> {
  const ids = useCollapsed((state) => state.byServer[serverId]);
  return useMemo(() => new Set(ids), [ids]);
}
