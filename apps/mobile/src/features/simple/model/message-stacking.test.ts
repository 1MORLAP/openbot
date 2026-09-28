import type { AttachmentSummary } from "@openbot/contracts/ipc";
import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/features/chat/model/chat-messages";
import { joinsBubbles } from "./message-stacking";

const attachment: AttachmentSummary = {
  id: "attachment-1",
  name: "photo.png",
  size: 1024,
  kind: "file",
  mimeType: "image/png",
  previewKind: "none",
  previewUrl: null,
};

function message(
  author: "agent" | "user",
  body: string,
  extra: { failureReason?: string; attachments?: AttachmentSummary[] } = {},
): ChatMessage {
  return { id: `${author}:${body}`, kind: "message", author, body, streaming: false, ...extra };
}

describe("joinsBubbles", () => {
  it("joins two user messages in a row", () => {
    expect(joinsBubbles(message("user", "one"), message("user", "two"))).toBe(true);
  });

  it("never joins across speakers or with nothing", () => {
    expect(joinsBubbles(message("user", "one"), message("agent", "two"))).toBe(false);
    expect(joinsBubbles(message("agent", "one"), message("user", "two"))).toBe(false);
    expect(joinsBubbles(undefined, message("user", "two"))).toBe(false);
    expect(joinsBubbles(message("user", "one"), undefined)).toBe(false);
  });

  it("does not join a message that has no bubble", () => {
    expect(joinsBubbles(message("user", "  "), message("user", "two"))).toBe(false);
    expect(joinsBubbles(message("user", "one"), message("user", ""))).toBe(false);
  });

  it("breaks the stack at attachments above the lower bubble and a failure below the upper one", () => {
    expect(joinsBubbles(message("user", "one"), message("user", "two", { attachments: [attachment] }))).toBe(false);
    expect(joinsBubbles(message("user", "one", { failureReason: "failed" }), message("user", "two"))).toBe(false);
  });

  it("ignores other kinds of rows", () => {
    const plan: ChatMessage = { id: "p", kind: "plan", heading: null, explanation: null, stopped: false, steps: [] };
    expect(joinsBubbles(plan, message("user", "two"))).toBe(false);
  });
});
