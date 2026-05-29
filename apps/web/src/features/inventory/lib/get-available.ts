/**
 * getAvailable — saldo disponível = físico - reservado
 * Agrega todos os lotes de uma combinação produto/variante/local.
 * RN-E07: disponível nunca inclui o que está reservado.
 */

import { prisma } from "@nohub/db";

export type AvailableInput = {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  locationId?: string; // se omitido, soma todos os locais
  lotId?: string | null;
};

export type AvailableResult = {
  onHand: number;
  reserved: number;
  available: number;
  averageCost: number | null;
  byLocation: Array<{
    locationId: string;
    locationName?: string;
    onHand: number;
    reserved: number;
    available: number;
  }>;
};

export async function getAvailable(input: AvailableInput): Promise<AvailableResult> {
  const rows = await prisma.stockBalance.findMany({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
      ...(input.locationId ? { locationId: input.locationId } : {}),
      ...(input.lotId !== undefined ? { lotId: input.lotId } : {}),
    },
    include: { location: { select: { id: true, name: true } } },
  });

  let totalOnHand = 0;
  let totalReserved = 0;
  let weightedCost = 0;

  const byLocation = new Map<
    string,
    { locationId: string; locationName?: string; onHand: number; reserved: number }
  >();

  for (const row of rows) {
    const oh = Number(row.quantityOnHand);
    const rv = Number(row.quantityReserved);
    totalOnHand += oh;
    totalReserved += rv;
    weightedCost += Number(row.averageCost ?? 0) * oh;

    const loc = byLocation.get(row.locationId) ?? {
      locationId: row.locationId,
      locationName: row.location.name,
      onHand: 0,
      reserved: 0,
    };
    loc.onHand += oh;
    loc.reserved += rv;
    byLocation.set(row.locationId, loc);
  }

  const averageCost = totalOnHand > 0 ? weightedCost / totalOnHand : null;

  return {
    onHand: totalOnHand,
    reserved: totalReserved,
    available: Math.max(0, totalOnHand - totalReserved),
    averageCost,
    byLocation: Array.from(byLocation.values()).map((l) => ({
      ...l,
      available: Math.max(0, l.onHand - l.reserved),
    })),
  };
}
