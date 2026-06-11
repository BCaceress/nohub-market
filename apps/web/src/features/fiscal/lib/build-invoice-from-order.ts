/**
 * buildInvoiceFromOrder — monta InvoiceDraft a partir do Order + OrderItems.
 *
 * REGRA INEGOCIÁVEL (RN-F02): nunca recalcula imposto.
 * Usa EXCLUSIVAMENTE o taxSnapshot congelado nos OrderItems (Etapas 2 e 4).
 * Se o snapshot estiver vazio, registra o item sem dados fiscais (sujeito a rejeição do BaaS).
 *
 * Receber um order.payments para montar as formas de pagamento.
 */

import type {
  FiscalIssuer,
  FiscalItem,
  FiscalPayment,
  FiscalRecipient,
  InvoiceDraft,
} from "../providers/fiscal-provider";

/* ── Tipos de entrada ─────────────────────────────────────────── */

type OrderItemInput = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  unitSnapshot: string;
  unitPriceSnapshot: number | { toNumber(): number };
  discountAmount: number | { toNumber(): number };
  lineTotal: number | { toNumber(): number };
  quantity: number | { toNumber(): number };
  taxSnapshot: unknown; // JSON congelado na Etapa 4
};

type PaymentInput = {
  method: string;
  amount: number | { toNumber(): number };
};

type CustomerInput = {
  document?: string | null;
  name?: string | null;
  email?: string | null;
} | null;

type OrgInput = {
  document: string;
  legalName: string;
  tradeName?: string | null;
  taxRegime?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

type FiscalConfigInput = {
  nfceSeries: number;
  nfceCscId: string | null;
  nfceCscToken: Buffer | null;
  environment: "HOMOLOGATION" | "PRODUCTION";
  provider: "FOCUS_NFE" | "TECNOSPEED";
};

type LocationInput = {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

export type BuildInvoiceInput = {
  invoiceId: string;
  org: OrgInput;
  location: LocationInput;
  fiscalConfig: FiscalConfigInput;
  customer: CustomerInput;
  items: OrderItemInput[];
  payments: PaymentInput[];
  total: number | { toNumber(): number };
  /** Inscrição Estadual da organização */
  ie?: string;
};

/* ── Mapeamento formas de pagamento ──────────────────────────── */

const PAYMENT_CODE_MAP: Record<string, string> = {
  CASH: "01",
  PIX_MANUAL: "17",
  PIX_DYNAMIC: "17",
  CARD_PRESENT: "03",
  CARD_CREDIT: "03",
  CARD_DEBIT: "04",
  CARD_ONLINE: "03",
  VOUCHER: "99",
};

/* ── Tipos do taxSnapshot (Etapa 2) ──────────────────────────── */

type TaxSnapshot = {
  ncm?: string;
  cfop?: string;
  origin?: string; // TaxOrigin
  icmsCst?: string;
  icmsCsosn?: string;
  icmsRate?: number | string;
  icmsAmount?: number | string;
  pisCst?: string;
  pisRate?: number | string;
  pisAmount?: number | string;
  cofinsCst?: string;
  cofinsRate?: number | string;
  cofinsAmount?: number | string;
  ipiCst?: string;
  ipiRate?: number | string;
  ipiAmount?: number | string;
};

function toNum(v: number | { toNumber(): number } | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

function mapOrigin(origin?: string): string {
  // TaxOrigin enum → código SEFAZ
  const map: Record<string, string> = {
    NACIONAL: "0",
    ESTRANGEIRA_IMPORTADA: "1",
    ESTRANGEIRA_MERCADO: "2",
    NACIONAL_ALTO_CONTEUDO: "3",
    NACIONAL_PROCESSO_PRODUTIVO: "5",
    ESTRANGEIRA_IMPORTADA_SEM_SIMILAR: "6",
    ESTRANGEIRA_ADQUIRIDA_NO_MERCADO: "7",
  };
  return map[origin ?? "NACIONAL"] ?? "0";
}

/* ── Função principal ─────────────────────────────────────────── */

export type BuildInvoiceResult =
  | { success: true; draft: InvoiceDraft }
  | { success: false; error: string };

export function buildInvoiceFromOrder(input: BuildInvoiceInput): BuildInvoiceResult {
  const { org, location, fiscalConfig, customer, items, payments, invoiceId } = input;

  // Montar endereço do emitente (prioridade: location → org)
  const address = {
    street: (location.street ?? org.street ?? "").trim(),
    number: (location.number ?? org.number ?? "S/N").trim(),
    complement: location.complement ?? org.complement ?? undefined,
    district: (location.district ?? org.district ?? "").trim(),
    city: (location.city ?? org.city ?? "").trim(),
    state: (location.state ?? org.state ?? "").trim().toUpperCase(),
    zipCode: (location.zipCode ?? org.zipCode ?? "").replace(/\D/g, ""),
  };

  if (!address.city || !address.state) {
    return { success: false, error: "Endereço do emitente incompleto — cidade e UF obrigatórios" };
  }

  // Desencriptar CSC token (bytes → string)
  const cscToken = fiscalConfig.nfceCscToken ? fiscalConfig.nfceCscToken.toString("utf8") : "";
  const cscId = fiscalConfig.nfceCscId ?? "";

  if (!cscToken || !cscId) {
    return {
      success: false,
      error: "CSC não configurado — configure o Código de Segurança do Contribuinte",
    };
  }

  const issuer: FiscalIssuer = {
    cnpj: org.document.replace(/\D/g, ""),
    legalName: org.legalName,
    tradeName: org.tradeName ?? undefined,
    taxRegime: org.taxRegime ?? "SIMPLES_NACIONAL",
    address,
    csc: cscToken,
    cscId,
    ie: input.ie,
  };

  // Destinatário (opcional — RN-F14)
  let recipient: FiscalRecipient | undefined;
  if (customer?.document) {
    recipient = {
      document: customer.document.replace(/\D/g, ""),
      name: customer.name ?? undefined,
      email: customer.email ?? undefined,
    };
  }

  // Itens — usa taxSnapshot congelado (RN-F02: nunca recalcula)
  const fiscalItems: FiscalItem[] = items.map((item) => {
    const snap = (item.taxSnapshot ?? {}) as TaxSnapshot;
    const qty = toNum(item.quantity);
    const unit = toNum(item.unitPriceSnapshot);
    const disc = toNum(item.discountAmount);
    const line = toNum(item.lineTotal);

    return {
      productCode: item.productId.slice(0, 60),
      description: item.productNameSnapshot.slice(0, 120),
      ncm: (snap.ncm ?? "00000000").replace(/\D/g, "").padStart(8, "0"),
      cfop: snap.cfop ?? "5102",
      unit: item.unitSnapshot ?? "UN",
      quantity: qty,
      unitPrice: unit,
      totalPrice: line,
      discountAmount: disc,
      icmsOrigin: mapOrigin(snap.origin),
      icmsCst: snap.icmsCst ?? undefined,
      icmsCsosn: snap.icmsCsosn ?? undefined,
      icmsRate: snap.icmsRate ? Number(snap.icmsRate) : undefined,
      icmsAmount: snap.icmsAmount ? Number(snap.icmsAmount) : undefined,
      pisCst: snap.pisCst ?? "07",
      pisRate: snap.pisRate ? Number(snap.pisRate) : undefined,
      pisAmount: snap.pisAmount ? Number(snap.pisAmount) : undefined,
      cofinsCst: snap.cofinsCst ?? "07",
      cofinsRate: snap.cofinsRate ? Number(snap.cofinsRate) : undefined,
      cofinsAmount: snap.cofinsAmount ? Number(snap.cofinsAmount) : undefined,
      ipiCst: snap.ipiCst ?? undefined,
      ipiRate: snap.ipiRate ? Number(snap.ipiRate) : undefined,
    };
  });

  // Formas de pagamento
  const fiscalPayments: FiscalPayment[] = payments.map((p) => ({
    method: PAYMENT_CODE_MAP[p.method] ?? "99",
    amount: toNum(p.amount),
  }));

  const totalAmount = items.reduce((s, i) => s + toNum(i.lineTotal), 0);

  // Total de impostos — soma do taxSnapshot (best-effort; pode ser 0 se não configurado)
  const totalTax = items.reduce((s, item) => {
    const snap = (item.taxSnapshot ?? {}) as TaxSnapshot;
    return (
      s +
      Number(snap.icmsAmount ?? 0) +
      Number(snap.pisAmount ?? 0) +
      Number(snap.cofinsAmount ?? 0) +
      Number(snap.ipiAmount ?? 0)
    );
  }, 0);

  const draft: InvoiceDraft = {
    issuer,
    recipient,
    items: fiscalItems,
    payments: fiscalPayments,
    totalAmount,
    totalTax,
    series: fiscalConfig.nfceSeries,
    environment: fiscalConfig.environment === "PRODUCTION" ? "production" : "homologation",
    referenceId: invoiceId,
  };

  return { success: true, draft };
}
