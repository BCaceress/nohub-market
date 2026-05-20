"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { applyMovement } from "../lib/apply-movement";
import { countItemSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Iniciar contagem ────────────────────────────────────────── */

export async function startInventoryCountAction(
  organizationId: string,
  input: { locationId: string; note?: string },
): Promise<Result<{ countId: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  // Verifica se não há contagem ativa para este local
  const existing = await prisma.inventoryCount.findFirst({
    where: {
      organizationId,
      locationId: input.locationId,
      status: { in: ["DRAFT", "IN_PROGRESS"] },
    },
  });
  if (existing) {
    return { success: false, error: "Já existe uma contagem ativa para este local" };
  }

  // Cria a contagem e snapshot dos saldos atuais
  const balances = await prisma.stockBalance.findMany({
    where: { organizationId, locationId: input.locationId },
    select: {
      productId:      true,
      variantId:      true,
      lotId:          true,
      quantityOnHand: true,
    },
  });

  const count = await prisma.inventoryCount.create({
    data: {
      organizationId,
      locationId: input.locationId,
      status:     "IN_PROGRESS",
      startedBy:  session.user.id,
      note:       input.note || null,
      items: {
        create: balances.map((b) => ({
          productId:      b.productId,
          variantId:      b.variantId ?? null,
          lotId:          b.lotId ?? null,
          systemQuantity: b.quantityOnHand,
          countedQuantity: null,
        })),
      },
    },
  });

  await writeAudit({
    organizationId,
    actorId:      session.user.id,
    action:       "stock.count.start",
    resourceType: "InventoryCount",
    resourceId:   count.id,
    after: { locationId: input.locationId, itemCount: balances.length },
  });

  revalidatePath("/app/inventory/count");
  return { success: true, data: { countId: count.id } };
}

/* ── Adicionar / atualizar item contado ──────────────────────── */

export async function addCountItemAction(
  organizationId: string,
  countId: string,
  input: unknown,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = countItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  const count = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    select: { organizationId: true, status: true, locationId: true },
  });

  if (!count || count.organizationId !== organizationId) {
    return { success: false, error: "Contagem não encontrada" };
  }
  if (count.status === "CLOSED") {
    return { success: false, error: "Contagem já encerrada" };
  }

  await prisma.inventoryCountItem.upsert({
    where: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      countId_productId_variantId_lotId: {
        countId,
        productId: d.productId,
        variantId: (d.variantId ?? null) as unknown as string,
        lotId:     (d.lotId    ?? null) as unknown as string,
      },
    },
    create: {
      countId,
      productId:       d.productId,
      variantId:       d.variantId || null,
      lotId:           d.lotId    || null,
      systemQuantity:  d.systemQuantity,
      countedQuantity: d.countedQuantity,
    },
    update: {
      countedQuantity: d.countedQuantity,
    },
  });

  return { success: true, data: null };
}

/* ── Fechar contagem e gerar ajustes ─────────────────────────── */

export async function closeInventoryCountAction(
  organizationId: string,
  countId: string,
): Promise<Result<{ adjustmentsCreated: number }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const count = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    include: {
      items: true,
    },
  });

  if (!count || count.organizationId !== organizationId) {
    return { success: false, error: "Contagem não encontrada" };
  }
  if (count.status === "CLOSED") {
    return { success: false, error: "Contagem já encerrada" };
  }

  let adjustmentsCreated = 0;

  for (const item of count.items) {
    if (item.countedQuantity === null) continue; // item não contado → pular

    const counted = Number(item.countedQuantity);
    const system  = Number(item.systemQuantity);

    if (Math.abs(counted - system) < 0.001) continue; // sem divergência

    // Gera ADJUSTMENT com novo saldo absoluto (RN-E13)
    const result = await applyMovement({
      organizationId,
      locationId:     count.locationId,
      productId:      item.productId,
      variantId:      item.variantId,
      lotId:          item.lotId,
      type:           "ADJUSTMENT",
      quantity:       counted,
      reason:         "INVENTORY_COUNT",
      referenceType:  "InventoryCount",
      referenceId:    countId,
      note:           `Ajuste de contagem — sistema: ${system.toFixed(3)}, contado: ${counted.toFixed(3)}`,
      actorId:        session.user.id,
      actorName:      session.user.name,
    });

    if (result.success) {
      await prisma.inventoryCountItem.update({
        where: { id: item.id },
        data: { adjustmentMovementId: result.movementId },
      });
      adjustmentsCreated++;
    }
  }

  await prisma.inventoryCount.update({
    where: { id: countId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  await writeAudit({
    organizationId,
    actorId:      session.user.id,
    action:       "stock.count.close",
    resourceType: "InventoryCount",
    resourceId:   countId,
    after: { adjustmentsCreated },
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/inventory/count");
  return { success: true, data: { adjustmentsCreated } };
}

/* ── Queries ─────────────────────────────────────────────────── */

export async function getInventoryCountsAction(organizationId: string) {
  return prisma.inventoryCount.findMany({
    where: { organizationId },
    include: {
      location: { select: { id: true, name: true } },
      items:    { select: { id: true, countedQuantity: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
}

export async function getInventoryCountDetailAction(
  organizationId: string,
  countId: string,
) {
  const count = await prisma.inventoryCount.findUnique({
    where: { id: countId },
    include: {
      location: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: [{ product: { name: "asc" } }],
      },
    },
  });

  if (!count || count.organizationId !== organizationId) return null;

  return {
    ...count,
    items: count.items.map((item) => ({
      ...item,
      systemQuantity:  Number(item.systemQuantity),
      countedQuantity: item.countedQuantity !== null ? Number(item.countedQuantity) : null,
      divergence:
        item.countedQuantity !== null
          ? Number(item.countedQuantity) - Number(item.systemQuantity)
          : null,
    })),
  };
}
