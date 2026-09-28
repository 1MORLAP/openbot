import { create } from "zustand";

/**
 * Text that another screen puts into one agent's composer, such as the skill-creation request from
 * Agent info > Skills. The chat of that agent takes it once, when it is mounted and matches.
 */
export interface ComposerRequest {
  serverId: string;
  agentId: string;
  text: string;
}

export const useComposerRequest = create<{ request: ComposerRequest | null }>(() => ({ request: null }));

export function requestComposerText(request: ComposerRequest): void {
  useComposerRequest.setState({ request });
}

/** Removes and returns the request for this agent, or null when it is for another chat. */
export function takeComposerRequest(serverId: string, agentId: string): string | null {
  const { request } = useComposerRequest.getState();
  if (!request || request.serverId !== serverId || request.agentId !== agentId) return null;
  useComposerRequest.setState({ request: null });
  return request.text;
}
