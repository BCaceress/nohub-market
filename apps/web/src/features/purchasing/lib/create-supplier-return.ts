/**
 * createSupplierReturn — cria SupplierReturn DRAFT (RN-P09).
 * confirmSupplierReturn — DRAFT → CONFIRMED: saída de estoque + estorno proporcional de AccountPayable.
 *
 * Regras:
 *   - Só pode criar devolução a partir de GoodsReceipt CONFIRMED
 *   - Quantidade a devolver ≤ quantidade recebida no GoodsReceiptItem
 *   - SupplierReturn tem um único `reason` no cabeçalho
 *   - confirmSupplierReturn chama applyMovement (OUTBOUND, reason: RETURN)
 *   - Estorna AccountPayable proporcionalmente ao valor devolvido vs total do PO
 *   - productId/variantId resolvidos via goodsReceiptItem (SupplierReturnItem não os tem)
 */

import type { SupplierReturnReason } from "@nohub/db";
import { prisma } from "@nohub/db";
import { applyMovement } from "@/features/inventory/lib/apply-movement";
import { writeAudit } from "@/lib/audit";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type SupplierReturnItemInput = {
  goodsReceiptItemId: string;
  quantityToReturn: number;
  unitCost: number;
};

export type CreateSupplierReturnInput = {
  organizationId: string;
  goodsReceiptId: string;
  requestedBy: string; // salvo em returnedBy
  reason: SupplierReturnReason;
  items: SupplierReturnItemInput[];
  notes?: string | null;
};

export type CreateSupplierReturnResult =
  | { success: true; returnId: string }
  | { success: false; error: string; code?: string };

export type ConfirmSupplierReturnResult =
  | { success: true; returnId: string; movementsCreated: number; payablesAdjusted: number }
  | { success: false; error: string; code?: string };

/* ── createSupplierReturn ───────────────────────────────────────── */

export async function createSupplierReturn(
  input: CreateSupplierReturnInput,
): Promise<CreateSupplierReturnResult> {
  if (input.items.length === 0) {
    return { success: false, error: "Devolução deve ter pelo menos um item", code: "NO_ITEMS" };
  }

  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id: input.goodsReceiptId },
    include: { items: true },
  });

  if (!receipt || receipt.organizationId !== input.organizationId) {
    return { success: false, error: "Recebimento não encontrado", code: "NOT_FOUND" };
  }
  if (receipt.status !== "CONFIRMED") {
    return {
      success: false,
      error: "Só é possível criar devolução a partir de um recebimento confirmado",
      code: "INVALID_RECEIPT_STATUS",
    };
  }

  const receiptItemMap = new Map(receipt.items.map((ri) => [ri.id, ri]));

  for (const item of input.items) {
    const receiptItem = receiptItemMap.get(item.goodsReceiptItemId);
    if (!receiptItem) {
      return {
        success: false,
        error: `Item de recebimento ${item.goodsReceiptItemId} não encontrado`,
        code: "ITEM_NOT_FOUND",
      };
    }
    if (item.quantityToReturn <= 0) {
      return {
        success: false,
        error: "Quantidade a devolver deve ser positiva",
        code: "INVALID_QUANTITY",
      };
    }
    if (item.quantityToReturn > Number(receiptItem.receivedQuantity)) {
      return {
        success: false,
        error: `Quantidade a devolver (${item.quantityToReturn}) excede a recebida (${receiptItem.receivedQuantity})`,
        code: "QUANTITY_EXCEEDS_RECEIVED",
      };
    }
  }

  // Buscar supplierId via goodsReceipt → purchaseOrder
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: receipt.purchaseOrderId },
    select: { supplierId: true },
  });

  if (!po) {
    return { success: false, error: "Pedido de compra não encontrado", code: "PO_NOT_FOUND" };
  }

  const supplierReturn = await prisma.supplierReturn.create({
    data: {
      organizationId: input.organizationId,
      goodsReceiptId: input.goodsReceiptId,
      supplierId: po.supplierId,
      reason: input.reason,
      status: "DRAFT",
      returnedBy: input.requestedBy,
      notes: input.notes ?? null,
      items: {
        create: input.items.map((item) => ({
          goodsReceiptItemId: item.goodsReceiptItemId,
          quantity: item.quantityToReturn,
          unitCost: item.unitCost,
        })),
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.requestedBy,
    action: "supplier_return.created",
    resourceType: "SupplierReturn",
    resourceId: supplierReturn.id,
    after: { goodsReceiptId: input.goodsReceiptId, itemCount: input.items.length },
  });

  return { success: true, returnId: supplierReturn.id };
}

/* ── confirmSupplierReturn ──────────────────────────────────────── */

export async function confirmSupplierReturn(
  returnId: string,
  organizationId: string,
  actorId: string,
): Promise<ConfirmSupplierReturnResult> {
  const supplierReturn = await prisma.supplierReturn.findUnique({
    where: { id: returnId },
    include: {
      items: {
        include: { goodsReceiptItem: true },
      },
      goodsReceipt: {
        include: { purchaseOrder: { select: { id: true, locationId: true } } },
      },
    },
  });

  if (!supplierReturn || supplierReturn.organizationId !== organizationId) {
    return { success: false, error: "Devolução não encontrada", code: "NOT_FOUND" };
  }
  if (supplierReturn.status !== "DRAFT") {
    return {
      success: false,
      error: `Devolução já está em ${supplierReturn.status}`,
      code: "INVALID_STATUS",
    };
  }

  const locationId = supplierReturn.goodsReceipt.purchaseOrder.locationId;
  const poId = supplierReturn.goodsReceipt.purchaseOrder.id;

  // ── 1. Registrar saídas OUTBOUND ────────────────────────────────
  let movementsCreated = 0;
  const movementIds: Record<string, string> = {};

  for (const item of supplierReturn.items) {
    const ri = item.goodsReceiptItem;
    const movResult = await applyMovement({
      organizationId,
      locationId,
      productId: ri.productId,
      variantId: ri.variantId ?? null,
      lotId: null,
      type: "OUTBOUND",
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      reason: "RETURN",
      referenceType: "SUPPLIER_RETURN",
      referenceId: returnId,
      idempotencyKey: `return-${returnId}-item-${item.id}`,
      actorId,
    });

    if (!movResult.success) {
      return {
        success: false,
        error: `Erro ao registrar saída de estoque: ${movResult.message}`,
        code: "MOVEMENT_FAILED",
      };
    }

    movementIds[item.id] = movResult.movementId;
    movementsCreated++;
  }

  // ── 2. Salvar stockMovementId nos itens ─────────────────────────
  for (const [itemId, movementId] of Object.entries(movementIds)) {
    await prisma.supplierReturnItem.update({
      where: { id: itemId },
      data: { stockMovementId: movementId },
    });
  }

  // ── 3. Estorno proporcional de AccountPayable (PENDING) ─────────
  const returnTotal = supplierReturn.items.reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.unitCost),
    0,
  );

  const payables = await prisma.accountPayable.findMany({
    where: {
      purchaseOrderId: poId,
      organizationId,
      status: "PENDING",
    },
    orderBy: { installmentNumber: "asc" },
  });

  const totalPending = payables.reduce((sum, p) => sum + Number(p.amount), 0);
  let payablesAdjusted = 0;

  if (totalPending > 0 && returnTotal > 0) {
    let remainingDeduction = Math.min(returnTotal, totalPending);

    await prisma.$transaction(async (tx) => {
      await tx.supplierReturn.update({
        where: { id: returnId },
        data: { status: "CONFIRMED", returnedAt: new Date() },
      });

      for (const payable of payables) {
        if (remainingDeduction <= 0) break;

        const currentAmount = Number(payable.amount);
        const deduction = Math.min(remainingDeduction, currentAmount);
        const newAmount = roundCents(currentAmount - deduction);

        await tx.accountPayable.update({
          where: { id: payable.id },
          data: {
            amount: newAmount,
            status: newAmount <= 0 ? "CANCELED" : "PENDING",
            description: `${payable.description} (ajustado por devolução ${returnId.slice(0, 8)})`,
          },
        });

        remainingDeduction -= deduction;
        payablesAdjusted++;
      }
    });
  } else {
    await prisma.supplierReturn.update({
      where: { id: returnId },
      data: { status: "CONFIRMED", returnedAt: new Date() },
    });
  }

  await writeAudit({
    organizationId,
    actorId,
    action: "supplier_return.confirmed",
    resourceType: "SupplierReturn",
    resourceId: returnId,
    after: { movementsCreated, payablesAdjusted, returnTotal },
  });

  return { success: true, returnId, movementsCreated, payablesAdjusted };
}

/* ── Auxiliar ───────────────────────────────────────────────────── */

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
