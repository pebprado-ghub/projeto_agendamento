/** Detecta respostas afirmativas ao pedido de reagendamento (português / inglês curto). */
export function isAffirmativeRescheduleReply(text: string): boolean {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw) return false;
  const plain = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const first = plain.split(/[\s,.;:!?]+/)[0] || "";
  return ["sim", "s", "si", "ok", "confirmo", "aceito", "yes"].includes(first);
}

export const CLOSURE_RESCHEDULE_CONVERSATION_STATE = "awaiting_closure_reschedule_confirm";

export type ClosureRescheduleContext = {
  kind: "closure_reschedule";
  appointmentId: string;
  suggestedStartsAt: string;
  suggestedEndsAt: string;
  previousStartsAt: string;
  previousEndsAt: string;
};
