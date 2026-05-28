/**
 * applyMovement — a função mais importante do módulo de estoque.
 *
 * Regras:
 * - RN-E01: saldo NUNCA é editado diretamente — apenas via movimento
 * - RN-E02: StockMovement é append-only (imutável)
 * - RN-E03: StockBalance é projeção reconstruível
 * - RN-E09: entrada recalcula custo médio móvel
 * - RN-E10: idempotencyKey evita duplicação em retry
 *
 * Executa tudo em UMA transação: movimento + saldo nunca divergem.
 */

import { prisma } from "@nohub/db";
import type { MovementReason, MovementType, Prisma } from "@nohub/db";

export type MovementInput = {
  organizationId: string;
  locationId: string;
  productId: string;
  variantId?: string | null;
  lotId?: string | null;
  type: MovementType;
  quantity: number; // sempre positivo — o type define o sinal
  unitCost?: number | null;
  reason?: MovementReason | null;
  referenceType?: string | null;
  referenceId?: string | null;
  transferGroupId?: string | null;
  idempotencyKey?: string | null;
  note?: string | null;
  actorId: string;
  actorName?: string | null;
};

export type MovementResult =
  | { success: true; movementId: string; balance: { onHand: number; reserved: number } }
  | {
      success: false;
      error: "DUPLICATE" | "INSUFFICIENT_STOCK" | "NEGATIVE_BALANCE" | "UNKNOWN";
      message: string;
    };

const OUTBOUND_TYPES: MovementType[] = ["OUT", "OUTBOUND", "LOSS", "TRANSFER_OUT"];
const INBOUND_TYPES: MovementType[] = ["IN", "INBOUND", "TRANSFER_IN"];
const RESERVE_TYPES: MovementType[] = ["RESERVATION"];
const RELEASE_TYPES: MovementType[] = ["RESERVATION_RELEASE"];

export async function applyMovement(input: MovementInput): Promise<MovementResult> {
  // ── 1. Idempotência ─────────────────────────────────────────────
  if (input.idempotencyKey) {
    const existing = await prisma.stockMovement.findFirst({
      where: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      const bal = await getBalance(input);
      return { success: true, movementId: existing.id, balance: bal };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── 2. Saldo atual ──────────────────────────────────────────
      const balanceKey = {
        organizationId: input.organizationId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        locationId: input.locationId,
        lotId: input.lotId ?? null,
      };

      const existing = await tx.stockBalance.findFirst({
        where: balanceKey,
      });

      const prevOnHand = Number(existing?.quantityOnHand ?? 0);
      const prevReserved = Number(existing?.quantityReserved ?? 0);
      const prevAvailable = prevOnHand - prevReserved;
      const prevCost = Number(existing?.averageCost ?? 0);

      let newOnHand = prevOnHand;
      let newReserved = prevReserved;
      let newCost = prevCost;

      const qty = Math.abs(input.quantity);

      if (OUTBOUND_TYPES.includes(input.type)) {
        // ── Verifica disponível (não bloqueado por reserva)
        if (input.type === "OUTBOUND" || input.type === "OUT") {
          if (prevAvailable < qty) {
            throw Object.assign(new Error("INSUFFICIENT_STOCK"), {
              code: "INSUFFICIENT_STOCK" as const,
            });
          }
        }
        if (newOnHand - qty < 0) {
          throw Object.assign(new Error("NEGATIVE_BALANCE"), {
            code: "NEGATIVE_BALANCE" as const,
          });
        }
        newOnHand -= qty;
      } else if (INBOUND_TYPES.includes(input.type)) {
        newOnHand += qty;
        // ── Custo médio móvel (RN-E09)
        if (input.unitCost !== null && input.unitCost !== undefined) {
          const totalValue = prevCost * prevOnHand + input.unitCost * qty;
          newCost = newOnHand > 0 ? totalValue / newOnHand : input.unitCost;
        }
      } else if (input.type === "ADJUSTMENT") {
        // quantity é o novo saldo absoluto para este tipo
        const diff = qty - prevOnHand;
        newOnHand = qty;
        // custo médio mantido se houve entrada; senão, mantém
        if (diff > 0 && input.unitCost) {
          const totalValue = prevCost * prevOnHand + input.unitCost * diff;
          newCost = newOnHand > 0 ? totalValue / newOnHand : input.unitCost;
        }
      } else if (RESERVE_TYPES.includes(input.type)) {
        if (prevAvailable < qty) {
          throw Object.assign(new Error("INSUFFICIENT_STOCK"), {
            code: "INSUFFICIENT_STOCK" as const,
          });
        }
        newReserved += qty;
      } else if (RELEASE_TYPES.includes(input.type)) {
        newReserved = Math.max(0, newReserved - qty);
      }

      // ── 3. Cria movimento (append-only) ─────────────────────────
      const movement = await tx.stockMovement.create({
        data: {
          organizationId: input.organizationId,
          locationId: input.locationId,
          productId: input.productId,
          variantId: input.variantId ?? null,
          lotId: input.lotId ?? null,
          type: input.type,
          quantity: qty,
          previousQty: prevOnHand,
          newQty: newOnHand,
          unitCost: input.unitCost ?? null,
          reason: input.reason ?? null,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          transferGroupId: input.transferGroupId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          note: input.note ?? null,
          userId: input.actorId,
          userName: input.actorName ?? null,
          notes: input.note ?? null,
        },
      });

      // ── 4. Atualiza saldo ────────────────────────────────────────
      // Não usa upsert porque Postgres trata NULL como distinto no
      // unique composto, e Prisma não aceita null em where compound key.
      if (existing) {
        await tx.stockBalance.update({
          where: { id: existing.id },
          data: {
            quantityOnHand: newOnHand,
            quantityReserved: newReserved,
            averageCost: newCost > 0 ? newCost : undefined,
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.stockBalance.create({
          data: {
            ...balanceKey,
            quantityOnHand: newOnHand,
            quantityReserved: newReserved,
            averageCost: newCost > 0 ? newCost : null,
          },
        });
      }

      return { movementId: movement.id, onHand: newOnHand, reserved: newReserved };
    });

    return {
      success: true,
      movementId: result.movementId,
      balance: { onHand: result.onHand, reserved: result.reserved },
    };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === "INSUFFICIENT_STOCK") {
      return {
        success: false,
        error: "INSUFFICIENT_STOCK",
        message: "Estoque disponível insuficiente",
      };
    }
    if (e.code === "NEGATIVE_BALANCE") {
      return {
        success: false,
        error: "NEGATIVE_BALANCE",
        message: "Saldo não pode ficar negativo",
      };
    }
    console.error("[applyMovement]", err);
    return { success: false, error: "UNKNOWN", message: String(e.message ?? "Erro interno") };
  }
}

/* ── Helper: lê saldo atual ─────────────────────────────────────── */
async function getBalance(
  input: Pick<MovementInput, "organizationId" | "productId" | "variantId" | "locationId" | "lotId">,
) {
  const b = await prisma.stockBalance.findFirst({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      locationId: input.locationId,
      lotId: input.lotId ?? null,
    },
  });
  return {
    onHand: Number(b?.quantityOnHand ?? 0),
    reserved: Number(b?.quantityReserved ?? 0),
  };
}
