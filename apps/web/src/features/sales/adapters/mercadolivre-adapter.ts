/**
 * MercadoLivreAdapter — adaptador do canal Mercado Livre.
 * Anti-corruption: payload ML nunca vaza para o core (RN-V08).
 *
 * REGIME LOGÍSTICO (RN-V13):
 * - FULL:    Logística do ML. MarketOS NÃO baixa estoque local.
 * - FLEX:    MarketOS faz fulfillment. Reserva e baixa estoque normalmente.
 * - CLASSIC: MarketOS faz fulfillment. Reserva e baixa estoque normalmente.
 *
 * mappedStatus: "EXTERNAL_FULFILLED" = ML_FULL (skip fulfillment local)
 *
 * Referência: https://developers.mercadolivre.com.br/pt_br/gestao-de-pedidos
 */

import type { OrderStatus } from "@nohub/db";
import { ML_STATUS_MAP } from "../lib/can-transition";
import type {
  ChannelAdapter,
  NormalizedOrder,
  NormalizedOrderItem,
  AdapterResult,
  SyncProduct,
} from "./channel-adapter";
import crypto from "crypto";

/* ── Tipos do payload ML (anti-corruption: ficam aqui) ───────── */

interface MlOrderItem {
  item: {
    id:         string;
    title:      string;
    seller_sku?: string;
  };
  quantity:        number;
  unit_price:      number;
  full_unit_price: number;
  sale_fee?:       number;
}

interface MlBuyer {
  id:        number;
  nickname:  string;
  email?:    string;
  phone?:    { area_code: string; number: string };
  billing_info?: { doc_number?: string };
}

interface MlShipping {
  id:            number;
  status?:       string;
  logistic_type?: "fulfillment" | "self_service" | "not_specified" | string;
  receiver_address?: {
    street_name?:   string;
    street_number?: string;
    zip_code?:      string;
    city?:          { name: string };
    state?:         { name: string };
    comment?:       string;
  };
}

interface MlPayment {
  id:             number;
  status:         string;
  payment_method_id: string;
  total_paid_amount: number;
}

interface MlOrder {
  id:            number;
  status:        string;
  date_created?: string;
  date_closed?:  string;
  total_amount?:  number;
  order_items:    MlOrderItem[];
  buyer?:         MlBuyer;
  shipping?:      MlShipping;
  payments?:      MlPayment[];
  tags?:          string[];
}

/* ── Webhook notification (diferente do payload de pedido) ────── */

interface MlWebhookNotification {
  _id?:      string;
  resource:  string; // "/orders/1234567890"
  topic:     "orders_v2" | "payments" | "questions" | string;
  user_id:   number;
  received?: string;
  sent?:     string;
}

/* ── Adapter ─────────────────────────────────────────────────── */

export class MercadoLivreAdapter implements ChannelAdapter {
  /**
   * ML usa x-signature header com format: ts=<timestamp>,v1=<hmac>
   * Referência: https://developers.mercadolivre.com.br/pt_br/notificacoes#Validar-notifica%C3%A7%C3%B5es
   */
  verifySignature(
    payload: string,
    headers: Record<string, string>,
    secret: string,
  ): boolean {
    const sig = headers["x-signature"] ?? headers["X-Signature"];
    if (!sig) return false;

    // Parse "ts=<ts>,v1=<hash>"
    const parts: Record<string, string> = {};
    for (const part of sig.split(",")) {
      const [k, v] = part.split("=", 2);
      if (k && v) parts[k.trim()] = v.trim();
    }

    const ts      = parts["ts"];
    const v1      = parts["v1"];
    const xDataId = headers["x-request-id"] ?? "";

    if (!ts || !v1) return false;

    // Template: "id:<dataId>;request-id:<xDataId>;ts:<ts>;"
    // Se não há dataId, usa o payload bruto
    const manifest = `id:;request-id:${xDataId};ts:${ts};`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(v1,       "hex"),
        Buffer.from(expected, "hex"),
      );
    } catch {
      return false;
    }
  }

  /**
   * ML envia notificações leves (topic + resource path).
   * O pedido completo precisa ser buscado via API.
   * Este método aceita tanto o payload completo (para testes)
   * quanto o objeto de pedido já resolvido.
   */
  parseInbound(externalPayload: unknown): AdapterResult<NormalizedOrder> {
    try {
      // Aceita notificação leve ou pedido completo
      const notification = externalPayload as MlWebhookNotification;
      if (notification?.topic && notification?.resource) {
        // É uma notificação — só podemos mapear o ID do recurso
        const resourceId = notification.resource.split("/").pop() ?? "";
        return {
          success: false,
          error: `FETCH_REQUIRED:${resourceId}`, // sinal para o handler buscar o pedido
        };
      }

      // Pedido completo (já resolvido pelo handler)
      return this.parseFullOrder(externalPayload as MlOrder);
    } catch (err) {
      return {
        success: false,
        error: `Erro ao parsear payload ML: ${String(err)}`,
      };
    }
  }

  /** Parseia um MlOrder completo → NormalizedOrder */
  parseFullOrder(raw: MlOrder): AdapterResult<NormalizedOrder> {
    if (!raw?.id || !raw?.status) {
      return { success: false, error: "Payload ML inválido — campos obrigatórios ausentes" };
    }

    const mappedStatus: OrderStatus = ML_STATUS_MAP[raw.status] ?? "DRAFT";

    // Detectar regime logístico
    const logisticType = raw.shipping?.logistic_type ?? "not_specified";
    const isMlFull     = logisticType === "fulfillment"; // FULL: ML gerencia estoque

    const items: NormalizedOrderItem[] = raw.order_items.map((it) => ({
      externalId:    it.item.id,
      name:          it.item.title,
      quantity:      it.quantity,
      unitPrice:     it.unit_price,
      discountAmount: Math.max(0, it.full_unit_price - it.unit_price) * it.quantity,
      lineTotal:     it.unit_price * it.quantity,
    }));

    const phone = raw.buyer?.phone
      ? `${raw.buyer.phone.area_code}${raw.buyer.phone.number}`
      : undefined;

    const channelMetadata: Record<string, unknown> = {
      mlOrderId:     raw.id,
      mlStatus:      raw.status,
      logisticType,
      isMlFull,       // RN-V13: se true, não baixar estoque local
      shipping:      raw.shipping,
      payments:      raw.payments,
      mlTags:        raw.tags,
      dateClosed:    raw.date_closed,
      dateCreated:   raw.date_created,
    };

    return {
      success: true,
      data: {
        externalId:     String(raw.id),
        externalStatus: raw.status,
        // RN-V13: FULL → mappedStatus indica que fulfillment é externo
        mappedStatus:   isMlFull && mappedStatus === "FULFILLED" ? "COMPLETED" : mappedStatus,
        items,
        total:          raw.total_amount ?? items.reduce((s, i) => s + i.lineTotal, 0),
        channelMetadata,
        customerName:   raw.buyer?.nickname,
        customerPhone:  phone,
        customerDoc:    raw.buyer?.billing_info?.doc_number,
      },
    };
  }

  formatOutbound(order: {
    id: string;
    status: OrderStatus;
    channelMetadata: unknown;
  }): unknown {
    // ML não recebe push de status desta forma — atualizações são via API de shipping
    return {
      orderId: order.id,
      status:  order.status,
    };
  }

  /**
   * Sincroniza catálogo com o ML via API de itens.
   * Requer: access_token (OAuth2) + seller_id.
   * Endpoint: POST /items (criação) | PUT /items/{id} (atualização)
   */
  async syncCatalog(
    credentials: Record<string, unknown>,
    products: SyncProduct[],
  ): Promise<AdapterResult<{ synced: number; failed: number }>> {
    if (!credentials.accessToken || !credentials.sellerId) {
      return {
        success: false,
        error: "Credenciais ML não configuradas (accessToken + sellerId necessários)",
      };
    }

    // TODO: Implementar sync real
    // GET /users/{sellerId}/items/search → lista itens existentes por seller_sku
    // PUT /items/{id} → atualizar preço/estoque/disponibilidade
    // POST /items → criar novo item
    console.warn("[MercadoLivreAdapter.syncCatalog] Modo simulado — configure credenciais reais");
    return { success: true, data: { synced: products.length, failed: 0 } };
  }

  /**
   * Atualiza status do pedido no ML.
   * FLEX/CLASSIC: atualiza status do envio via API de shipping.
   * FULL: não há ação — ML gerencia.
   */
  async pushStatus(
    credentials: Record<string, unknown>,
    _orderId: string,
    externalOrderId: string,
    newStatus: OrderStatus,
    metadata?: Record<string, unknown>,
  ): Promise<AdapterResult<void>> {
    if (!credentials.accessToken) {
      return {
        success: false,
        error:   "Credenciais ML não configuradas",
        retryable: true,
      };
    }

    // FULL: ML gerencia logística, não há ação de push
    const isMlFull = metadata?.isMlFull as boolean | undefined;
    if (isMlFull) {
      return { success: true, data: undefined };
    }

    // Mapear status → ação ML
    const mlAction: Partial<Record<OrderStatus, { endpoint: string; body: unknown }>> = {
      FULFILLED: {
        endpoint: `/shipments/{shippingId}/fulfillment`,
        body:     { status: "shipped" },
      },
      COMPLETED: {
        endpoint: `/shipments/{shippingId}/fulfillment`,
        body:     { status: "delivered" },
      },
      CANCELED: {
        endpoint: `/orders/${externalOrderId}/feedback`,
        body:     { fulfilled: false },
      },
    };

    const action = mlAction[newStatus];
    if (!action) return { success: true, data: undefined };

    // TODO: Chamar API real
    // Substituir {shippingId} pelo ID do envio em metadata
    const shippingId = metadata?.mlShippingId as string | undefined;
    const url        = action.endpoint.replace("{shippingId}", shippingId ?? "");
    console.warn(
      `[MercadoLivreAdapter.pushStatus] Simulado — ${url}`,
      action.body,
    );

    return { success: true, data: undefined };
  }

  /* ── Helpers ML ──────────────────────────────────────────────── */

  /**
   * Verifica se o regime logístico requer fulfillment local.
   * FLEX e CLASSIC = MarketOS faz fulfillment.
   */
  static requiresLocalFulfillment(logisticType: string): boolean {
    return logisticType !== "fulfillment"; // FULL não requer local
  }

  /**
   * Constrói URL de autorização OAuth2 ML.
   * Redireciona o vendedor para conectar a conta.
   */
  static buildAuthUrl(appId: string, redirectUri: string): string {
    return (
      `https://auth.mercadolivre.com.br/authorization` +
      `?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    );
  }
}

export const mercadolivreAdapter = new MercadoLivreAdapter();
