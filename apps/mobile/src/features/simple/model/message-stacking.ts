import type { ChatMessage } from "@/features/chat/model/chat-messages";

/**
 * Two user messages in a row stack into one shape. Attachments above a bubble and a failure line
 * below it break the stack, and both bubbles have to agree, so the rule lives here once.
 */
export function joinsBubbles(older: ChatMessage | undefined, newer: ChatMessage | undefined): boolean {
  return (
    older?.kind === "message" &&
    newer?.kind === "message" &&
    older.author === "user" &&
    newer.author === "user" &&
    Boolean(older.body.trim()) &&
    Boolean(newer.body.trim()) &&
    !older.failureReason &&
    !newer.attachments?.length
  );
}
