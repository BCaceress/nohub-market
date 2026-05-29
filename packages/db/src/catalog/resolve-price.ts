import type { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../index";

export interface ResolvedPrice {
  price: Decimal;
  effectivePrice: Decimal; // promoPrice if active, otherwise price
  promoPrice: Decimal | null;
  cost: Decimal | null;
  isPromo: boolean;
  source:
    | "variant+location+channel"
    | "variant+location"
    | "variant+channel"
    | "variant"
    | "product+location+channel"
    | "product+location"
    | "product+channel"
    | "product";
}

export type PriceResult =
  | { success: true; data: ResolvedPrice }
  | { success: false; error: "NO_PRICE_CONFIGURED" };

export interface ResolvePriceInput {
  productId: string;
  variantId?: string | null;
  locationId?: string | null;
  channel?: string | null;
}

function isPromoActive(validFrom: Date | null, validTo: Date | null): boolean {
  const now = new Date();
  if (validFrom && now < validFrom) return false;
  if (validTo && now > validTo) return false;
  return true;
}

function toResolved(
  row: {
    price: Decimal;
    promoPrice: Decimal | null;
    cost: Decimal | null;
    validFrom: Date | null;
    validTo: Date | null;
  },
  source: ResolvedPrice["source"],
): ResolvedPrice {
  const promoActive = row.promoPrice !== null && isPromoActive(row.validFrom, row.validTo);
  return {
    price: row.price,
    effectivePrice: promoActive ? row.promoPrice! : row.price,
    promoPrice: row.promoPrice,
    cost: row.cost,
    isPromo: promoActive,
    source,
  };
}

/**
 * Resolve o preço em cascata (RN-C08):
 * 1. variant + location + channel
 * 2. variant + location
 * 3. variant + channel
 * 4. variant (base)
 * 5. product + location + channel
 * 6. product + location
 * 7. product + channel
 * 8. product (base)
 */
export async function resolvePrice(input: ResolvePriceInput): Promise<PriceResult> {
  const { productId, variantId, locationId, channel } = input;

  // Fetch all price rows for this product in one query, then filter in memory
  const rows = await prisma.productPrice.findMany({
    where: {
      productId,
      ...(variantId ? { OR: [{ variantId }, { variantId: null }] } : { variantId: null }),
    },
    select: {
      variantId: true,
      locationId: true,
      channel: true,
      price: true,
      promoPrice: true,
      cost: true,
      validFrom: true,
      validTo: true,
    },
  });

  if (rows.length === 0) return { success: false, error: "NO_PRICE_CONFIGURED" };

  // Helper — find row matching all specified dimensions
  function find(
    vId: string | null | undefined,
    lId: string | null | undefined,
    ch: string | null | undefined,
  ) {
    return rows.find(
      (r) =>
        (vId === undefined ? true : r.variantId === vId) &&
        (lId === undefined ? true : r.locationId === lId) &&
        (ch === undefined ? true : r.channel === ch),
    );
  }

  // Cascade
  if (variantId) {
    const r1 = locationId && channel ? find(variantId, locationId, channel) : undefined;
    if (r1) return { success: true, data: toResolved(r1, "variant+location+channel") };

    const r2 = locationId ? find(variantId, locationId, null) : undefined;
    if (r2) return { success: true, data: toResolved(r2, "variant+location") };

    const r3 = channel ? find(variantId, null, channel) : undefined;
    if (r3) return { success: true, data: toResolved(r3, "variant+channel") };

    const r4 = find(variantId, null, null);
    if (r4) return { success: true, data: toResolved(r4, "variant") };
  }

  const r5 = locationId && channel ? find(null, locationId, channel) : undefined;
  if (r5) return { success: true, data: toResolved(r5, "product+location+channel") };

  const r6 = locationId ? find(null, locationId, null) : undefined;
  if (r6) return { success: true, data: toResolved(r6, "product+location") };

  const r7 = channel ? find(null, null, channel) : undefined;
  if (r7) return { success: true, data: toResolved(r7, "product+channel") };

  const r8 = find(null, null, null);
  if (r8) return { success: true, data: toResolved(r8, "product") };

  return { success: false, error: "NO_PRICE_CONFIGURED" };
}
