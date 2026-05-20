import { z } from "zod";

/* ── Common ───────────────────────────────────────────────────── */

const qtySchema = z.coerce
  .number()
  .positive("Quantidade deve ser positiva")
  .max(999_999, "Quantidade muito grande");

const costSchema = z.coerce.number().min(0, "Custo inválido").optional();

export const MOVEMENT_REASONS = [
  "PURCHASE", "SALE", "INVENTORY_COUNT", "DAMAGE",
  "EXPIRY", "THEFT", "TRANSFER", "MANUAL", "RETURN", "INITIAL",
] as const;
export type MovementReasonValue = typeof MOVEMENT_REASONS[number];

/* ── Inbound (entrada manual / recebimento) ───────────────────── */

export const inboundSchema = z.object({
  locationId:      z.string().min(1, "Local obrigatório"),
  productId:       z.string().min(1, "Produto obrigatório"),
  variantId:       z.string().optional().or(z.literal("")),
  quantity:        qtySchema,
  unitCost:        costSchema,
  lotCode:         z.string().max(50).optional().or(z.literal("")),
  expiryDate:      z.string().optional().or(z.literal("")),
  manufactureDate: z.string().optional().or(z.literal("")),
  reason:          z.enum(MOVEMENT_REASONS).default("PURCHASE"),
  note:            z.string().max(500).optional().or(z.literal("")),
  idempotencyKey:  z.string().max(128).optional().or(z.literal("")),
});
export type InboundInput = z.infer<typeof inboundSchema>;

/* ── Loss / Adjustment ────────────────────────────────────────── */

export const lossSchema = z.object({
  locationId: z.string().min(1),
  productId:  z.string().min(1),
  variantId:  z.string().optional().or(z.literal("")),
  lotId:      z.string().optional().or(z.literal("")),
  quantity:   qtySchema,
  reason:     z.enum(["DAMAGE", "EXPIRY", "THEFT", "MANUAL"] as const),
  note:       z.string().min(1, "Motivo obrigatório para perda").max(500),
});
export type LossInput = z.infer<typeof lossSchema>;

export const adjustmentSchema = z.object({
  locationId:      z.string().min(1),
  productId:       z.string().min(1),
  variantId:       z.string().optional().or(z.literal("")),
  lotId:           z.string().optional().or(z.literal("")),
  newQuantity:     z.coerce.number().min(0, "Saldo final não pode ser negativo"),
  reason:          z.enum(["INVENTORY_COUNT", "MANUAL"] as const).default("MANUAL"),
  note:            z.string().min(1, "Justificativa obrigatória").max(500),
  idempotencyKey:  z.string().max(128).optional().or(z.literal("")),
});
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

/* ── Transfer ────────────────────────────────────────────────── */

export const transferSchema = z.object({
  fromLocationId: z.string().min(1, "Local de origem obrigatório"),
  toLocationId:   z.string().min(1, "Local de destino obrigatório"),
  productId:      z.string().min(1),
  variantId:      z.string().optional().or(z.literal("")),
  lotId:          z.string().optional().or(z.literal("")),
  quantity:       qtySchema,
  note:           z.string().max(500).optional().or(z.literal("")),
  idempotencyKey: z.string().max(128).optional().or(z.literal("")),
}).refine(d => d.fromLocationId !== d.toLocationId, {
  message: "Origem e destino devem ser diferentes",
  path: ["toLocationId"],
});
export type TransferInput = z.infer<typeof transferSchema>;

/* ── Reservation ─────────────────────────────────────────────── */

export const reserveSchema = z.object({
  locationId:    z.string().min(1),
  productId:     z.string().min(1),
  variantId:     z.string().optional().or(z.literal("")),
  lotId:         z.string().optional().or(z.literal("")),
  quantity:      qtySchema,
  referenceType: z.string().min(1),
  referenceId:   z.string().min(1),
  expiresAt:     z.string().datetime().optional().or(z.literal("")),
});
export type ReserveInput = z.infer<typeof reserveSchema>;

/* ── Inventory Count ─────────────────────────────────────────── */

export const countItemSchema = z.object({
  productId:       z.string().min(1),
  variantId:       z.string().optional().or(z.literal("")),
  lotId:           z.string().optional().or(z.literal("")),
  systemQuantity:  z.coerce.number().min(0).default(0),
  countedQuantity: z.coerce.number().min(0, "Contagem não pode ser negativa"),
});
export type CountItemInput = z.infer<typeof countItemSchema>;

/* ── Threshold (estoque mínimo) ──────────────────────────────── */

export const thresholdSchema = z.object({
  locationId:  z.string().min(1),
  productId:   z.string().min(1),
  variantId:   z.string().optional().or(z.literal("")),
  minQuantity: z.coerce.number().min(0).optional(),
});
export type ThresholdInput = z.infer<typeof thresholdSchema>;
