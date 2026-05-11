/**
 * نقطة موحَّدة لإرسال إشعارات «النصوص المحظورة من الإرسال للذكاء الاصطناعي»
 * إلى الواجهة. يستخدمها كلّ موقع يستقبل ردّ `translate-entries`.
 */

export interface BlockedAIEntry {
  key: string;
  original: string;
  reason: string;
}

export const AI_BLOCKED_EVENT = "ai-blocked-entries";

export function notifyBlockedAI(blocked: BlockedAIEntry[] | undefined): void {
  if (!blocked || blocked.length === 0) return;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BlockedAIEntry[]>(AI_BLOCKED_EVENT, { detail: blocked }));
}
