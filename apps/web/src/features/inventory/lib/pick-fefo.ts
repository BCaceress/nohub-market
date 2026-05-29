/**
 * pickFEFO — First Expire, First Out
 * Para saídas de perecíveis, escolhe de quais lotes tirar o estoque
 * consumindo primeiro o que vence antes. (RN-E06)
 *
 * Se não há lotes (capability desligada), retorna lotId: null para o total.
 */

import { prisma } from "@nohub/db";

export type PickFEFOInput = {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number;
};

export type LotAllocation = {
  lotId: string | null;
  quantity: number;
};

export type PickFEFOResult =
  | { success: true; allocations: LotAllocation[] }
  | { success: false; error: "INSUFFICIENT_STOCK"; available: number };

export async function pickFEFO(input: PickFEFOInput): Promise<PickFEFOResult> {
  // Verificar se há lotes para este produto/variante/local
  const balancesWithLot = await prisma.stockBalance.findMany({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      locationId: input.locationId,
      lotId: { not: null },
      quantityOnHand: { gt: 0 },
    },
    include: {
      lot: { select: { id: true, expiryDate: true, isActive: true } },
    },
    orderBy: [
      // FEFO: primeiro vence, primeiro sai
      { lot: { expiryDate: "asc" } },
    ],
  });

  // Sem lotes — retorna alocação simples sem lotId
  if (balancesWithLot.length === 0) {
    const noLotBalance = await prisma.stockBalance.findFirst({
      where: {
        organizationId: input.organizationId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        locationId: input.locationId,
        lotId: null,
      },
    });

    const available = Math.max(
      0,
      Number(noLotBalance?.quantityOnHand ?? 0) - Number(noLotBalance?.quantityReserved ?? 0),
    );

    if (available < input.quantity) {
      return { success: false, error: "INSUFFICIENT_STOCK", available };
    }

    return { success: true, allocations: [{ lotId: null, quantity: input.quantity }] };
  }

  // Com lotes — aloca FEFO
  let remaining = input.quantity;
  const allocations: LotAllocation[] = [];

  for (const bal of balancesWithLot) {
    if (remaining <= 0) break;
    if (!bal.lot?.isActive) continue;

    const available = Math.max(0, Number(bal.quantityOnHand) - Number(bal.quantityReserved));
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    allocations.push({ lotId: bal.lotId, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    const totalAvailable = input.quantity - remaining;
    return { success: false, error: "INSUFFICIENT_STOCK", available: totalAvailable };
  }

  return { success: true, allocations };
}
