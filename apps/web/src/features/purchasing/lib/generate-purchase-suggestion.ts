/**
 * generatePurchaseSuggestion — algoritmo de sugestão de compra (RN-P10).
 *
 * Para cada produto com StockBalance abaixo do minQuantity (ponto de pedido):
 *   1. Calcula vendas médias diárias dos últimos N dias (Etapa 4 OrderItem)
 *   2. daysOfCoverage = quantityOnHand / averageDailySales
 *   3. Se quantityOnHand ≤ minQuantity OU daysOfCoverage < bufferDays → sugere compra
 *   4. suggestedQuantity cobre (defaultLeadTimeDays + bufferDays*2) dias de demanda
 *   5. Sugere fornecedor via SupplierProductMapping ou histórico recente de compras
 *
 * Campos de reorder ponto/quantidade não existem em Product — usa minQuantity de StockBalance
 * como threshold. leadTimeDays usa defaultLeadTimeDays do Supplier ou default de 7 dias.
 */

import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type GenerateSuggestionInput = {
  organizationId: string;
  locationId: string;
  actorId: string;
  /** Dias históricos para calcular consumo médio (default: 30) */
  lookbackDays?: number;
  /** Dias de buffer mínimo de cobertura para acionar sugestão (default: 7) */
  bufferDays?: number;
  /** Filtrar por productIds específicos (default: todos) */
  productIds?: string[];
};

export type GenerateSuggestionResult =
  | { success: true; suggestionId: string; itemCount: number }
  | { success: false; error: string; code?: string };

/* ── Função principal ───────────────────────────────────────────── */

export async function generatePurchaseSuggestion(
  input: GenerateSuggestionInput,
): Promise<GenerateSuggestionResult> {
  const lookbackDays = input.lookbackDays ?? 30;
  const bufferDays = input.bufferDays ?? 7;
  const since = new Date(Date.now() - lookbackDays * 86_400_000);

  // 1. Buscar saldos de estoque na location
  const stockBalances = await prisma.stockBalance.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      ...(input.productIds ? { productId: { in: input.productIds } } : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          supplierId: true,
          supplierProductMappings: {
            take: 1,
            select: { supplierId: true },
          },
        },
      },
    },
  });

  if (stockBalances.length === 0) {
    return { success: false, error: "Nenhum saldo de estoque encontrado", code: "NO_STOCK" };
  }

  // 2. Calcular consumo médio diário (via OrderItem)
  const productIds = stockBalances.map((b) => b.productId);

  const salesData = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        organizationId: input.organizationId,
        status: { in: ["COMPLETED", "FULFILLED"] },
        createdAt: { gte: since },
      },
      productId: { in: productIds },
    },
    _sum: { quantity: true },
  });

  const salesMap = new Map<string, number>(
    salesData.map((s) => [s.productId ?? "", Number(s._sum?.quantity ?? 0)]),
  );

  // 3. Fornecedor preferido: SupplierProductMapping → histórico recente de compras
  const recentSupplierMap = new Map<string, string>();
  for (const productId of productIds) {
    const latestItem = await prisma.goodsReceiptItem.findFirst({
      where: {
        productId,
        goodsReceipt: {
          organizationId: input.organizationId,
          status: "CONFIRMED",
          createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        goodsReceipt: {
          include: {
            purchaseOrder: {
              select: { supplierId: true, supplier: { select: { defaultLeadTimeDays: true } } },
            },
          },
        },
      },
    });
    if (latestItem?.goodsReceipt?.purchaseOrder?.supplierId) {
      recentSupplierMap.set(productId, latestItem.goodsReceipt.purchaseOrder.supplierId);
    }
  }

  // 4. Calcular sugestões
  type SuggestionItem = {
    productId: string;
    variantId: string | null;
    currentStock: number;
    averageDailySales: number;
    daysOfCoverage: number | null;
    suggestedQuantity: number;
    suggestedSupplierId: string | null;
  };

  const suggestionItems: SuggestionItem[] = [];

  for (const balance of stockBalances) {
    const product = balance.product;
    const currentStock = Number(balance.quantityOnHand);
    const minQuantity = balance.minQuantity != null ? Number(balance.minQuantity) : null;
    const idealQuantity = balance.idealQuantity != null ? Number(balance.idealQuantity) : null;
    const totalSales = salesMap.get(balance.productId) ?? 0;
    const avgDailySales = totalSales / lookbackDays;
    const leadTimeDays = 7; // default; lookupable from Supplier but not required here

    const daysOfCoverage = avgDailySales > 0 ? currentStock / avgDailySales : null;

    // Precisa repor se: abaixo do minQuantity OU daysOfCoverage < leadTime + buffer
    const belowMin = minQuantity !== null && currentStock <= minQuantity;
    const lowCoverage = daysOfCoverage !== null && daysOfCoverage < leadTimeDays + bufferDays;

    if (!belowMin && !lowCoverage) continue;

    // Quantidade sugerida:
    //  1. Se há idealQuantity definido → comprar até atingir o ideal (descontando estoque atual)
    //  2. Senão, cobre leadTime + 2× buffer dias de demanda média
    //  3. Fallback: ao menos minQuantity (ou 1 se sem definição)
    const suggestedQuantity = (() => {
      if (idealQuantity !== null && idealQuantity > currentStock) {
        // Cobre exatamente o gap até o ideal — mais preciso que fórmula de dias
        return Math.ceil(idealQuantity - currentStock);
      }
      if (avgDailySales > 0) {
        return Math.ceil(avgDailySales * (leadTimeDays + bufferDays * 2));
      }
      return Math.max(1, idealQuantity ?? minQuantity ?? 1);
    })();

    const mappedSupplier = product.supplierProductMappings[0]?.supplierId ?? null;
    const historicalSupplier = recentSupplierMap.get(balance.productId) ?? null;
    const directSupplier = product.supplierId ?? null;
    const suggestedSupplierId = mappedSupplier ?? historicalSupplier ?? directSupplier;

    suggestionItems.push({
      productId: balance.productId,
      variantId: balance.variantId,
      currentStock,
      averageDailySales: roundDecimals(avgDailySales, 4),
      daysOfCoverage: daysOfCoverage !== null ? roundDecimals(daysOfCoverage, 2) : null,
      suggestedQuantity: Math.max(1, suggestedQuantity),
      suggestedSupplierId,
    });
  }

  if (suggestionItems.length === 0) {
    return {
      success: false,
      error: "Nenhum produto precisa de reposição no momento",
      code: "NOTHING_TO_SUGGEST",
    };
  }

  // 5. Criar PurchaseSuggestion
  const suggestion = await prisma.purchaseSuggestion.create({
    data: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      status: "PENDING",
      generatedAt: new Date(),
      algorithmVersion: "v1",
      reasonSummary: {
        generatedBy: input.actorId,
        lookbackDays,
        bufferDays,
        itemCount: suggestionItems.length,
        algorithmNote: "idealQuantity used as target when defined",
      } as never,
      items: {
        create: suggestionItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          currentStock: item.currentStock,
          averageDailySales: item.averageDailySales,
          daysOfCoverage: item.daysOfCoverage,
          suggestedQuantity: item.suggestedQuantity,
          suggestedSupplierId: item.suggestedSupplierId,
        })),
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "purchase_suggestion.generated",
    resourceType: "PurchaseSuggestion",
    resourceId: suggestion.id,
    after: { locationId: input.locationId, itemCount: suggestionItems.length, lookbackDays },
  });

  return { success: true, suggestionId: suggestion.id, itemCount: suggestionItems.length };
}

/* ── Auxiliar ───────────────────────────────────────────────────── */

function roundDecimals(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
