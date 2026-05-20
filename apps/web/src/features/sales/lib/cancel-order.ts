/**
 * cancelOrder — transição para CANCELED.
 * Estorna reservas e movimentos (Etapa 3) — (RN-V16).
 * Pedido cancelado nunca é deletado: estado CANCELED + motivo + estorno.
 */

import { prisma } from "@nohub/db";
import type { OrderStatus } from "@nohub/db";
import { writeAudit } from "@/lib/audit";
import { releaseReservation } from "@/features/inventory/lib/reserve-stock";
import { applyMovement } from "@/features/inventory/lib/apply-movement";
import { canTransition, isTerminal } from "./can-transition";

export type CancelOrderInput = {
  organizationId: string;
  orderId:        string;
  reason:         string;
  actorId:        string;
  actorName?:     string | null;
  source?:        string;
};

export type CancelOrderResult =
  | { success: true;  orderId: string }
  | { success: false; error: string; code?: string };

export async function cancelOrder(
  input: CancelOrderInput,
): Promise<CancelOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });

  if (!order || order.organizationId !== input.organizationId) {
    return { success: false, error: "Pedido não encontrado" };
  }

  if (isTerminal(order.status)) {
    return {
      success: false,
      error: `Pedido já ${order.status === "COMPLETED" ? "concluído" : "cancelado"} — não pode ser cancelado`,
      code:  "ALREADY_TERMINAL",
    };
  }

  if (!canTransition(order.status, "CANCELED", order.channel)) {
    return {
      success: false,
      error: `Transição inválida: ${order.status} → CANCELED`,
      code:  "INVALID_TRANSITION",
    };
  }

  // Liberar reservas ativas (CONFIRMED)
  if (order.status === "CONFIRMED" || order.status === "PAID") {
    const reservations = await prisma.stockReservation.findMany({
      where: {
        organizationId: input.organizationId,
        referenceType:  "ORDER",
        referenceId:    order.id,
        status:         "ACTIVE",
      },
    });

    for (const reservation of reservations) {
      await releaseReservation(
        reservation.id,
        input.actorId,
        input.actorName ?? undefined,
      ).catch(() => {});
    }
  }

  // Se FULFILLED: estorno dos movimentos OUTBOUND gerados
  if (order.status === "FULFILLED") {
    const outboundMovements = await prisma.stockMovement.findMany({
      where: {
        organizationId: input.organizationId,
        referenceType:  "ORDER",
        referenceId:    order.id,
        type:           { in: ["OUTBOUND", "OUT"] },
      },
    });

    for (const mv of outboundMovements) {
      await applyMovement({
        organizationId: input.organizationId,
        locationId:     mv.locationId,
        productId:      mv.productId,
        variantId:      mv.variantId,
        lotId:          mv.lotId,
        type:           "INBOUND",
        quantity:       Number(mv.quantity),
        reason:         "RETURN",
        referenceType:  "ORDER_CANCEL",
        referenceId:    order.id,
        note:           `Estorno por cancelamento do pedido ${order.id}`,
        actorId:        input.actorId,
        actorName:      input.actorName,
      }).catch(() => {});
    }
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status:        "CANCELED",
        canceledReason: input.reason,
        canceledAt:    new Date(),
        updatedAt:     new Date(),
      },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId:    order.id,
        fromStatus: order.status as OrderStatus,
        toStatus:   "CANCELED",
        actorId:    input.actorId,
        source:     input.source ?? "INTERNAL",
        reason:     input.reason,
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId:        input.actorId,
    action:         "order.canceled",
    resourceType:   "Order",
    resourceId:     order.id,
    after: { status: "CANCELED", reason: input.reason },
  });

  return { success: true, orderId: order.id };
}
