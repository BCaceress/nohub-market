/**
 * rebuildBalance — reconstrói StockBalance somando todos os StockMovement.
 * Prova que saldo é projeção dos movimentos (RN-E03).
 * Usado para auditoria, correção de divergências e testes de invariante.
 *
 * Invariante: rebuildBalance() == soma incremental dos movimentos.
 * Se quebrar, o módulo está errado.
 */

import { prisma } from "@nohub/db";
import type { MovementType } from "@nohub/db";

export type RebuildInput = {
  organizationId: string;
  productId:      string;
  variantId?:     string | null;
  locationId:     string;
  lotId?:         string | null;
};

export type RebuildResult = {
  onHand:      number;
  reserved:    number;
  available:   number;
  averageCost: number | null;
  movementCount: number;
};

const OUTBOUND_TYPES = new Set<MovementType>(["OUT", "OUTBOUND", "LOSS", "TRANSFER_OUT"]);
const INBOUND_TYPES  = new Set<MovementType>(["IN",  "INBOUND",  "TRANSFER_IN"]);

export async function rebuildBalance(input: RebuildInput): Promise<RebuildResult> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId: input.organizationId,
      productId:      input.productId,
      variantId:      input.variantId ?? null,
      locationId:     input.locationId,
      lotId:          input.lotId ?? null,
    },
    orderBy: { createdAt: "asc" },
    select: {
      type:     true,
      quantity: true,
      unitCost: true,
    },
  });

  let onHand   = 0;
  let reserved = 0;
  let avgCost  = 0;

  for (const mv of movements) {
    const qty = Number(mv.quantity);

    if (INBOUND_TYPES.has(mv.type)) {
      if (mv.unitCost !== null && mv.unitCost !== undefined) {
        const cost = Number(mv.unitCost);
        const totalValue = avgCost * onHand + cost * qty;
        onHand += qty;
        avgCost = onHand > 0 ? totalValue / onHand : cost;
      } else {
        onHand += qty;
      }
    } else if (OUTBOUND_TYPES.has(mv.type)) {
      onHand = Math.max(0, onHand - qty);
    } else if (mv.type === "ADJUSTMENT") {
      // qty é o novo saldo absoluto
      if (mv.unitCost !== null && mv.unitCost !== undefined && qty > onHand) {
        const diff = qty - onHand;
        const cost = Number(mv.unitCost);
        const totalValue = avgCost * onHand + cost * diff;
        onHand = qty;
        avgCost = onHand > 0 ? totalValue / onHand : cost;
      } else {
        onHand = qty;
      }
    } else if (mv.type === "RESERVATION") {
      reserved += qty;
    } else if (mv.type === "RESERVATION_RELEASE") {
      reserved = Math.max(0, reserved - qty);
    }
  }

  // Persistir o saldo reconstruído
  const balanceKey = {
    organizationId: input.organizationId,
    productId:      input.productId,
    variantId:      input.variantId ?? null,
    locationId:     input.locationId,
    lotId:          input.lotId ?? null,
  };

  await prisma.stockBalance.upsert({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { organizationId_productId_variantId_locationId_lotId: balanceKey as any },
    create: {
      ...balanceKey,
      quantityOnHand:   onHand,
      quantityReserved: reserved,
      averageCost:      avgCost > 0 ? avgCost : null,
    },
    update: {
      quantityOnHand:   onHand,
      quantityReserved: reserved,
      averageCost:      avgCost > 0 ? avgCost : null,
      updatedAt:        new Date(),
    },
  });

  return {
    onHand,
    reserved,
    available:    Math.max(0, onHand - reserved),
    averageCost:  avgCost > 0 ? avgCost : null,
    movementCount: movements.length,
  };
}
