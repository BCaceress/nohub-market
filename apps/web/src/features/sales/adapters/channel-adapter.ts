/**
 * ChannelAdapter — contrato que todo canal externo deve implementar.
 * Anti-corruption layer: payload externo morre aqui, nunca cruza para o core (RN-V08).
 *
 * Cada adapter tem:
 * - parseInbound: externo → Order interno (anti-corruption)
 * - formatOutbound: Order interno → payload externo
 * - syncCatalog: empurra catálogo para o canal
 * - pushStatus: informa o canal da mudança de estado
 * - verifySignature: valida que o webhook é legítimo
 */

import type { OrderStatus } from "@nohub/db";

/* ── Tipos canônicos internos ────────────────────────────────── */

export type NormalizedOrderItem = {
  externalId:    string;
  name:          string;
  quantity:      number;
  unitPrice:     number;
  discountAmount: number;
  lineTotal:     number;
  productId?:    string; // resolvido via ChannelProductMapping
  variantId?:    string;
};

export type NormalizedOrder = {
  externalId:      string;
  externalStatus:  string;
  mappedStatus:    OrderStatus;
  items:           NormalizedOrderItem[];
  total:           number;
  channelMetadata: Record<string, unknown>; // dados específicos do canal
  customerId?:     string;
  customerName?:   string;
  customerPhone?:  string;
  customerDoc?:    string;
};

export type SyncProduct = {
  productId:   string;
  variantId?:  string;
  name:        string;
  description?: string;
  price:       number;
  imageUrl?:   string;
  sku?:        string;
};

export type AdapterResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string; retryable?: boolean };

/* ── Interface ───────────────────────────────────────────────── */

export interface ChannelAdapter {
  /** Valida que o webhook é autêntico (assinatura HMAC, etc.) */
  verifySignature(
    payload: string,
    headers: Record<string, string>,
    secret: string,
  ): boolean;

  /** Externo → interno (anti-corruption: payload morre aqui) */
  parseInbound(
    externalPayload: unknown,
  ): AdapterResult<NormalizedOrder>;

  /** Interno → externo (para pushStatus e outros) */
  formatOutbound(
    order: { id: string; status: OrderStatus; channelMetadata: unknown },
  ): unknown;

  /** Empurra catálogo para o canal */
  syncCatalog(
    credentials: Record<string, unknown>,
    products: SyncProduct[],
  ): Promise<AdapterResult<{ synced: number; failed: number }>>;

  /** Informa o canal de mudança de estado */
  pushStatus(
    credentials: Record<string, unknown>,
    orderId: string,
    externalOrderId: string,
    newStatus: OrderStatus,
    metadata?: Record<string, unknown>,
  ): Promise<AdapterResult<void>>;
}
