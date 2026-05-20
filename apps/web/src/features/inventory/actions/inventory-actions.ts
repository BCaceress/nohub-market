"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { applyMovement } from "../lib/apply-movement";
import { pickFEFO } from "../lib/pick-fefo";
import { inboundSchema, lossSchema, adjustmentSchema } from "../schemas";

/* ── RBAC ────────────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Queries ─────────────────────────────────────────────────── */

export async function getBalanceSummaryAction(organizationId: string, locationId?: string) {
  const rows = await prisma.stockBalance.findMany({
    where: {
      organizationId,
      ...(locationId ? { locationId } : {}),
    },
    include: {
      product:  { select: { id: true, name: true, sku: true, unit: true, isActive: true, productType: true } },
      variant:  { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      lot:      { select: { id: true, code: true, expiryDate: true } },
    },
    orderBy: [{ product: { name: "asc" } }, { location: { name: "asc" } }],
  });

  return rows.map((r) => ({
    ...r,
    quantityOnHand:   Number(r.quantityOnHand),
    quantityReserved: Number(r.quantityReserved),
    quantityAvailable: Math.max(0, Number(r.quantityOnHand) - Number(r.quantityReserved)),
    averageCost:      r.averageCost ? Number(r.averageCost) : null,
    minQuantity:      r.minQuantity ? Number(r.minQuantity) : null,
  }));
}

export async function getMovementsAction(
  organizationId: string,
  opts: {
    locationId?: string;
    productId?:  string;
    variantId?:  string;
    type?:       string;
    reason?:     string;
    from?:       Date;
    to?:         Date;
    take?:       number;
    skip?:       number;
  } = {},
) {
  const where = {
    organizationId,
    ...(opts.locationId ? { locationId: opts.locationId } : {}),
    ...(opts.productId  ? { productId:  opts.productId  } : {}),
    ...(opts.variantId  ? { variantId:  opts.variantId  } : {}),
    ...(opts.type       ? { type:       opts.type as never } : {}),
    ...(opts.reason     ? { reason:     opts.reason as never } : {}),
    ...((opts.from || opts.to)
      ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {}),
  };

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        product:  { select: { id: true, name: true, unit: true } },
        variant:  { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        lot:      { select: { id: true, code: true, expiryDate: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
    }),
  ]);

  return {
    total,
    movements: movements.map((m) => ({
      ...m,
      quantity:    Number(m.quantity),
      previousQty: Number(m.previousQty),
      newQty:      Number(m.newQty),
      unitCost:    m.unitCost ? Number(m.unitCost) : null,
    })),
  };
}

export async function getLotsAction(organizationId: string, productId?: string) {
  return prisma.stockLot.findMany({
    where: {
      organizationId,
      ...(productId ? { productId } : {}),
      isActive: true,
    },
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
    },
    orderBy: [{ expiryDate: "asc" }, { code: "asc" }],
  });
}

export async function getAlertsAction(organizationId: string) {
  const [lowStock, expiring] = await Promise.all([
    // Estoque abaixo do mínimo
    prisma.stockBalance.findMany({
      where: {
        organizationId,
        minQuantity: { not: null },
      },
      include: {
        product:  { select: { id: true, name: true, sku: true } },
        variant:  { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    }).then((rows) =>
      rows.filter((r) => r.minQuantity !== null && Number(r.quantityOnHand) <= Number(r.minQuantity))
    ),

    // Lotes vencendo em 30 dias
    prisma.stockLot.findMany({
      where: {
        organizationId,
        isActive: true,
        expiryDate: {
          not: null,
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
      },
      include: {
        product: { select: { id: true, name: true } },
        variant: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: 20,
    }),
  ]);

  return {
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.slice(0, 10).map(r => ({
      ...r,
      quantityOnHand:   Number(r.quantityOnHand),
      quantityReserved: Number(r.quantityReserved),
      minQuantity:      Number(r.minQuantity),
    })),
    expiringCount: expiring.length,
    expiringItems: expiring,
  };
}

/* ── Entrada manual (INBOUND) ────────────────────────────────── */

export async function registerInboundAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ movementId: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = inboundSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  // Resolver lote (criar se não existir)
  let lotId: string | null = null;
  if (d.lotCode) {
    const lot = await prisma.stockLot.upsert({
      where: { organizationId_productId_code: { organizationId, productId: d.productId, code: d.lotCode } },
      create: {
        organizationId,
        productId:       d.productId,
        variantId:       d.variantId || null,
        code:            d.lotCode,
        expiryDate:      d.expiryDate ? new Date(d.expiryDate) : null,
        manufactureDate: d.manufactureDate ? new Date(d.manufactureDate) : null,
      },
      update: {
        ...(d.expiryDate ? { expiryDate: new Date(d.expiryDate) } : {}),
      },
    });
    lotId = lot.id;
  }

  const result = await applyMovement({
    organizationId,
    locationId:     d.locationId,
    productId:      d.productId,
    variantId:      d.variantId || null,
    lotId,
    type:           "INBOUND",
    quantity:       d.quantity,
    unitCost:       d.unitCost ?? null,
    reason:         d.reason as never,
    note:           d.note || null,
    idempotencyKey: d.idempotencyKey || null,
    actorId:        session.user.id,
    actorName:      session.user.name,
  });

  if (!result.success) return { success: false, error: result.message };

  await writeAudit({
    organizationId,
    actorId:      session.user.id,
    action:       "stock.inbound",
    resourceType: "StockMovement",
    resourceId:   result.movementId,
    after: { productId: d.productId, locationId: d.locationId, quantity: d.quantity, lotCode: d.lotCode },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: { movementId: result.movementId } };
}

/* ── Perda / quebra ──────────────────────────────────────────── */

export async function registerLossAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ movementId: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = lossSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  // FEFO: escolhe de quais lotes tirar
  const fefo = await pickFEFO({
    organizationId,
    productId:  d.productId,
    variantId:  d.variantId || null,
    locationId: d.locationId,
    quantity:   d.quantity,
  });

  if (!fefo.success) {
    return { success: false, error: `Estoque insuficiente (disponível: ${fefo.available.toFixed(3)})` };
  }

  let lastMovementId = "";

  for (const alloc of fefo.allocations) {
    const result = await applyMovement({
      organizationId,
      locationId: d.locationId,
      productId:  d.productId,
      variantId:  d.variantId || null,
      lotId:      alloc.lotId,
      type:       "LOSS",
      quantity:   alloc.quantity,
      reason:     d.reason as never,
      note:       d.note,
      actorId:    session.user.id,
      actorName:  session.user.name,
    });

    if (!result.success) return { success: false, error: result.message };
    lastMovementId = result.movementId;
  }

  await writeAudit({
    organizationId,
    actorId:      session.user.id,
    action:       "stock.loss",
    resourceType: "StockMovement",
    resourceId:   lastMovementId,
    after: { productId: d.productId, locationId: d.locationId, quantity: d.quantity, reason: d.reason },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: { movementId: lastMovementId } };
}

/* ── Ajuste manual (ADJUSTMENT) ──────────────────────────────── */

export async function registerAdjustmentAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ movementId: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  const result = await applyMovement({
    organizationId,
    locationId:     d.locationId,
    productId:      d.productId,
    variantId:      d.variantId || null,
    lotId:          d.lotId || null,
    type:           "ADJUSTMENT",
    quantity:       d.newQuantity, // para ADJUSTMENT, quantity = novo saldo
    reason:         d.reason as never,
    note:           d.note,
    idempotencyKey: d.idempotencyKey || null,
    actorId:        session.user.id,
    actorName:      session.user.name,
  });

  if (!result.success) return { success: false, error: result.message };

  await writeAudit({
    organizationId,
    actorId:      session.user.id,
    action:       "stock.adjustment",
    resourceType: "StockMovement",
    resourceId:   result.movementId,
    after: { productId: d.productId, locationId: d.locationId, newQuantity: d.newQuantity, reason: d.reason },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: { movementId: result.movementId } };
}

/* ── Atualizar limiar de alerta ──────────────────────────────── */

export async function updateMinQuantityAction(
  organizationId: string,
  input: { locationId: string; productId: string; variantId?: string; minQuantity: number | null },
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.stockBalance.updateMany({
    where: {
      organizationId,
      locationId: input.locationId,
      productId:  input.productId,
      variantId:  input.variantId ?? null,
    },
    data: { minQuantity: input.minQuantity },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}
