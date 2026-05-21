/**
 * canTransitionPO — máquina de estados única do PurchaseOrder (RN-P01).
 * Espelha canTransition da Etapa 4 e canTransitionInvoice da Etapa 5.
 */

import type { PurchaseOrderStatus } from "@nohub/db";

type Transition = {
  from: PurchaseOrderStatus[];
  to: PurchaseOrderStatus;
};

const TRANSITIONS: Transition[] = [
  // Criado → enviado ao fornecedor
  { from: ["DRAFT"], to: "SENT" },
  // Fornecedor confirmou
  { from: ["SENT"], to: "CONFIRMED" },
  // Primeiro recebimento parcial
  { from: ["CONFIRMED"], to: "RECEIVING" },
  // Recebimento adicional
  { from: ["RECEIVING"], to: "RECEIVING" },
  // Recebido tudo
  { from: ["CONFIRMED", "RECEIVING"], to: "RECEIVED" },
  // Cancelamento de qualquer não-terminal
  { from: ["DRAFT", "SENT", "CONFIRMED"], to: "CANCELED" },
];

export function canTransitionPO(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  return TRANSITIONS.some((t) => t.to === to && t.from.includes(from));
}

export function isTerminalPO(status: PurchaseOrderStatus): boolean {
  return status === "RECEIVED" || status === "CANCELED";
}

export function isCancelablePO(status: PurchaseOrderStatus): boolean {
  return canTransitionPO(status, "CANCELED");
}
