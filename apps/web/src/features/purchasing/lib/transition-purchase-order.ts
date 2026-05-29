/**
 * Transições de status do PurchaseOrder:
 * sendPurchaseOrder — DRAFT → SENT
 * confirmPurchaseOrder — SENT → CONFIRMED
 * cancelPurchaseOrder — qualquer não-terminal → CANCELED (RN-P08)
 */

import type { PurchaseOrderStatus } from "@nohub/db";
import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";
import { canTransitionPO } from "./can-transition-po";

async function transitionPO(
  organizationId: string,
  poId: string,
  toStatus: PurchaseOrderStatus,
  actorId: string,
  extra?: { expectedDate?: Date; confirmedDate?: Date; reason?: string },
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });

  if (!po || po.organizationId !== organizationId) {
    return { success: false, error: "Pedido de compra não encontrado", code: "NOT_FOUND" };
  }

  if (!canTransitionPO(po.status, toStatus)) {
    return {
      success: false,
      error: `Transição inválida: ${po.status} → ${toStatus}`,
      code: "INVALID_TRANSITION",
    };
  }

  const updateData: Record<string, unknown> = { status: toStatus, updatedAt: new Date() };
  if (extra?.confirmedDate) updateData.confirmedDate = extra.confirmedDate;
  if (extra?.expectedDate) updateData.expectedDate = extra.expectedDate;

  await prisma.$transaction([
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: updateData as never,
    }),
    prisma.purchaseOrderStatusHistory.create({
      data: {
        purchaseOrderId: poId,
        fromStatus: po.status,
        toStatus,
        actorId,
        source: "INTERNAL",
        reason: extra?.reason ?? null,
      },
    }),
  ]);

  await writeAudit({
    organizationId,
    actorId,
    action: `purchase_order.${toStatus.toLowerCase()}`,
    resourceType: "PurchaseOrder",
    resourceId: poId,
    after: { fromStatus: po.status, toStatus },
  });

  return { success: true };
}

/* ── Exportações ─────────────────────────────────────────────── */

export async function sendPurchaseOrder(
  organizationId: string,
  poId: string,
  actorId: string,
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  return transitionPO(organizationId, poId, "SENT", actorId);
}

export async function confirmPurchaseOrder(
  organizationId: string,
  poId: string,
  actorId: string,
  expectedDate?: Date,
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  return transitionPO(organizationId, poId, "CONFIRMED", actorId, {
    confirmedDate: new Date(),
    expectedDate,
  });
}

export async function cancelPurchaseOrder(
  organizationId: string,
  poId: string,
  actorId: string,
  reason: string,
): Promise<{ success: true } | { success: false; error: string; code?: string }> {
  // RN-P08: bloquear se há recebimento confirmado
  const confirmedReceipt = await prisma.goodsReceipt.findFirst({
    where: { purchaseOrderId: poId, status: "CONFIRMED" },
  });
  if (confirmedReceipt) {
    return {
      success: false,
      error:
        "Não é possível cancelar um pedido com recebimento já confirmado. Crie uma devolução ao fornecedor primeiro.",
      code: "RECEIPT_CONFIRMED",
    };
  }

  return transitionPO(organizationId, poId, "CANCELED", actorId, { reason });
}
