/**
 * confirmReceipt — confirma recebimento (DRAFT → CONFIRMED).
 *
 * Orquestra (RN-P04, RN-P05, RN-P06, RN-P07):
 *   1. Para cada GoodsReceiptItem: chama applyMovement (Etapa 3) → StockMovement INBOUND
 *   2. Salva stockMovementId no item
 *   3. Atualiza ProductPrice.cost com último custo de entrada (Etapa 2 — RN-P05)
 *   4. Transiciona PO: RECEIVING (parcial) ou RECEIVED (completo)
 *   5. Gera AccountPayable conforme paymentTerms do PO (RN-P06)
 *   6. Auditoria
 *
 * Nunca escreve StockBalance diretamente — tudo via applyMovement.
 */

import { applyMovement } from "@/features/inventory/lib/apply-movement";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";

export type ConfirmReceiptResult =
  | { success: true; receiptId: string; movementsCreated: number; payablesCreated: number }
  | { success: false; error: string; code?: string };

export async function confirmReceipt(
  receiptId: string,
  organizationId: string,
  actorId: string,
): Promise<ConfirmReceiptResult> {
  const receipt = await prisma.goodsReceipt.findUnique({
    where: { id: receiptId },
    include: {
      items: true,
      purchaseOrder: {
        include: { items: true },
      },
    },
  });

  if (!receipt || receipt.organizationId !== organizationId) {
    return { success: false, error: "Recebimento não encontrado", code: "NOT_FOUND" };
  }
  if (receipt.status !== "DRAFT") {
    return {
      success: false,
      error: `Recebimento já está em ${receipt.status}`,
      code: "INVALID_STATUS",
    };
  }

  const po = receipt.purchaseOrder;
  const location = po.locationId;

  // ── 1. Criar movimentos INBOUND (Etapa 3) ────────────────────
  let movementsCreated = 0;
  const movementIds: Record<string, string> = {};

  for (const item of receipt.items) {
    const movResult = await applyMovement({
      organizationId,
      locationId: location,
      productId: item.productId,
      variantId: item.variantId ?? null,
      lotId: null, // lot handling: if lotCode present, look up lot
      type: "INBOUND",
      quantity: Number(item.receivedQuantity),
      unitCost: Number(item.unitCost),
      reason: "PURCHASE",
      referenceType: "PURCHASE",
      referenceId: po.id,
      idempotencyKey: `receipt-${receiptId}-item-${item.id}`,
      actorId,
    });

    if (!movResult.success) {
      return {
        success: false,
        error: `Erro ao registrar entrada de estoque: ${movResult.message}`,
        code: "MOVEMENT_FAILED",
      };
    }

    movementIds[item.id] = movResult.movementId;
    movementsCreated++;
  }

  // ── 2. Atualizar stockMovementId nos itens (Etapa 3) ─────────
  for (const [itemId, movementId] of Object.entries(movementIds)) {
    await prisma.goodsReceiptItem.update({
      where: { id: itemId },
      data: { stockMovementId: movementId },
    });
  }

  // ── 3. Atualizar ProductPrice.cost com último custo (Etapa 2 — RN-P05) ──
  const costUpdates = new Map<string, number>();
  for (const item of receipt.items) {
    const key = item.variantId ?? item.productId;
    costUpdates.set(key, Number(item.unitCost));
  }

  for (const item of receipt.items) {
    await prisma.productPrice.updateMany({
      where: {
        organizationId,
        productId: item.productId,
        variantId: item.variantId ?? null,
      },
      data: { cost: Number(item.unitCost) },
    });
  }

  // ── 4. Verificar se PO está completamente recebido ────────────
  const allPOItems = po.items;
  const allReceipts = await prisma.goodsReceipt.findMany({
    where: { purchaseOrderId: po.id, status: { in: ["DRAFT", "CONFIRMED"] } },
    include: { items: true },
  });

  // Somar quantidades recebidas por purchaseOrderItemId
  const receivedQtyMap = new Map<string, number>();
  for (const r of allReceipts) {
    for (const ri of r.items) {
      if (ri.purchaseOrderItemId) {
        receivedQtyMap.set(
          ri.purchaseOrderItemId,
          (receivedQtyMap.get(ri.purchaseOrderItemId) ?? 0) + Number(ri.receivedQuantity),
        );
      }
    }
  }
  // Include items from this receipt being confirmed
  for (const item of receipt.items) {
    if (item.purchaseOrderItemId) {
      receivedQtyMap.set(
        item.purchaseOrderItemId,
        (receivedQtyMap.get(item.purchaseOrderItemId) ?? 0) + Number(item.receivedQuantity),
      );
    }
  }

  const isComplete = allPOItems.every((poItem) => {
    const received = receivedQtyMap.get(poItem.id) ?? 0;
    return received >= Number(poItem.expectedQuantity) - 0.001;
  });

  const newPoStatus = isComplete ? "RECEIVED" : "RECEIVING";

  // ── 5. Gerar AccountPayable conforme paymentTerms (RN-P06) ────
  const paymentTerms = po.paymentTerms as {
    type: string;
    installments?: Array<{ days: number; percentual: number }>;
  } | null;

  const installments = buildInstallments(Number(po.total), paymentTerms);
  let payablesCreated = 0;

  // ── 6. Commit em transação ────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // Confirmar recebimento
    await tx.goodsReceipt.update({
      where: { id: receiptId },
      data: { status: "CONFIRMED" },
    });

    // Transicionar PO
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: newPoStatus },
    });
    await tx.purchaseOrderStatusHistory.create({
      data: {
        purchaseOrderId: po.id,
        fromStatus: po.status,
        toStatus: newPoStatus,
        actorId,
        source: "INTERNAL",
        reason: `Recebimento ${receiptId} confirmado`,
      },
    });

    // Criar AccountPayables
    for (const inst of installments) {
      await tx.accountPayable.create({
        data: {
          organizationId,
          supplierId: po.supplierId,
          goodsReceiptId: receiptId,
          purchaseOrderId: po.id,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: "PENDING",
          description: `PO #${po.id.slice(0, 8)} — parcela ${inst.installment}/${installments.length}`,
          installmentNumber: inst.installment,
          totalInstallments: installments.length,
        },
      });
      payablesCreated++;
    }
  });

  await writeAudit({
    organizationId,
    actorId,
    action: "goods_receipt.confirmed",
    resourceType: "GoodsReceipt",
    resourceId: receiptId,
    after: {
      purchaseOrderId: po.id,
      movementsCreated,
      payablesCreated,
      poStatus: newPoStatus,
    },
  });

  return { success: true, receiptId, movementsCreated, payablesCreated };
}

/* ── Auxiliar: calcular parcelas ─────────────────────────────── */

type Installment = { installment: number; amount: number; dueDate: Date };

function buildInstallments(
  total: number,
  paymentTerms: { type: string; installments?: Array<{ days: number; percentual: number }> } | null,
): Installment[] {
  const now = new Date();

  if (!paymentTerms) {
    // À vista — vencimento hoje
    return [{ installment: 1, amount: total, dueDate: now }];
  }

  if (paymentTerms.installments && paymentTerms.installments.length > 0) {
    return paymentTerms.installments.map((inst, idx) => {
      const dueDate = new Date(now.getTime() + inst.days * 86_400_000);
      const amount = roundCents((total * inst.percentual) / 100);
      return { installment: idx + 1, amount, dueDate };
    });
  }

  // Padrões comuns
  switch (paymentTerms.type) {
    case "CASH":
      return [{ installment: 1, amount: total, dueDate: now }];
    case "NET30":
      return [{ installment: 1, amount: total, dueDate: addDays(now, 30) }];
    case "NET30_60": {
      const half = roundCents(total / 2);
      return [
        { installment: 1, amount: half, dueDate: addDays(now, 30) },
        { installment: 2, amount: total - half, dueDate: addDays(now, 60) },
      ];
    }
    case "NET30_60_90": {
      const third = roundCents(total / 3);
      return [
        { installment: 1, amount: third, dueDate: addDays(now, 30) },
        { installment: 2, amount: third, dueDate: addDays(now, 60) },
        { installment: 3, amount: total - 2 * third, dueDate: addDays(now, 90) },
      ];
    }
    default:
      return [{ installment: 1, amount: total, dueDate: now }];
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
