"use server";

import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import {
  reserveStock,
  releaseReservation,
  consumeReservation,
} from "../lib/reserve-stock";
import { reserveSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

export async function reserveForOrderAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ reservationId: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = reserveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  const result = await reserveStock({
    organizationId,
    locationId:    d.locationId,
    productId:     d.productId,
    variantId:     d.variantId || null,
    lotId:         d.lotId    || null,
    quantity:      d.quantity,
    referenceType: d.referenceType,
    referenceId:   d.referenceId,
    expiresAt:     d.expiresAt ? new Date(d.expiresAt) : null,
    actorId:       session.user.id,
    actorName:     session.user.name,
  });

  if (!result.success) return { success: false, error: result.error };

  revalidatePath("/app/inventory");
  return { success: true, data: { reservationId: result.reservationId } };
}

export async function releaseOrderReservationAction(
  organizationId: string,
  reservationId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  // Verify reservation belongs to org
  const reservation = await prisma.stockReservation.findUnique({
    where: { id: reservationId },
    select: { organizationId: true },
  });
  if (!reservation || reservation.organizationId !== organizationId) {
    return { success: false, error: "Reserva não encontrada" };
  }

  const result = await releaseReservation(reservationId, session.user.id, session.user.name);
  if (!result.success) return { success: false, error: result.error ?? "Erro ao liberar reserva" };

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}

export async function consumeOrderReservationAction(
  organizationId: string,
  reservationId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const reservation = await prisma.stockReservation.findUnique({
    where: { id: reservationId },
    select: { organizationId: true },
  });
  if (!reservation || reservation.organizationId !== organizationId) {
    return { success: false, error: "Reserva não encontrada" };
  }

  const result = await consumeReservation(reservationId, session.user.id, session.user.name);
  if (!result.success) return { success: false, error: result.error ?? "Erro ao consumir reserva" };

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}

export async function getReservationsAction(
  organizationId: string,
  opts: { referenceType?: string; referenceId?: string; productId?: string } = {},
) {
  return prisma.stockReservation.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      ...(opts.referenceType ? { referenceType: opts.referenceType } : {}),
      ...(opts.referenceId   ? { referenceId:   opts.referenceId   } : {}),
      ...(opts.productId     ? { productId:      opts.productId     } : {}),
    },
    include: {
      product:  { select: { id: true, name: true, sku: true } },
      variant:  { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
