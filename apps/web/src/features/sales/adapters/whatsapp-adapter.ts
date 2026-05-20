/**
 * WhatsAppAdapter — adaptador do canal WhatsApp (Meta Cloud API / BSP).
 * Anti-corruption: payload Meta nunca vaza para o core (RN-V08).
 *
 * Fluxo conversacional: o pedido é construído ao longo da conversa.
 * Webhooks Meta: POST com array de entries/changes/messages.
 * Templates: mensagens proativas precisam de template aprovado pela Meta.
 *
 * Referência: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import type { OrderStatus } from "@nohub/db";
import crypto from "crypto";
import type {
  ChannelAdapter,
  NormalizedOrder,
  AdapterResult,
  SyncProduct,
} from "./channel-adapter";

/* ── Tipos do payload Meta (anti-corruption: ficam aqui) ─────── */

interface MetaWaMessage {
  id:        string;
  from:      string; // phone number
  timestamp: string;
  type:      "text" | "interactive" | "order" | string;
  text?:     { body: string };
  order?:    MetaWaOrder;
  interactive?: {
    type:        "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?:   { id: string; title: string };
  };
}

interface MetaWaOrderProduct {
  product_retailer_id: string;
  quantity:            number;
  item_price:          number;
  currency:            string;
}

interface MetaWaOrder {
  catalog_id?:     string;
  text?:           string;
  product_items:   MetaWaOrderProduct[];
}

interface MetaWaContact {
  wa_id:   string;
  profile: { name: string };
}

interface MetaWaWebhookEntry {
  id:      string;
  changes: Array<{
    value: {
      messaging_product: "whatsapp";
      metadata:   { display_phone_number: string; phone_number_id: string };
      contacts?:  MetaWaContact[];
      messages?:  MetaWaMessage[];
      statuses?:  Array<{ id: string; status: string; timestamp: string }>;
    };
    field: string;
  }>;
}

interface MetaWebhookPayload {
  object:  "whatsapp_business_account";
  entry:   MetaWaWebhookEntry[];
}

/* ── Adapter ─────────────────────────────────────────────────── */

export class WhatsAppAdapter implements ChannelAdapter {
  /**
   * Valida assinatura Meta: X-Hub-Signature-256 = sha256=<hmac>
   * Referência: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
   */
  verifySignature(
    payload: string,
    headers: Record<string, string>,
    secret: string,
  ): boolean {
    const raw =
      headers["x-hub-signature-256"] ?? headers["X-Hub-Signature-256"] ?? "";
    if (!raw.startsWith("sha256=")) return false;
    const received = raw.slice("sha256=".length);
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(received, "hex"),
        Buffer.from(expected, "hex"),
      );
    } catch {
      return false;
    }
  }

  /**
   * Parseia webhook Meta → NormalizedOrder.
   * WhatsApp envia mensagens de pedido via type="order" (catálogo nativo)
   * ou via fluxo conversacional — aqui tratamos o caso de pedido nativo.
   * Fluxos conversacionais montam o pedido gradualmente via bot (fora deste adapter).
   */
  parseInbound(externalPayload: unknown): AdapterResult<NormalizedOrder> {
    try {
      const raw = externalPayload as MetaWebhookPayload;

      if (!raw?.entry?.length) {
        return { success: false, error: "Payload WhatsApp inválido — sem entries" };
      }

      // Extrair primeira mensagem do tipo order
      let message:  MetaWaMessage  | undefined;
      let contact:  MetaWaContact  | undefined;
      let phoneNumberId: string    | undefined;

      for (const entry of raw.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") continue;
          const val = change.value;
          phoneNumberId = val.metadata.phone_number_id;
          const msg = (val.messages ?? []).find((m) => m.type === "order");
          if (msg) {
            message = msg;
            contact = val.contacts?.[0];
            break;
          }
        }
        if (message) break;
      }

      if (!message?.order) {
        return {
          success: false,
          error: "Nenhuma mensagem de pedido encontrada no payload WhatsApp",
        };
      }

      const waOrder = message.order;
      const items = waOrder.product_items.map((p) => ({
        externalId:    p.product_retailer_id,
        name:          p.product_retailer_id, // nome resolvido via ChannelProductMapping
        quantity:      p.quantity,
        unitPrice:     p.item_price,
        discountAmount: 0,
        lineTotal:     p.item_price * p.quantity,
      }));

      const total = items.reduce((s, i) => s + i.lineTotal, 0);

      const channelMetadata: Record<string, unknown> = {
        messageId:     message.id,
        waFrom:        message.from,
        timestamp:     message.timestamp,
        catalogId:     waOrder.catalog_id,
        phoneNumberId,
        orderText:     waOrder.text,
        rawProducts:   waOrder.product_items,
      };

      return {
        success: true,
        data: {
          externalId:     message.id,
          externalStatus: "PLACED",
          mappedStatus:   "DRAFT", // WA orders always start as DRAFT (needs confirmation)
          items,
          total,
          channelMetadata,
          customerName:   contact?.profile.name,
          customerPhone:  message.from,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Erro ao parsear payload WhatsApp: ${String(err)}`,
      };
    }
  }

  /**
   * Formata mensagem de saída para o cliente via WhatsApp.
   * Usa template aprovado pela Meta ou mensagem de texto simples (dentro da janela 24h).
   */
  formatOutbound(order: {
    id: string;
    status: OrderStatus;
    channelMetadata: unknown;
  }): unknown {
    const meta = order.channelMetadata as Record<string, unknown> | null;
    const to   = meta?.waFrom as string | undefined;

    // Mapeamento status → mensagem amigável
    const statusMessages: Partial<Record<OrderStatus, string>> = {
      CONFIRMED:  "✅ Pedido confirmado! Estamos preparando seu pedido.",
      FULFILLED:  "🚚 Seu pedido saiu para entrega!",
      COMPLETED:  "🎉 Pedido concluído! Obrigado pela preferência.",
      CANCELED:   "❌ Seu pedido foi cancelado. Entre em contato para mais informações.",
    };

    return {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: statusMessages[order.status] ?? `Pedido ${order.id} — status: ${order.status}`,
      },
    };
  }

  /**
   * Sincroniza catálogo com o catálogo do WhatsApp Business.
   * Requer: Graph API token + catalog_id configurados em ChannelIntegration.
   * Endpoint: POST /{catalog_id}/products
   */
  async syncCatalog(
    credentials: Record<string, unknown>,
    products: SyncProduct[],
  ): Promise<AdapterResult<{ synced: number; failed: number }>> {
    if (!credentials.accessToken || !credentials.catalogId) {
      return {
        success: false,
        error: "Credenciais WhatsApp não configuradas (accessToken + catalogId necessários)",
      };
    }

    // TODO: Implementar sync real via Graph API
    // POST https://graph.facebook.com/v18.0/{catalogId}/products
    // Body: { retailer_id, name, description, price, currency, availability, url }
    console.warn("[WhatsAppAdapter.syncCatalog] Modo simulado — configure credenciais reais");
    return { success: true, data: { synced: products.length, failed: 0 } };
  }

  /**
   * Envia mensagem de status para o cliente via WhatsApp.
   * WhatsApp não tem endpoint de "status de pedido" — é uma mensagem de texto/template.
   */
  async pushStatus(
    credentials: Record<string, unknown>,
    _orderId: string,
    _externalOrderId: string,
    newStatus: OrderStatus,
    metadata?: Record<string, unknown>,
  ): Promise<AdapterResult<void>> {
    if (!credentials.accessToken || !credentials.phoneNumberId) {
      return {
        success: false,
        error:   "Credenciais WhatsApp não configuradas",
        retryable: true,
      };
    }

    const to = metadata?.waFrom as string | undefined;
    if (!to) {
      // Sem número de destino — não é possível enviar, mas não é falha retryable
      return { success: true, data: undefined };
    }

    // TODO: Chamar API real
    // POST https://graph.facebook.com/v18.0/{phoneNumberId}/messages
    const body = this.formatOutbound({
      id:              _orderId,
      status:          newStatus,
      channelMetadata: metadata ?? null,
    });

    console.warn(
      `[WhatsAppAdapter.pushStatus] Simulado — enviaria para ${to}:`,
      body,
    );

    return { success: true, data: undefined };
  }

  /* ── Helpers WhatsApp ────────────────────────────────────────── */

  /**
   * Extrai todas as mensagens de um webhook para processamento.
   * Útil no handler do webhook para iterar todas as mensagens.
   */
  static extractMessages(payload: unknown): MetaWaMessage[] {
    const raw = payload as MetaWebhookPayload;
    const messages: MetaWaMessage[] = [];
    for (const entry of raw?.entry ?? []) {
      for (const change of entry.changes) {
        if (change.field === "messages") {
          messages.push(...(change.value.messages ?? []));
        }
      }
    }
    return messages;
  }

  /**
   * Verifica se é um evento de verificação do webhook Meta (GET).
   * Usado no route handler para responder ao hub.challenge.
   */
  static verifyWebhook(
    mode: string | null,
    token: string | null,
    challenge: string | null,
    appSecret: string,
  ): string | null {
    if (mode === "subscribe" && token === appSecret) {
      return challenge;
    }
    return null;
  }
}

export const whatsappAdapter = new WhatsAppAdapter();
