/**
 * quickSale — venda balcão em um passo (PDV rápido).
 * Idempotente via idempotencyKey.
 * Cria Order DRAFT, adiciona itens, confirma e registra pagamento numa operação.
 *
 * Sequência: DRAFT → CONFIRMED (reserva) → PAID (pagamento) → FULFILLED (baixa)
 * O PDV é síncrono — tudo acontece em cadeia dentro do mesmo request.
 */

import type { PaymentMethod } from "@nohub/db";
import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";
import { buildOrderItem } from "./build-order-item";
import { confirmOrder } from "./confirm-order";
import { fulfillOrder } from "./fulfill-order";
import { registerPayment } from "./register-payment";

export type QuickSaleItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountAmount?: number;
  selectedOptionIds?: string[];
};

export type QuickSaleInput = {
  organizationId: string;
  locationId: string;
  cashSessionId?: string;
  customerId?: string;
  items: QuickSaleItem[];
  paymentMethod: PaymentMethod;
  receivedAmount?: number;
  discountTotal?: number;
  idempotencyKey?: string;
  actorId: string;
  actorName?: string | null;
};

export type QuickSaleResult =
  | { success: true; orderId: string; changeAmount: number; total: number }
  | { success: false; error: string; code?: string };

export async function quickSale(input: QuickSaleInput): Promise<QuickSaleResult> {
  // Idempotência — se já existe pedido com essa chave, retorna ele
  if (input.idempotencyKey) {
    const existing = await prisma.order.findFirst({
      where: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) {
      return {
        success: true,
        orderId: existing.id,
        changeAmount: 0,
        total: Number(existing.total),
      };
    }
  }

  // Construir snapshots dos itens
  const snapshots = [];
  for (const rawItem of input.items) {
    const result = await buildOrderItem({
      organizationId: input.organizationId,
      productId: rawItem.productId,
      variantId: rawItem.variantId,
      locationId: input.locationId,
      channel: "POS",
      quantity: rawItem.quantity,
      discountAmount: rawItem.discountAmount,
      selectedOptionIds: rawItem.selectedOptionIds,
    });
    if (!result.success) {
      return { success: false, error: result.error, code: "BUILD_ITEM_FAILED" };
    }
    snapshots.push(result.item);
  }

  if (snapshots.length === 0) {
    return { success: false, error: "Pedido sem itens", code: "NO_ITEMS" };
  }

  // Calcular totais
  const subtotal = snapshots.reduce((s, i) => s + i.lineTotal, 0);
  const discountTotal = input.discountTotal ?? 0;
  const total = Math.max(0, subtotal - discountTotal);

  // Criar Order DRAFT
  const order = await prisma.order.create({
    data: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      channel: "POS",
      status: "DRAFT",
      customerId: input.customerId ?? null,
      cashSessionId: input.cashSessionId ?? null,
      subtotal,
      discountTotal,
      total,
      idempotencyKey: input.idempotencyKey ?? null,
      items: {
        create: snapshots.map((s) => ({
          productId: s.productId,
          variantId: s.variantId,
          productNameSnapshot: s.productNameSnapshot,
          skuSnapshot: s.skuSnapshot,
          unitSnapshot: s.unitSnapshot,
          unitPriceSnapshot: s.unitPriceSnapshot,
          costSnapshot: s.costSnapshot,
          taxSnapshot: s.taxSnapshot as never,
          productTypeSnapshot: s.productTypeSnapshot,
          quantity: s.quantity,
          discountAmount: s.discountAmount,
          lineTotal: s.lineTotal,
          isKit: s.isKit,
          selections: {
            create: s.selections.map((sel) => ({
              groupId: sel.groupId,
              optionId: sel.optionId,
              componentProductId: sel.componentProductId,
              componentVariantId: sel.componentVariantId,
              groupNameSnapshot: sel.groupNameSnapshot,
              optionNameSnapshot: sel.optionNameSnapshot,
              quantitySnapshot: sel.quantitySnapshot,
              priceDeltaSnapshot: sel.priceDeltaSnapshot,
            })),
          },
        })),
      },
      statusHistory: {
        create: {
          toStatus: "DRAFT",
          actorId: input.actorId,
          source: "INTERNAL",
        },
      },
    },
  });

  // CONFIRMED (reserva)
  const confirmResult = await confirmOrder({
    organizationId: input.organizationId,
    orderId: order.id,
    actorId: input.actorId,
    actorName: input.actorName,
  });
  if (!confirmResult.success) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELED", canceledReason: confirmResult.error, canceledAt: new Date() },
    });
    return { success: false, error: confirmResult.error, code: confirmResult.code };
  }

  // PAID (pagamento)
  const payResult = await registerPayment({
    organizationId: input.organizationId,
    orderId: order.id,
    method: input.paymentMethod,
    amount: total,
    receivedAmount: input.receivedAmount,
    actorId: input.actorId,
    actorName: input.actorName,
  });
  if (!payResult.success) {
    return { success: false, error: payResult.error, code: payResult.code };
  }

  // FULFILLED (baixa estoque)
  const fulfillResult = await fulfillOrder({
    organizationId: input.organizationId,
    orderId: order.id,
    actorId: input.actorId,
    actorName: input.actorName,
  });
  if (!fulfillResult.success) {
    return { success: false, error: fulfillResult.error, code: fulfillResult.code };
  }

  // Marcar COMPLETED (PDV: entregue na hora)
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", updatedAt: new Date() },
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: "FULFILLED",
        toStatus: "COMPLETED",
        actorId: input.actorId,
        source: "INTERNAL",
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "order.quick_sale",
    resourceType: "Order",
    resourceId: order.id,
    after: { total, channel: "POS", itemCount: snapshots.length },
  });

  return {
    success: true,
    orderId: order.id,
    changeAmount: payResult.changeAmount,
    total,
  };
}
