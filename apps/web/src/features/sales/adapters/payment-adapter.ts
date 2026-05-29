/**
 * PaymentAdapter — abstração para provedores de pagamento.
 * MarketOS é integrador, nunca sub-adquirente (RN-V11).
 * Dados de cartão JAMAIS transitam pelo servidor MarketOS (RN-V12).
 *
 * Implementações:
 * - PixPaymentProvider: Pix dinâmico via qualquer provedor PSP
 * - CardPaymentProvider: tokenização via Adyen/Stripe/Cielo (card.number nunca chega aqui)
 *
 * Para Pix: QR code dinâmico (EMVCo) gerado pelo PSP.
 * Para cartão: o SDK do PSP no browser tokeniza — MarketOS só recebe o token.
 */

import crypto from "node:crypto";

/* ── Tipos canônicos de pagamento ────────────────────────────── */

export type PixChargeRequest = {
  organizationId: string;
  orderId: string;
  amount: number; // em centavos
  description?: string;
  expiresInSeconds?: number; // padrão: 3600 (1h)
  customerDoc?: string; // CPF/CNPJ do pagador (opcional)
  customerName?: string;
};

export type PixChargeResult =
  | {
      success: true;
      chargeId: string; // ID do PSP
      qrCode: string; // payload EMVCo (copia-e-cola)
      qrCodeImage: string; // base64 ou URL do QR image
      expiresAt: Date;
    }
  | { success: false; error: string; retryable?: boolean };

export type CardTokenRequest = {
  organizationId: string;
  orderId: string;
  amount: number; // em centavos
  cardToken: string; // token gerado pelo SDK do PSP no browser
  installments?: number; // padrão: 1
  description?: string;
};

export type CardChargeResult =
  | {
      success: true;
      chargeId: string;
      authorizationCode: string;
      nsu: string; // Número Sequencial Único
      last4: string; // últimos 4 dígitos (nunca o número completo)
      brand: string; // VISA, MASTERCARD, etc.
    }
  | { success: false; error: string; retryable?: boolean; declined?: boolean };

export type PaymentStatusResult =
  | {
      success: true;
      chargeId: string;
      paid: boolean;
      amount: number;
      paidAt?: Date;
      refundedAt?: Date;
    }
  | { success: false; error: string };

export type RefundRequest = {
  chargeId: string;
  amount?: number; // undefined = reembolso total
  reason?: string;
};

export type RefundResult =
  | { success: true; refundId: string }
  | { success: false; error: string; retryable?: boolean };

/* ── Interface do provedor ───────────────────────────────────── */

export interface PaymentProvider {
  /** Cria cobrança Pix dinâmica */
  createPixCharge(req: PixChargeRequest): Promise<PixChargeResult>;

  /** Cobra cartão tokenizado (token veio do SDK do PSP no browser) */
  chargeCard(req: CardTokenRequest): Promise<CardChargeResult>;

  /** Consulta status de uma cobrança (polling ou após webhook) */
  getChargeStatus(chargeId: string): Promise<PaymentStatusResult>;

  /** Reembolso parcial ou total */
  refund(req: RefundRequest): Promise<RefundResult>;

  /** Valida assinatura do webhook do PSP */
  verifyWebhookSignature(payload: string, headers: Record<string, string>, secret: string): boolean;

  /** Parseia evento do webhook do PSP */
  parseWebhookEvent(payload: unknown): {
    chargeId: string;
    event: "paid" | "expired" | "refunded" | "failed" | string;
    amount?: number;
    paidAt?: Date;
  } | null;
}

/* ── Implementação Pix (placeholder — integrar com PSP real) ─── */

/**
 * PixPaymentProvider — implementação base para Pix dinâmico.
 * Em produção, substituir por Asaas, Gerencianet, Pagar.me, etc.
 *
 * Todos os PSPs brasileiros seguem o padrão Pix do BACEN:
 * QR Code EMVCo + webhook de confirmação.
 */
export class PixPaymentProvider implements PaymentProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(credentials: { baseUrl: string; apiKey: string }) {
    this.baseUrl = credentials.baseUrl;
    this.apiKey = credentials.apiKey;
  }

  async createPixCharge(req: PixChargeRequest): Promise<PixChargeResult> {
    // TODO: Integrar com PSP real
    // Exemplo Asaas: POST https://api.asaas.com/v3/pix/qrCodes/static
    // Exemplo Gerencianet: POST /v2/cob/{txid}
    console.warn("[PixPaymentProvider.createPixCharge] Modo simulado");

    const expiresAt = new Date(Date.now() + (req.expiresInSeconds ?? 3600) * 1000);

    // Pix simulado — substituir por resposta real do PSP
    return {
      success: true,
      chargeId: `PIX_${req.orderId}_${Date.now()}`,
      qrCode: `00020126580014br.gov.bcb.pix0136${req.orderId}5204000053039865802BR5925MarketOS6009Sao Paulo62070503***6304ABCD`,
      qrCodeImage:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      expiresAt,
    };
  }

  async chargeCard(_req: CardTokenRequest): Promise<CardChargeResult> {
    // TODO: Integrar com PSP real para captura de cartão tokenizado
    console.warn("[PixPaymentProvider.chargeCard] Não suportado neste provider");
    return { success: false, error: "Pagamento com cartão não suportado neste provider" };
  }

  async getChargeStatus(chargeId: string): Promise<PaymentStatusResult> {
    // TODO: GET /charges/{chargeId} no PSP
    console.warn(`[PixPaymentProvider.getChargeStatus] Simulado para ${chargeId}`);
    return {
      success: true,
      chargeId,
      paid: false,
      amount: 0,
    };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    // TODO: POST /refunds no PSP
    console.warn(`[PixPaymentProvider.refund] Simulado para ${req.chargeId}`);
    return { success: true, refundId: `REFUND_${req.chargeId}` };
  }

  verifyWebhookSignature(
    payload: string,
    headers: Record<string, string>,
    secret: string,
  ): boolean {
    // PSPs geralmente usam HMAC SHA256 ou JWT
    // Implementação varia por provedor — personalizar conforme PSP escolhido
    const sig = headers["x-webhook-signature"] ?? headers["x-asaas-signature"] ?? "";
    if (!sig) return false;

    // Em produção, verificar documentação do PSP escolhido para o formato exato
    try {
      const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: unknown): {
    chargeId: string;
    event: string;
    amount?: number;
    paidAt?: Date;
  } | null {
    // TODO: Parsear webhook do PSP
    // Formato varia por provedor
    const raw = payload as Record<string, unknown>;
    if (!raw?.id) return null;

    return {
      chargeId: String(raw.id),
      event: String(raw.event ?? raw.status ?? "unknown"),
      amount: raw.value ? Number(raw.value) : undefined,
      paidAt: raw.paymentDate ? new Date(String(raw.paymentDate)) : undefined,
    };
  }
}

/* ── Registry de provedores ──────────────────────────────────── */

/**
 * Retorna o PaymentProvider configurado para a organização.
 * Em produção, buscar credenciais de ChannelIntegration.
 */
export function getPaymentProvider(credentials: Record<string, unknown>): PaymentProvider {
  // Por ora, único provider disponível é Pix
  return new PixPaymentProvider({
    baseUrl: String(credentials.baseUrl ?? "https://api.asaas.com/v3"),
    apiKey: String(credentials.apiKey ?? ""),
  });
}
