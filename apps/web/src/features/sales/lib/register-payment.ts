/**
 * registerPayment — registra um pagamento e avança o pedido para PAID quando quitado.
 * Suporta split (múltiplos métodos de pagamento por pedido).
 * RN-V11: MarketOS é integrador, não sub-adquirente.
 * RN-V12: cartão nunca trafega/armazena no MarketOS.
 */

import type { PaymentMethod } from "@nohub/db";
import { prisma } from "@nohub/db";
import { enqueueIssuance } from "@/features/fiscal/lib/enqueue-issuance";
import { writeAudit } from "@/lib/audit";
import { canTransition } from "./can-transition";

export type RegisterPaymentInput = {
  organizationId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  receivedAmount?: number; // para CASH — valor recebido
  provider?: string; // adquirente
  externalPaymentId?: string; // id na adquirente
  actorId: string;
  actorName?: string | null;
};

export type RegisterPaymentResult =
  | { success: true; paymentId: string; changeAmount: number; orderStatus: string }
  | { success: false; error: string; code?: string };

export async function registerPayment(input: RegisterPaymentInput): Promise<RegisterPaymentResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      payments: { where: { status: "CONFIRMED" } },
    },
  });

  if (!order || order.organizationId !== input.organizationId) {
    return { success: false, error: "Pedido não encontrado" };
  }

  if (order.status === "CANCELED" || order.status === "COMPLETED") {
    return {
      success: false,
      error: "Pedido já encerrado — não aceita pagamento",
      code: "ORDER_CLOSED",
    };
  }

  // Calcular troco (CASH)
  const received = input.receivedAmount ?? input.amount;
  const change = input.method === "CASH" ? Math.max(0, received - input.amount) : 0;

  // Registrar pagamento
  const payment = await prisma.payment.create({
    data: {
      orderId: input.orderId,
      method: input.method,
      provider: input.provider ?? null,
      amount: input.amount,
      receivedAmount: received,
      changeAmount: change,
      status: "CONFIRMED",
      externalPaymentId: input.externalPaymentId ?? null,
      confirmedAt: new Date(),
    },
  });

  // Calcular total pago
  const previouslyPaid = order.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = previouslyPaid + input.amount;
  const orderTotal = Number(order.total);

  // Avançar para PAID se total quitado
  let newStatus = order.status;
  if (totalPaid >= orderTotal && canTransition(order.status, "PAID", order.channel)) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID", updatedAt: new Date() },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "PAID",
          actorId: input.actorId,
          source: "PAYMENT",
        },
      }),
    ]);
    newStatus = "PAID";

    // RN-F05: após ORDER_PAID, enfileirar emissão fiscal (se habilitada)
    await enqueueIssuance(input.organizationId, order.id, input.actorId).catch(() => {
      // enqueueIssuance falha silenciosamente se fiscal não configurado
    });
  }

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "payment.registered",
    resourceType: "Payment",
    resourceId: payment.id,
    after: {
      orderId: order.id,
      method: input.method,
      amount: input.amount,
      change,
      orderStatus: newStatus,
    },
  });

  return {
    success: true,
    paymentId: payment.id,
    changeAmount: change,
    orderStatus: newStatus,
  };
}
