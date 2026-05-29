/**
 * buildOrderItem — cria o snapshot imutável de um item de pedido (RN-V03).
 * Usa resolvePrice (Etapa 2) e resolveTax (Etapa 2) para congelar
 * nome/preço/fiscal no momento da venda.
 *
 * O snapshot sobrevive a alterações futuras no produto — o passado não muda.
 */

import type { OrderChannel } from "@nohub/db";
import { prisma } from "@nohub/db";
import { resolvePrice, resolveTax } from "@nohub/db/catalog";

export type BuildOrderItemInput = {
  organizationId: string;
  productId: string;
  variantId?: string | null;
  locationId?: string | null;
  channel?: OrderChannel | null;
  quantity: number;
  discountAmount?: number;
};

export type OrderItemSnapshot = {
  productId: string;
  variantId: string | null;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  unitSnapshot: string | null;
  unitPriceSnapshot: number;
  costSnapshot: number | null;
  taxSnapshot: Record<string, unknown> | null;
  productTypeSnapshot: string;
  quantity: number;
  discountAmount: number;
  lineTotal: number;
  isKit: boolean;
};

export type BuildItemResult =
  | { success: true; item: OrderItemSnapshot }
  | { success: false; error: string };

// Map OrderChannel → string channel for resolvePrice
const CHANNEL_STR: Partial<Record<OrderChannel, string>> = {
  IFOOD: "IFOOD",
  WHATSAPP: "WHATSAPP",
  MERCADO_LIVRE: "MERCADO_LIVRE",
};

export async function buildOrderItem(input: BuildOrderItemInput): Promise<BuildItemResult> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      productType: true,
      isActive: true,
      deletedAt: true,
      costPrice: true,
    },
  });

  if (!product || product.deletedAt || !product.isActive) {
    return {
      success: false,
      error: `Produto não encontrado ou inativo: ${input.productId}`,
    };
  }

  if (product.productType === "VARIANT_PARENT") {
    return {
      success: false,
      error: "Produto pai de variantes não é vendível diretamente",
    };
  }

  // Resolve price (cascata — Etapa 2)
  const channelStr = input.channel ? CHANNEL_STR[input.channel] : undefined;
  const priceResult = await resolvePrice({
    productId: input.productId,
    variantId: input.variantId,
    locationId: input.locationId,
    channel: channelStr,
  });

  let unitPrice: number;
  if (!priceResult.success) {
    // Fallback ao preço legado do produto
    const legacyPrice = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { price: true },
    });
    if (!legacyPrice || Number(legacyPrice.price) === 0) {
      return { success: false, error: "Preço não configurado para este produto" };
    }
    unitPrice = Number(legacyPrice.price);
  } else {
    unitPrice = Number(priceResult.data.effectivePrice);
  }

  // Resolve tax snapshot (Etapa 2 — best-effort)
  let taxSnapshot: Record<string, unknown> | null = null;
  const taxResult = await resolveTax({
    organizationId: input.organizationId,
    productId: input.productId,
    variantId: input.variantId,
  });
  if (taxResult.success) {
    const t = taxResult.data;
    taxSnapshot = {
      ncm: t.ncm,
      cest: t.cest,
      // CFOP interno — venda no balcão é operação interna (mesma UF)
      cfop: t.cfopInternal,
      origin: t.origin,
      icmsCst: t.icmsCst,
      icmsCsosn: t.icmsCsosn,
      icmsRate: t.icmsRate,
      pisCst: t.pisCst,
      pisRate: t.pisRate,
      cofinsCst: t.cofinsCst,
      cofinsRate: t.cofinsRate,
      ipiCst: t.ipiCst,
      ipiRate: t.ipiRate,
    };
  }

  const discount = input.discountAmount ?? 0;
  const lineTotal = Math.max(0, unitPrice * input.quantity - discount);

  return {
    success: true,
    item: {
      productId: input.productId,
      variantId: input.variantId ?? null,
      productNameSnapshot: product.name,
      skuSnapshot: product.sku ?? null,
      unitSnapshot: product.unit,
      unitPriceSnapshot: unitPrice,
      costSnapshot: product.costPrice ? Number(product.costPrice) : null,
      taxSnapshot,
      productTypeSnapshot: product.productType,
      quantity: input.quantity,
      discountAmount: discount,
      lineTotal,
      isKit: product.productType === "KIT",
    },
  };
}
