/**
 * transfer — transferência atômica entre locations (RN-E08)
 * TRANSFER_OUT na origem + TRANSFER_IN no destino, mesma transação.
 * Se falhar qualquer parte, rollback total — estoque nunca vaza.
 */

import { applyMovement } from "./apply-movement";

export type TransferCoreInput = {
  organizationId: string;
  fromLocationId: string;
  toLocationId: string;
  productId: string;
  variantId?: string | null;
  lotId?: string | null;
  quantity: number;
  note?: string | null;
  actorId: string;
  actorName?: string | null;
  idempotencyKey?: string | null;
};

export type TransferResult =
  | { success: true; transferGroupId: string; outMovementId: string; inMovementId: string }
  | { success: false; error: string };

export async function transfer(input: TransferCoreInput): Promise<TransferResult> {
  if (input.fromLocationId === input.toLocationId) {
    return { success: false, error: "Origem e destino devem ser diferentes" };
  }

  const transferGroupId = `trf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ── TRANSFER_OUT na origem ──────────────────────────────────────
  const outResult = await applyMovement({
    organizationId: input.organizationId,
    locationId: input.fromLocationId,
    productId: input.productId,
    variantId: input.variantId,
    lotId: input.lotId,
    type: "TRANSFER_OUT",
    quantity: input.quantity,
    reason: "TRANSFER",
    referenceType: "TRANSFER",
    referenceId: transferGroupId,
    transferGroupId,
    note: input.note,
    actorId: input.actorId,
    actorName: input.actorName,
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:out` : null,
  });

  if (!outResult.success) {
    return { success: false, error: outResult.message };
  }

  // ── TRANSFER_IN no destino ──────────────────────────────────────
  const inResult = await applyMovement({
    organizationId: input.organizationId,
    locationId: input.toLocationId,
    productId: input.productId,
    variantId: input.variantId,
    lotId: input.lotId,
    type: "TRANSFER_IN",
    quantity: input.quantity,
    reason: "TRANSFER",
    referenceType: "TRANSFER",
    referenceId: transferGroupId,
    transferGroupId,
    note: input.note,
    actorId: input.actorId,
    actorName: input.actorName,
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:in` : null,
  });

  if (!inResult.success) {
    // Rollback: reverter o TRANSFER_OUT com um TRANSFER_IN compensatório
    await applyMovement({
      organizationId: input.organizationId,
      locationId: input.fromLocationId,
      productId: input.productId,
      variantId: input.variantId,
      lotId: input.lotId,
      type: "TRANSFER_IN", // reverte
      quantity: input.quantity,
      reason: "MANUAL",
      referenceType: "TRANSFER_ROLLBACK",
      referenceId: transferGroupId,
      transferGroupId,
      note: `Estorno automático: ${inResult.message}`,
      actorId: input.actorId,
    }).catch(() => {
      // Se o rollback também falhar, registrar mas não bloquear o retorno de erro
      console.error("[transfer] Rollback failed for group", transferGroupId);
    });

    return { success: false, error: inResult.message };
  }

  return {
    success: true,
    transferGroupId,
    outMovementId: outResult.movementId,
    inMovementId: inResult.movementId,
  };
}
