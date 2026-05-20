/**
 * fulfillOrder — transição CONFIRMED/PAID → FULFILLED.
 * Converte reservas em OUTBOUND (consumeReservation — Etapa 3).
 * Kits: explodeKitForSale ao invés de consumeReservation (RN-V10).
 */

import { prisma } from "@nohub/db";
import type { OrderStatus } from "@nohub/db";
import { writeAudit } from "@/lib/audit";
import {
  consumeReservation,
} from "@/features/inventory/lib/reserve-stock";
import { explodeKitForSale } from "@/features/inventory/lib/explode-kit-for-sale";
import { canTransition } from "./can-transition";

export type FulfillOrderInput = {
  organizationId: string;
  orderId:        string;
  actorId:        string;
  actorName?:     string | null;
  source?:        string;
};

export type FulfillOrderResult =
  | { success: true;  orderId: string }
  | { success: false; error: string; code?: string };

export async function fulfillOrder(
  input: FulfillOrderInput,
): Promise<FulfillOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });

  if (!order || order.organizationId !== input.organizationId) {
    return { success: false, error: "Pedido não encontrado" };
  }

  if (!canTransition(order.status, "FULFILLED", order.channel)) {
    return {
      success: false,
      error: `Transição inválida: ${order.status} → FULFILLED`,
      code:  "INVALID_TRANSITION",
    };
  }

  // Consumir reservas e dar baixa no estoque
  for (const item of order.items) {
    if (!item.productId) continue;

    if (item.isKit) {
      // Kit: explode componentes (RN-V10)
      const kitResult = await explodeKitForSale({
        organizationId: input.organizationId,
        locationId:     order.locationId,
        kitProductId:   item.productId,
        saleQuantity:   Number(item.quantity),
        actorId:        input.actorId,
        actorName:      input.actorName,
        referenceType:  "ORDER",
        referenceId:    order.id,
      });

      if (!kitResult.success) {
        return { success: false, error: kitResult.error, code: "KIT_EXPLODE_FAILED" };
      }
    } else {
      // Produto simples: consumir reservas ativas para este pedido
      const reservations = await prisma.stockReservation.findMany({
        where: {
          organizationId: input.organizationId,
          productId:      item.productId,
          variantId:      item.variantId,
          referenceType:  "ORDER",
          referenceId:    order.id,
          status:         "ACTIVE",
        },
      });

      for (const reservation of reservations) {
        const result = await consumeReservation(
          reservation.id,
          input.actorId,
          input.actorName ?? undefined,
        );
        if (!result.success) {
          return {
            success: false,
            error:   result.error ?? "Erro ao consumir reserva",
            code:    "CONSUME_FAILED",
          };
        }
      }
    }
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "FULFILLED", updatedAt: new Date() },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId:    order.id,
        fromStatus: order.status as OrderStatus,
        toStatus:   "FULFILLED",
        actorId:    input.actorId,
        source:     input.source ?? "INTERNAL",
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId:        input.actorId,
    action:         "order.fulfilled",
    resourceType:   "Order",
    resourceId:     order.id,
    after: { status: "FULFILLED" },
  });

  return { success: true, orderId: order.id };
}
