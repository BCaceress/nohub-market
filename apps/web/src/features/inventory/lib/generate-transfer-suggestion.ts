/**
 * generateTransferSuggestion — sugestão de transferência interna (RN-E14).
 *
 * Lógica:
 *  1. Varre todos os StockBalance da organização.
 *  2. Identifica pares (destino com déficit ↔ origem com excedente):
 *     - destino: quantityOnHand ≤ minQuantity (alerta de ruptura)
 *     - origem: quantityOnHand > idealQuantity (excedente) OU
 *               quantityOnHand > minQuantity * 2 (boa folga mesmo sem ideal definido)
 *  3. Para cada produto em déficit, sugere a origem com maior excedente.
 *  4. Quantidade sugerida = min(
 *       excedente da origem,
 *       (idealQuantity do destino - quantityOnHand do destino)  // preenche até o ideal
 *     )
 *  5. Não sugere transferência se a origem ficaria abaixo do seu próprio mínimo.
 *
 * Resultado persistido em TransferSuggestion (tabela futura) ou retornado
 * in-memory para exibição imediata (modo atual).
 */

import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type TransferSuggestionInput = {
  organizationId: string;
  actorId: string;
  /** Filtrar apenas determinadas locations como origem ou destino */
  locationIds?: string[];
  /** Filtrar por produtos específicos */
  productIds?: string[];
};

export type TransferSuggestionItem = {
  productId: string;
  productName: string;
  variantId: string | null;

  /** Local com deficit */
  toLocationId: string;
  toLocationName: string;
  currentStockDestination: number;
  minQuantityDestination: number | null;
  idealQuantityDestination: number | null;

  /** Local com excedente sugerido como origem */
  fromLocationId: string;
  fromLocationName: string;
  currentStockOrigin: number;
  minQuantityOrigin: number | null;
  idealQuantityOrigin: number | null;
  surplusOrigin: number;

  suggestedQuantity: number;
  reason: "below_min" | "below_ideal";
};

export type TransferSuggestionResult =
  | { success: true; items: TransferSuggestionItem[]; total: number }
  | { success: false; error: string; code?: string };

/* ── Função principal ───────────────────────────────────────────── */

export async function generateTransferSuggestion(
  input: TransferSuggestionInput,
): Promise<TransferSuggestionResult> {
  // 1. Carregar todos os saldos com produto e location
  const balances = await prisma.stockBalance.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.locationIds ? { locationId: { in: input.locationIds } } : {}),
      ...(input.productIds ? { productId: { in: input.productIds } } : {}),
    },
    include: {
      product: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  });

  if (!balances.length) {
    return { success: false, error: "Nenhum saldo encontrado", code: "NO_STOCK" };
  }

  // 2. Agrupar por produto+variante → mapa de locations
  type BalanceRow = (typeof balances)[number];
  const byProduct = new Map<string, BalanceRow[]>();

  for (const b of balances) {
    const key = `${b.productId}::${b.variantId ?? ""}`;
    const list = byProduct.get(key) ?? [];
    list.push(b);
    byProduct.set(key, list);
  }

  const suggestions: TransferSuggestionItem[] = [];

  for (const rows of byProduct.values()) {
    if (rows.length < 2) continue; // produto em apenas uma location → sem transferência possível

    // 3. Separar destinos (deficit) e origens (excedente)
    const deficits: BalanceRow[] = [];
    const surpluses: BalanceRow[] = [];

    for (const row of rows) {
      const onHand = Number(row.quantityOnHand);
      const minQty = row.minQuantity !== null ? Number(row.minQuantity) : null;
      const idealQty = row.idealQuantity !== null ? Number(row.idealQuantity) : null;

      const isBelowMin = minQty !== null && onHand <= minQty;
      if (isBelowMin) {
        deficits.push(row);
        continue;
      }

      // Origem: tem excedente acima do ideal OU acima de 2× o mínimo
      const hasSurplusAboveIdeal = idealQty !== null && onHand > idealQty;
      const hasSurplusAboveMin = minQty !== null && onHand > minQty * 2;
      const hasSurplusNoThreshold = minQty === null && idealQty === null && onHand > 0;

      if (hasSurplusAboveIdeal || hasSurplusAboveMin || hasSurplusNoThreshold) {
        surpluses.push(row);
      }
    }

    if (!deficits.length || !surpluses.length) continue;

    // 4. Para cada deficit, escolher a melhor origem (maior excedente)
    for (const dest of deficits) {
      const destOnHand = Number(dest.quantityOnHand);
      const destMin = dest.minQuantity !== null ? Number(dest.minQuantity) : null;
      const destIdeal = dest.idealQuantity !== null ? Number(dest.idealQuantity) : null;

      // Quanto precisamos repor no destino
      const targetForDest = destIdeal ?? (destMin !== null ? destMin * 2 : destOnHand + 1);
      const needed = Math.max(0, targetForDest - destOnHand);
      if (needed <= 0) continue;

      // Ordenar origens por maior excedente
      const ranked = surpluses
        .filter((s) => s.locationId !== dest.locationId) // não transferir para si mesmo
        .map((s) => {
          const sOnHand = Number(s.quantityOnHand);
          const sMin = s.minQuantity !== null ? Number(s.minQuantity) : 0;
          const sIdeal = s.idealQuantity !== null ? Number(s.idealQuantity) : null;
          // excedente = quanto pode ceder sem ficar abaixo do próprio mínimo
          const floor = sMin; // garante que origem não fica abaixo do seu mínimo
          const surplus = Math.max(0, sOnHand - floor - (sIdeal ? 0 : 0)); // excedente líquido
          return { row: s, surplus, sIdeal };
        })
        .filter((r) => r.surplus > 0)
        .sort((a, b) => b.surplus - a.surplus);

      if (!ranked.length) continue;

      const best = ranked[0];
      if (!best) continue;

      const suggestedQty = Math.min(
        Math.floor(best.surplus), // não tira mais do que a origem pode ceder
        Math.ceil(needed), // não traz mais do que o destino precisa
      );

      if (suggestedQty <= 0) continue;

      const reason: TransferSuggestionItem["reason"] =
        destMin !== null && destOnHand <= destMin ? "below_min" : "below_ideal";

      suggestions.push({
        productId: dest.productId,
        productName: dest.product.name,
        variantId: dest.variantId,

        toLocationId: dest.locationId,
        toLocationName: dest.location.name,
        currentStockDestination: destOnHand,
        minQuantityDestination: destMin,
        idealQuantityDestination: destIdeal,

        fromLocationId: best.row.locationId,
        fromLocationName: best.row.location.name,
        currentStockOrigin: Number(best.row.quantityOnHand),
        minQuantityOrigin: best.row.minQuantity !== null ? Number(best.row.minQuantity) : null,
        idealQuantityOrigin:
          best.row.idealQuantity !== null ? Number(best.row.idealQuantity) : null,
        surplusOrigin: best.surplus,

        suggestedQuantity: suggestedQty,
        reason,
      });
    }
  }

  if (!suggestions.length) {
    return {
      success: false,
      error: "Nenhuma transferência necessária no momento",
      code: "NOTHING_TO_SUGGEST",
    };
  }

  // Ordenar: abaixo do mínimo primeiro, depois por produto
  suggestions.sort((a, b) => {
    if (a.reason === "below_min" && b.reason !== "below_min") return -1;
    if (b.reason === "below_min" && a.reason !== "below_min") return 1;
    return a.productName.localeCompare(b.productName);
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "transfer_suggestion.generated",
    resourceType: "StockBalance",
    after: { itemCount: suggestions.length },
  });

  return { success: true, items: suggestions, total: suggestions.length };
}
