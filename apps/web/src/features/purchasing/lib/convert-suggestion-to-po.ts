/**
 * convertSuggestionToPO — transforma PurchaseSuggestion em PurchaseOrder DRAFT (RN-P10).
 *
 * Agrupa itens da sugestão por fornecedor sugerido.
 * Se um item não tem fornecedor sugerido, requer supplierId explícito no input.
 * Marca sugestão como CONVERTED após criação do(s) PO(s).
 *
 * unitCost por item: usa estimativa via ProductPrice.cost ou 0 se não disponível.
 */

import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";
import { createPurchaseOrder } from "./create-purchase-order";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type SuggestionItemOverride = {
  suggestionItemId: string;
  supplierId: string; // obrigatório se item não tem fornecedor sugerido
  quantity?: number; // sobrescreve suggestedQuantity
  unitCost?: number; // sobrescreve estimativa automática
};

export type ConvertSuggestionToPOInput = {
  organizationId: string;
  suggestionId: string;
  actorId: string;
  /** Override por item — obrigatório para itens sem suggestedSupplierId */
  itemOverrides?: SuggestionItemOverride[];
  paymentTerms?: { type: string; installments?: Array<{ days: number; percentual: number }> };
  notes?: string;
};

export type ConvertSuggestionToPOResult =
  | { success: true; purchaseOrderIds: string[]; itemCount: number }
  | { success: false; error: string; code?: string };

/* ── Função principal ───────────────────────────────────────────── */

export async function convertSuggestionToPO(
  input: ConvertSuggestionToPOInput,
): Promise<ConvertSuggestionToPOResult> {
  const suggestion = await prisma.purchaseSuggestion.findUnique({
    where: { id: input.suggestionId },
    include: { items: true },
  });

  if (!suggestion || suggestion.organizationId !== input.organizationId) {
    return { success: false, error: "Sugestão não encontrada", code: "NOT_FOUND" };
  }
  if (suggestion.status !== "PENDING") {
    return {
      success: false,
      error: `Sugestão já está em ${suggestion.status}`,
      code: "INVALID_STATUS",
    };
  }

  const overrideMap = new Map<string, SuggestionItemOverride>(
    (input.itemOverrides ?? []).map((o) => [o.suggestionItemId, o]),
  );

  // Buscar custos estimados via ProductPrice
  const productIds = [...new Set(suggestion.items.map((i) => i.productId))];
  const productPrices = await prisma.productPrice.findMany({
    where: { productId: { in: productIds }, organizationId: input.organizationId },
    select: { productId: true, variantId: true, cost: true },
  });
  const priceMap = new Map<string, number>(
    productPrices.map((p) => [`${p.productId}|${p.variantId ?? ""}`, Number(p.cost ?? 0)]),
  );

  type ResolvedItem = {
    supplierId: string;
    productId: string;
    variantId: string | null;
    expectedQuantity: number;
    unitCost: number;
  };

  const resolvedItems: ResolvedItem[] = [];

  for (const item of suggestion.items) {
    const override = overrideMap.get(item.id);
    const supplierId = override?.supplierId ?? item.suggestedSupplierId;

    if (!supplierId) {
      return {
        success: false,
        error: `Item ${item.productId} não tem fornecedor sugerido. Informe via itemOverrides.`,
        code: "NO_SUPPLIER",
      };
    }

    const priceKey = `${item.productId}|${item.variantId ?? ""}`;
    const unitCost = override?.unitCost ?? priceMap.get(priceKey) ?? 0;

    resolvedItems.push({
      supplierId,
      productId: item.productId,
      variantId: item.variantId,
      expectedQuantity: override?.quantity ?? Number(item.suggestedQuantity),
      unitCost,
    });
  }

  // Agrupar por fornecedor → um PO por fornecedor
  const bySupplier = new Map<string, ResolvedItem[]>();
  for (const item of resolvedItems) {
    const list = bySupplier.get(item.supplierId) ?? [];
    list.push(item);
    bySupplier.set(item.supplierId, list);
  }

  const purchaseOrderIds: string[] = [];

  for (const [supplierId, items] of bySupplier.entries()) {
    const result = await createPurchaseOrder({
      organizationId: input.organizationId,
      supplierId,
      locationId: suggestion.locationId,
      createdBy: input.actorId,
      originSuggestionId: input.suggestionId,
      paymentTerms: input.paymentTerms,
      notes: input.notes,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        expectedQuantity: i.expectedQuantity,
        unitCost: i.unitCost,
      })),
    });

    if (!result.success) {
      return { success: false, error: result.error, code: result.code };
    }

    purchaseOrderIds.push(result.purchaseOrderId);
  }

  // Marcar sugestão como CONVERTED
  await prisma.purchaseSuggestion.update({
    where: { id: input.suggestionId },
    data: { status: "CONVERTED" },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "purchase_suggestion.converted",
    resourceType: "PurchaseSuggestion",
    resourceId: input.suggestionId,
    after: {
      purchaseOrderIds,
      supplierCount: purchaseOrderIds.length,
      itemCount: resolvedItems.length,
    },
  });

  return { success: true, purchaseOrderIds, itemCount: resolvedItems.length };
}
