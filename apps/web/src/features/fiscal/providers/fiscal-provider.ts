/**
 * FiscalProvider — interface do adapter de BaaS fiscal.
 * Anti-corruption: payload do Focus/TecnoSpeed morre no provider (RN-F07).
 * O core (lib, actions, UI) só conhece os tipos internos aqui definidos.
 *
 * Reusa o padrão ChannelAdapter da Etapa 4.
 */

// ── Tipos internos do core fiscal ─────────────────────────────────

export type FiscalAddress = {
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string; // UF — 2 chars
  zipCode: string;
};

export type FiscalIssuer = {
  cnpj: string;
  legalName: string;
  tradeName?: string;
  taxRegime: string; // "simples_nacional" | "lucro_presumido" | ...
  address: FiscalAddress;
  ie?: string; // Inscrição Estadual
  csc: string; // Código de Segurança do Contribuinte (NFCe)
  cscId: string; // ID do CSC
};

export type FiscalRecipient = {
  document?: string; // CPF (opcional — consumidor final)
  name?: string;
  email?: string;
};

export type FiscalItem = {
  /** Código interno do produto */
  productCode: string;
  /** Descrição (do snapshot — nunca recalcular) */
  description: string;
  /** NCM — do taxSnapshot */
  ncm: string;
  /** CFOP */
  cfop: string;
  /** Unidade comercial */
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;

  // ICMS
  icmsOrigin: string; // "0"=Nacional ... "7"=Estrangeira
  /** CST (regime normal) ou CSOSN (Simples) */
  icmsCst?: string;
  icmsCsosn?: string;
  icmsRate?: number;
  icmsAmount?: number;

  // PIS/COFINS
  pisCst?: string;
  pisRate?: number;
  pisAmount?: number;
  cofinsCst?: string;
  cofinsRate?: number;
  cofinsAmount?: number;

  // IPI (quando aplicável)
  ipiCst?: string;
  ipiRate?: number;
  ipiAmount?: number;
};

export type FiscalPayment = {
  method: string; // "01"=Dinheiro, "03"=Cartão Crédito, "04"=Cartão Débito, "17"=Pix ...
  amount: number;
};

export type InvoiceDraft = {
  issuer: FiscalIssuer;
  recipient?: FiscalRecipient;
  items: FiscalItem[];
  payments: FiscalPayment[];
  totalAmount: number;
  totalTax: number;
  series: number;
  environment: "homologation" | "production";
  /** Id interno da Invoice — para correlação no BaaS */
  referenceId: string;
};

export type ProviderIssueResult = {
  accessKey: string;
  protocol: string;
  providerInvoiceId: string;
  xml: string;
  qrCode?: string;
  danfeUrl?: string;
  issuedAt: Date;
  /** Se true, a resposta foi síncrona (a maioria dos BaaS); se false, vem por webhook */
  isSynchronous: boolean;
};

export type ProviderCancelResult = {
  protocol: string;
  xml: string;
  canceledAt: Date;
};

export type ProviderStatus =
  | { status: "authorized"; accessKey: string; protocol: string }
  | { status: "rejected"; code: string; reason: string }
  | { status: "denied"; code: string; reason: string }
  | { status: "pending" }
  | { status: "not_found" };

export type ProviderInutilizeResult = {
  protocol: string;
  processedAt: Date;
};

export type InvoiceUpdate = {
  providerInvoiceId: string;
  status: "authorized" | "rejected" | "denied";
  accessKey?: string;
  protocol?: string;
  xml?: string;
  qrCode?: string;
  danfeUrl?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  processedAt: Date;
};

export type ProviderCertificate = {
  pfxBase64: string; // .pfx em base64
  password: string;
};

export type ProviderConfig = {
  environment: "homologation" | "production";
  cnpj: string;
  /** Token de API do BaaS */
  token: string;
  /** CSC para assinar QR Code NFCe */
  csc: string;
  cscId: string;
};

export type FiscalResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; retryable?: boolean; code?: string };

// ── Interface ──────────────────────────────────────────────────────

export interface FiscalProvider {
  /** Emite NFCe via BaaS */
  issueNfce(
    draft: InvoiceDraft,
    certificate: ProviderCertificate,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderIssueResult>>;

  /** Cancela NFCe dentro do prazo */
  cancelNfce(
    accessKey: string,
    reason: string,
    certificate: ProviderCertificate,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderCancelResult>>;

  /** Consulta status de uma nota no BaaS (polling de fallback) */
  consultStatus(
    providerInvoiceId: string,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderStatus>>;

  /** Inutiliza faixa de numeração */
  inutilizeNumbers(
    series: number,
    from: number,
    to: number,
    reason: string,
    certificate: ProviderCertificate,
    config: ProviderConfig,
  ): Promise<FiscalResult<ProviderInutilizeResult>>;

  /** Valida assinatura do webhook do BaaS */
  verifyWebhookSignature(
    payload: string,
    headers: Record<string, string>,
    config: ProviderConfig,
  ): boolean;

  /** Parseia webhook do BaaS → tipo interno (anti-corruption: payload morre aqui) */
  parseWebhook(payload: unknown): FiscalResult<InvoiceUpdate>;
}
