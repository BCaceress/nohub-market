"use server";

/**
 * Server Actions — Orders.
 * Validação de input com Zod + chamadas às lib functions do core.
 */

import { prisma } from "@nohub/db";
import type { OrderChannel, OrderStatus } from "@nohub/db";
import { z } from "zod";
import { cancelOrder } from "../lib/cancel-order";
import { confirmOrder } from "../lib/confirm-order";
import { fulfillOrder } from "../lib/fulfill-order";
import { quickSale } from "../lib/quick-sale";
import { enqueuePushStatus } from "../outbox/producer";

/* ── Schemas ─────────────────────────────────────────────────── */

const quickSaleSchema = z.object({
  organizationId: z.string(),
  locationId: z.string(),
  cashSessionId: z.string().optional(),
  customerId: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string().nullish(),
        quantity: z.coerce.number().int().min(1),
        discountAmount: z.coerce.number().min(0).optional(),
      }),
    )
    .min(1),
  paymentMethod: z.enum([
    "CASH",
    "PIX_MANUAL",
    "PIX_DYNAMIC",
    "CARD_PRESENT",
    "CARD_ONLINE",
    "VOUCHER",
  ]),
  receivedAmount: z.coerce.number().min(0).optional(),
  discountTotal: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().optional(),
  actorId: z.string(),
  actorName: z.string().nullish(),
});

const cancelOrderSchema = z.object({
  organizationId: z.string(),
  orderId: z.string(),
  reason: z.string().min(1),
  actorId: z.string(),
  actorName: z.string().nullish(),
});

/* ── Actions ─────────────────────────────────────────────────── */

export async function quickSaleAction(input: z.infer<typeof quickSaleSchema>) {
  const parsed = quickSaleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  return quickSale(parsed.data);
}

export async function confirmOrderAction(
  organizationId: string,
  orderId: string,
  actorId: string,
  actorName?: string | null,
) {
  return confirmOrder({ organizationId, orderId, actorId, actorName });
}

export async function fulfillOrderAction(
  organizationId: string,
  orderId: string,
  actorId: string,
  actorName?: string | null,
) {
  const result = await fulfillOrder({ organizationId, orderId, actorId, actorName });
  if (result.success) {
    // Enfileirar push de status para canal externo, se houver
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { channel: true, externalId: true, channelMetadata: true },
    });
    if (order?.externalId && order.channel !== "POS" && order.channel !== "SELF_SERVICE") {
      await enqueuePushStatus(
        organizationId,
        order.channel,
        orderId,
        order.externalId,
        "FULFILLED",
        (order.channelMetadata as Record<string, unknown> | null) ?? {},
      );
    }
  }
  return result;
}

export async function cancelOrderAction(input: z.infer<typeof cancelOrderSchema>) {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }

  const result = await cancelOrder(parsed.data);
  if (result.success) {
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: { channel: true, externalId: true, channelMetadata: true },
    });
    if (order?.externalId && order.channel !== "POS" && order.channel !== "SELF_SERVICE") {
      await enqueuePushStatus(
        parsed.data.organizationId,
        order.channel,
        parsed.data.orderId,
        order.externalId,
        "CANCELED",
        (order.channelMetadata as Record<string, unknown> | null) ?? {},
      );
    }
  }
  return result;
}

/* ── Queries ─────────────────────────────────────────────────── */

export type OrderFilters = {
  status?: OrderStatus;
  channel?: OrderChannel;
  locationId?: string;
  from?: string; // ISO date
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getOrdersAction(organizationId: string, filters: OrderFilters = {}) {
  const { status, channel, locationId, from, to, search, page = 1, pageSize = 20 } = filters;
  const skip = (page - 1) * pageSize;

  const where = {
    organizationId,
    ...(status && { status }),
    ...(channel && { channel }),
    ...(locationId && { locationId }),
    ...(from && { createdAt: { gte: new Date(from) } }),
    ...(to && { createdAt: { lte: new Date(to) } }),
    ...(search && {
      OR: [
        { externalId: { contains: search, mode: "insensitive" as const } },
        { customer: { name: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        customer: { select: { name: true, phone: true } },
        payments: { select: { method: true, amount: true, status: true } },
        items: { select: { productNameSnapshot: true, quantity: true, lineTotal: true }, take: 3 },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getOrderAction(organizationId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      payments: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      cashSession: { select: { id: true, operatorId: true } },
      location: { select: { id: true, name: true } },
    },
  });

  if (!order || order.organizationId !== organizationId) return null;
  return order;
}
