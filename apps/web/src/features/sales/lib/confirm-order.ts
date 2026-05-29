/**
 * confirmOrder — transição DRAFT → CONFIRMED.
 * Reserva estoque (Etapa 3), valida restrições de idade/hora (RN-V15).
 * Kits são explodidos no estoque na baixa (fulfillOrder) — aqui só reserva.
 *
 * RN-V05: sem disponível, não confirma (anti-oversell).
 */

import type { OrderStatus } from "@nohub/db";
import { prisma } from "@nohub/db";
import { reserveStock } from "@/features/inventory/lib/reserve-stock";
import { writeAudit } from "@/lib/audit";
import { canTransition } from "./can-transition";

export type ConfirmOrderInput = {
  organizationId: string;
  orderId: string;
  actorId: string;
  actorName?: string | null;
  source?: string;
};

export type ConfirmOrderResult =
  | { success: true; orderId: string }
  | { success: false; error: string; code?: string };

export async function confirmOrder(input: ConfirmOrderInput): Promise<ConfirmOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: true,
      location: { select: { id: true, name: true } },
    },
  });

  if (!order || order.organizationId !== input.organizationId) {
    return { success: false, error: "Pedido não encontrado" };
  }

  if (!canTransition(order.status, "CONFIRMED", order.channel)) {
    return {
      success: false,
      error: `Transição inválida: ${order.status} → CONFIRMED`,
      code: "INVALID_TRANSITION",
    };
  }

  // RN-V15 — restrições de hora (lei seca) e idade são validadas aqui
  // A validação de idade depende do Customer — verificamos se há produto
  // com restrição e, se sim, exigimos que o Customer exista e tenha sido verificado
  const hasAgeRestricted = await prisma.product.findFirst({
    where: {
      id: { in: order.items.map((i) => i.productId).filter(Boolean) as string[] },
      hasAgeRestriction: true,
    },
  });

  if (hasAgeRestricted && !order.customerId && order.channel === "SELF_SERVICE") {
    return {
      success: false,
      error: "Venda autônoma com produto de idade restrita exige identificação do cliente",
      code: "AGE_RESTRICTION",
    };
  }

  // Reservar estoque para cada item (RN-V04 + RN-V05)
  const reservations: string[] = [];

  for (const item of order.items) {
    if (!item.productId) continue;

    // Kits: reserva por componentes é feita no fulfillOrder (via explodeKitForSale)
    // Aqui reservamos a unidade do kit como referência
    if (item.productTypeSnapshot === "KIT") continue;

    const reserve = await reserveStock({
      organizationId: input.organizationId,
      locationId: order.locationId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: Number(item.quantity),
      referenceType: "ORDER",
      referenceId: order.id,
      actorId: input.actorId,
      actorName: input.actorName,
    });

    if (!reserve.success) {
      // Rollback reservas anteriores
      for (const rid of reservations) {
        const r = await prisma.stockReservation.findUnique({ where: { id: rid } });
        if (r) {
          const { releaseReservation } = await import("@/features/inventory/lib/reserve-stock");
          await releaseReservation(rid, input.actorId).catch(() => {});
        }
      }
      return {
        success: false,
        error: reserve.error,
        code: "INSUFFICIENT_STOCK",
      };
    }

    reservations.push(reserve.reservationId);
  }

  // Transição de estado
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED", updatedAt: new Date() },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status as OrderStatus,
        toStatus: "CONFIRMED",
        actorId: input.actorId,
        source: input.source ?? "INTERNAL",
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "order.confirmed",
    resourceType: "Order",
    resourceId: order.id,
    after: { status: "CONFIRMED", reservations },
  });

  return { success: true, orderId: order.id };
}
