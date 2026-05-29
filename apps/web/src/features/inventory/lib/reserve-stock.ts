/**
 * Reservas de estoque — anti-oversell (RN-E07)
 *
 * reserveStock         — cria reserva; falha se disponível insuficiente
 * releaseReservation   — libera reserva (pedido cancelado)
 * consumeReservation   — converte reserva em OUTBOUND definitivo (pedido confirmado)
 */

import { prisma } from "@nohub/db";
import { applyMovement } from "./apply-movement";

/* ── Reservar ──────────────────────────────────────────────────── */

export type ReserveStockInput = {
  organizationId: string;
  locationId: string;
  productId: string;
  variantId?: string | null;
  lotId?: string | null;
  quantity: number;
  referenceType: string;
  referenceId: string;
  expiresAt?: Date | null;
  actorId: string;
  actorName?: string | null;
};

export type ReserveResult =
  | { success: true; reservationId: string }
  | { success: false; error: string };

export async function reserveStock(input: ReserveStockInput): Promise<ReserveResult> {
  // Criar movimento RESERVATION (reduz disponível sem alterar físico)
  const mvResult = await applyMovement({
    organizationId: input.organizationId,
    locationId: input.locationId,
    productId: input.productId,
    variantId: input.variantId,
    lotId: input.lotId,
    type: "RESERVATION",
    quantity: input.quantity,
    reason: "SALE",
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    actorId: input.actorId,
    actorName: input.actorName,
  });

  if (!mvResult.success) {
    return { success: false, error: mvResult.message };
  }

  // Registrar na tabela StockReservation (consulta rápida por referência)
  const reservation = await prisma.stockReservation.create({
    data: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      lotId: input.lotId ?? null,
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      status: "ACTIVE",
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { success: true, reservationId: reservation.id };
}

/* ── Liberar reserva ───────────────────────────────────────────── */

export async function releaseReservation(
  reservationId: string,
  actorId: string,
  actorName?: string,
): Promise<{ success: boolean; error?: string }> {
  const reservation = await prisma.stockReservation.findUnique({
    where: { id: reservationId },
  });

  if (reservation?.status !== "ACTIVE") {
    return { success: false, error: "Reserva não encontrada ou já encerrada" };
  }

  const mvResult = await applyMovement({
    organizationId: reservation.organizationId,
    locationId: reservation.locationId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    lotId: reservation.lotId,
    type: "RESERVATION_RELEASE",
    quantity: Number(reservation.quantity),
    reason: "MANUAL",
    referenceType: reservation.referenceType,
    referenceId: reservation.referenceId,
    actorId,
    actorName,
  });

  if (!mvResult.success) {
    return { success: false, error: mvResult.message };
  }

  await prisma.stockReservation.update({
    where: { id: reservationId },
    data: { status: "RELEASED", resolvedAt: new Date() },
  });

  return { success: true };
}

/* ── Consumir reserva (confirmar pedido) ───────────────────────── */

export async function consumeReservation(
  reservationId: string,
  actorId: string,
  actorName?: string,
): Promise<{ success: boolean; error?: string }> {
  const reservation = await prisma.stockReservation.findUnique({
    where: { id: reservationId },
  });

  if (reservation?.status !== "ACTIVE") {
    return { success: false, error: "Reserva não encontrada ou já encerrada" };
  }

  // 1. Liberar reserva (restaura o reservado)
  const releaseResult = await applyMovement({
    organizationId: reservation.organizationId,
    locationId: reservation.locationId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    lotId: reservation.lotId,
    type: "RESERVATION_RELEASE",
    quantity: Number(reservation.quantity),
    reason: "SALE",
    referenceType: reservation.referenceType,
    referenceId: reservation.referenceId,
    actorId,
    actorName,
  });

  if (!releaseResult.success) {
    return { success: false, error: releaseResult.message };
  }

  // 2. Criar OUTBOUND definitivo (baixa o físico)
  const outResult = await applyMovement({
    organizationId: reservation.organizationId,
    locationId: reservation.locationId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    lotId: reservation.lotId,
    type: "OUTBOUND",
    quantity: Number(reservation.quantity),
    reason: "SALE",
    referenceType: reservation.referenceType,
    referenceId: reservation.referenceId,
    actorId,
    actorName,
  });

  if (!outResult.success) {
    return { success: false, error: outResult.message };
  }

  await prisma.stockReservation.update({
    where: { id: reservationId },
    data: { status: "CONSUMED", resolvedAt: new Date() },
  });

  return { success: true };
}
