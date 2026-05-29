/**
 * Máquina de estados da Invoice — fonte única (RN-F04).
 *
 * Estados terminais: AUTHORIZED (pode ir para CANCELED), REJECTED (reemitível),
 * DENIED (não reemitível), CANCELED (terminal absoluto).
 */

import type { InvoiceStatus } from "@nohub/db";

type Transition = {
  from: InvoiceStatus[];
  to: InvoiceStatus;
};

const TRANSITIONS: Transition[] = [
  // Worker processando
  { from: ["PENDING"], to: "SENDING" },
  // BaaS/SEFAZ respondeu positivamente
  { from: ["SENDING"], to: "AUTHORIZED" },
  // BaaS/SEFAZ rejeitou (reemitível após correção)
  { from: ["SENDING"], to: "REJECTED" },
  // BaaS/SEFAZ denegou (não reemitível)
  { from: ["SENDING"], to: "DENIED" },
  // SEFAZ fora → contingência
  { from: ["SENDING", "PENDING"], to: "IN_CONTINGENCY" },
  // SEFAZ voltou → transmitir nota em contingência
  { from: ["IN_CONTINGENCY"], to: "SENDING" },
  // Contingência autorizada
  { from: ["IN_CONTINGENCY"], to: "AUTHORIZED" },
  // Cancelamento dentro do prazo
  { from: ["AUTHORIZED"], to: "CANCELED" },
  // Retry: de REJECTED pode tentar novamente (ex: correção de dados)
  { from: ["REJECTED"], to: "PENDING" },
];

/** Verifica se a transição from→to é válida */
export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS.some((t) => t.to === to && t.from.includes(from));
}

/** Estados em que a nota já finalizou (sem mais transições de negócio) */
export function isTerminalInvoice(status: InvoiceStatus): boolean {
  return status === "CANCELED" || status === "DENIED";
}

/** Estados em que a nota ainda pode ser reemitida */
export function isReissuable(status: InvoiceStatus): boolean {
  return status === "REJECTED";
}
