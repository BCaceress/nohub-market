/**
 * iFoodAdapter — adaptador do canal iFood.
 * Anti-corruption: payload iFood nunca vaza para o core (RN-V08).
 *
 * HOMOLOGAÇÃO: este canal requer processo de homologação iFood antes do go-live.
 * Em sandbox, usar credenciais do Portal do Desenvolvedor iFood.
 *
 * Referência: https://developer.ifood.com.br/docs/introduction
 */

import type { OrderStatus } from "@nohub/db";
import { IFOOD_STATUS_MAP } from "../lib/can-transition";
import type {
  ChannelAdapter,
  NormalizedOrder,
  NormalizedOrderItem,
  AdapterResult,
  SyncProduct,
} from "./channel-adapter";
import crypto from "crypto";

/* ── Tipos do payload iFood (anti-corruption: ficam aqui) ────── */

interface IfoodOrderItem {
  externalCode: string;
  name:         string;
  quantity:     number;
  unitPrice:    number;
  discount?:    number;
  totalPrice:   number;
}

interface IfoodCustomer {
  id?:          string;
  name:         string;
  phone?:       string;
  taxPayerIdentificationNumber?: string;
}

interface IfoodDeliveryAddress {
  streetName?:    string;
  streetNumber?:  string;
  neighborhood?:  string;
  city?:          string;
  state?:         string;
  postalCode?:    string;
  complement?:    string;
  reference?:     string;
  coordinates?: { latitude: number; longitude: number };
}

interface IfoodOrder {
  id:           string;
  orderStatus:  string;
  orderType?:   string;
  createdAt?:   string;
  totalPrice?:  number;
  items?:       IfoodOrderItem[];
  customer?:    IfoodCustomer;
  deliveryAddress?: IfoodDeliveryAddress;
  benefits?:    Array<{ value: number }>;
  payments?:    Array<{ method: string; value: number }>;
}

/* ── Adapter ─────────────────────────────────────────────────── */

export class IfoodAdapter implements ChannelAdapter {
  verifySignature(
    payload: string,
    headers: Record<string, string>,
    secret: string,
  ): boolean {
    const sig = headers["x-ifood-signature"] ?? headers["X-Ifood-Signature"];
    if (!sig) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }

  parseInbound(externalPayload: unknown): AdapterResult<NormalizedOrder> {
    try {
      const raw = externalPayload as IfoodOrder;
      if (!raw?.id || !raw?.orderStatus) {
        return { success: false, error: "Payload iFood inválido — campos obrigatórios ausentes" };
      }

      const mappedStatus: OrderStatus =
        IFOOD_STATUS_MAP[raw.orderStatus] ?? "DRAFT";

      const items: NormalizedOrderItem[] = (raw.items ?? []).map((it) => ({
        externalId:    it.externalCode,
        name:          it.name,
        quantity:      it.quantity,
        unitPrice:     it.unitPrice,
        discountAmount: it.discount ?? 0,
        lineTotal:     it.totalPrice,
      }));

      const benefitsTotal = (raw.benefits ?? []).reduce(
        (s, b) => s + (b.value ?? 0),
        0,
      );

      const channelMetadata: Record<string, unknown> = {
        ifoodOrderType:    raw.orderType,
        deliveryAddress:   raw.deliveryAddress,
        ifoodPayments:     raw.payments,
        ifoodBenefits:     raw.benefits,
        ifoodBenefitsTotal: benefitsTotal,
        rawOrderStatus:    raw.orderStatus,
        createdAt:         raw.createdAt,
      };

      return {
        success: true,
        data: {
          externalId:     raw.id,
          externalStatus: raw.orderStatus,
          mappedStatus,
          items,
          total:          raw.totalPrice ?? 0,
          channelMetadata,
          customerName:   raw.customer?.name,
          customerPhone:  raw.customer?.phone,
          customerDoc:    raw.customer?.taxPayerIdentificationNumber,
        },
      };
    } catch (err) {
      return { success: false, error: `Erro ao parsear payload iFood: ${String(err)}` };
    }
  }

  formatOutbound(order: {
    id: string;
    status: OrderStatus;
    channelMetadata: unknown;
  }): unknown {
    // iFood não recebe status push desta forma — o aceite/recusa é via API específica
    return {
      orderId: order.id,
      status:  order.status,
    };
  }

  async syncCatalog(
    credentials: Record<string, unknown>,
    products: SyncProduct[],
  ): Promise<AdapterResult<{ synced: number; failed: number }>> {
    // TODO: Implementar sincronização real com a API iFood
    // Requer: merchant_id e token de acesso OAuth
    // Endpoint: POST /catalog/v2.0/merchants/{merchantId}/products
    if (!credentials.accessToken || !credentials.merchantId) {
      return {
        success: false,
        error: "Credenciais iFood não configuradas (accessToken + merchantId necessários)",
      };
    }

    // Placeholder: retorna como se sincronizou tudo
    // Em produção, chamar a API real
    console.warn("[iFoodAdapter.syncCatalog] Modo simulado — configure credenciais reais");
    return { success: true, data: { synced: products.length, failed: 0 } };
  }

  async pushStatus(
    credentials: Record<string, unknown>,
    _orderId: string,
    externalOrderId: string,
    newStatus: OrderStatus,
    _metadata?: Record<string, unknown>,
  ): Promise<AdapterResult<void>> {
    if (!credentials.accessToken || !credentials.merchantId) {
      return {
        success: false,
        error:   "Credenciais iFood não configuradas",
        retryable: true,
      };
    }

    // Mapear status interno → ação iFood
    const ifoodAction: Record<string, string> = {
      CONFIRMED:  "CONFIRM",
      FULFILLED:  "DISPATCH",
      COMPLETED:  "CONCLUDE",
      CANCELED:   "CANCEL",
    };

    const action = ifoodAction[newStatus];
    if (!action) return { success: true, data: undefined }; // status sem ação no iFood

    // TODO: Chamar API real
    // POST /order/v1.0/orders/{externalOrderId}/{action}
    console.warn(
      `[iFoodAdapter.pushStatus] Simulado — action: ${action} para pedido ${externalOrderId}`,
    );

    return { success: true, data: undefined };
  }
}

export const ifoodAdapter = new IfoodAdapter();
