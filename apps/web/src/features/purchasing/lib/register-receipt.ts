/**
 * registerReceipt — cria GoodsReceipt DRAFT com divergências calculadas (RN-P03).
 *
 * Recebimento em DRAFT: operador pode ajustar antes de confirmar.
 * Não escreve estoque — isso é feito em confirmReceipt.
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import type { DivergenceType } from "@nohub/db";

export type ReceiptItemInput = {
  purchaseOrderItemId?: string; // null = item extra não pedido
  productId: string;
  variantId?: string | null;
  receivedQuantity: number;
  unitCost: number;
  lotCode?: string | null;
  expiryDate?: Date | null;
  divergenceNote?: string | null;
};

export type RegisterReceiptInput = {
  organizationId: string;
  purchaseOrderId: string;
  receivedBy: string;
  items: ReceiptItemInput[];
  supplierInvoiceNumber?: string | null;
  supplierInvoiceSeries?: string | null;
  supplierInvoiceAccessKey?: string | null;
  notes?: string | null;
};

export type RegisterReceiptResult =
  | { success: true; receiptId: string; divergences: number }
  | { success: false; error: string; code?: string };

export async function registerReceipt(input: RegisterReceiptInput): Promise<RegisterReceiptResult> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    include: { items: true },
  });

  if (!po || po.organizationId !== input.organizationId) {
    return { success: false, error: "Pedido de compra não encontrado", code: "PO_NOT_FOUND" };
  }

  if (po.status !== "CONFIRMED" && po.status !== "RECEIVING") {
    return {
      success: false,
      error: `PO em status ${po.status} — aceita recebimento apenas em CONFIRMED ou RECEIVING`,
      code: "INVALID_PO_STATUS",
    };
  }

  if (input.items.length === 0) {
    return { success: false, error: "Recebimento deve ter pelo menos um item", code: "NO_ITEMS" };
  }

  // Calcular divergências item a item
  const poItemMap = new Map(po.items.map((i) => [i.id, i]));
  let divergenceCount = 0;

  const receiptItems = input.items.map((item) => {
    const poItem = item.purchaseOrderItemId ? poItemMap.get(item.purchaseOrderItemId) : undefined;
    let divergence: DivergenceType = "NONE";

    if (poItem) {
      const expectedQty = Number(poItem.expectedQuantity);
      const expectedCost = Number(poItem.unitCost);
      const qtyDiff = Math.abs(item.receivedQuantity - expectedQty);
      const costDiff = Math.abs(item.unitCost - expectedCost);

      if (qtyDiff > 0.001) {
        divergence = "QUANTITY";
        divergenceCount++;
      } else if (costDiff > 0.001) {
        divergence = "COST";
        divergenceCount++;
      }
    }

    return { ...item, divergence };
  });

  // Verificar NFe duplicada (idempotência por accessKey — RN-P11)
  if (input.supplierInvoiceAccessKey) {
    const dup = await prisma.goodsReceipt.findFirst({
      where: {
        organizationId: input.organizationId,
        supplierInvoiceAccessKey: input.supplierInvoiceAccessKey,
      },
    });
    if (dup) {
      return { success: true, receiptId: dup.id, divergences: 0 }; // idempotente
    }
  }

  const divergenceSummary =
    divergenceCount > 0
      ? {
          count: divergenceCount,
          items: receiptItems
            .filter((i) => i.divergence !== "NONE")
            .map((i) => ({ productId: i.productId, divergence: i.divergence })),
        }
      : null;

  const receipt = await prisma.goodsReceipt.create({
    data: {
      organizationId: input.organizationId,
      purchaseOrderId: input.purchaseOrderId,
      receivedBy: input.receivedBy,
      supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
      supplierInvoiceSeries: input.supplierInvoiceSeries ?? null,
      supplierInvoiceAccessKey: input.supplierInvoiceAccessKey ?? null,
      notes: input.notes ?? null,
      status: "DRAFT",
      divergenceSummary: (divergenceSummary as never) ?? null,
      items: {
        create: receiptItems.map((item) => ({
          purchaseOrderItemId: item.purchaseOrderItemId ?? null,
          productId: item.productId,
          variantId: item.variantId ?? null,
          receivedQuantity: item.receivedQuantity,
          unitCost: item.unitCost,
          divergence: item.divergence,
          divergenceNote: item.divergenceNote ?? null,
          lotCode: item.lotCode ?? null,
          expiryDate: item.expiryDate ?? null,
        })),
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.receivedBy,
    action: "goods_receipt.created",
    resourceType: "GoodsReceipt",
    resourceId: receipt.id,
    after: {
      purchaseOrderId: input.purchaseOrderId,
      itemCount: input.items.length,
      divergences: divergenceCount,
    },
  });

  return { success: true, receiptId: receipt.id, divergences: divergenceCount };
}
