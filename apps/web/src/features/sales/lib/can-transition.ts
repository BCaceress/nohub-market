/**
 * canTransition — máquina de estados única para Order (RN-V02).
 * Toda mudança de status passa aqui. Cada canal mapeia seus estados externos
 * para esses estados internos — o core nunca conhece estados do iFood.
 */

import type { OrderStatus, OrderChannel } from "@nohub/db";

// Transições válidas por canal
// null = qualquer canal
type Transition = {
  from: OrderStatus[];
  to: OrderStatus;
  channels: OrderChannel[] | null; // null = todos os canais
};

const TRANSITIONS: Transition[] = [
  // DRAFT → CONFIRMED: qualquer canal pode confirmar
  {
    from: ["DRAFT"],
    to: "CONFIRMED",
    channels: null,
  },
  // CONFIRMED → PAID: pagamento confirmado
  {
    from: ["CONFIRMED"],
    to: "PAID",
    channels: null,
  },
  // CONFIRMED → FULFILLED: separado sem pagamento prévio (ex: faturamento)
  {
    from: ["CONFIRMED"],
    to: "FULFILLED",
    channels: ["POS", "SELF_SERVICE"],
  },
  // PAID → FULFILLED: separado/expedido
  {
    from: ["PAID"],
    to: "FULFILLED",
    channels: null,
  },
  // FULFILLED → COMPLETED: entregue
  {
    from: ["FULFILLED"],
    to: "COMPLETED",
    channels: null,
  },
  // CONFIRMED/PAID → COMPLETED: atalho para PDV (pago e entregue na hora)
  {
    from: ["CONFIRMED", "PAID"],
    to: "COMPLETED",
    channels: ["POS", "SELF_SERVICE"],
  },
  // CANCELED: de qualquer não-terminal
  {
    from: ["DRAFT", "CONFIRMED", "PAID", "FULFILLED"],
    to: "CANCELED",
    channels: null,
  },
];

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  channel: OrderChannel,
): boolean {
  return TRANSITIONS.some(
    (t) =>
      t.to === to &&
      t.from.includes(from) &&
      (t.channels === null || t.channels.includes(channel)),
  );
}

// Mapeamento de estados externos → interno por canal
// iFood
export const IFOOD_STATUS_MAP: Record<string, OrderStatus> = {
  PLACED:           "CONFIRMED",
  CONFIRMED:        "CONFIRMED",
  READY_TO_PICKUP:  "FULFILLED",
  DISPATCHED:       "FULFILLED",
  CONCLUDED:        "COMPLETED",
  CANCELLED:        "CANCELED",
  CANCELLATION_REQUESTED: "CANCELED",
};

// Mercado Livre
export const ML_STATUS_MAP: Record<string, OrderStatus> = {
  confirmed:  "CONFIRMED",
  payment_required: "DRAFT",
  payment_in_process: "DRAFT",
  paid:       "PAID",
  partially_refunded: "PAID",
  pending_cancel: "CANCELED",
  cancelled:  "CANCELED",
  invalid:    "CANCELED",
};

export const TERMINAL_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELED"];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
