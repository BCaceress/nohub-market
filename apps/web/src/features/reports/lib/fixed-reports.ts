import type { ReportConfig } from "../schemas";

/* ─────────────────────────────────────────────────────────────────────
   Catálogo de relatórios fixos (templates prontos).
   Cada um é só um ReportConfig nomeado — roda no mesmo engine.
───────────────────────────────────────────────────────────────────── */

export type ReportGroup = "sales" | "inventory" | "losses" | "finance";

export interface FixedReport {
  id: string;
  name: string;
  description: string;
  group: ReportGroup;
  /** roles mínimas; undefined = todos */
  config: ReportConfig;
}

export const GROUP_LABELS: Record<ReportGroup, string> = {
  sales: "Vendas",
  inventory: "Estoque",
  losses: "Perdas",
  finance: "Financeiro",
};

export const FIXED_REPORTS: FixedReport[] = [
  {
    id: "sales-by-day",
    name: "Vendas por dia",
    description: "Receita e nº de pedidos por dia no período.",
    group: "sales",
    config: {
      source: "sales",
      dimension: "day",
      metric: "revenue",
      filters: {},
      viz: "line",
      limit: 90,
    },
  },
  {
    id: "top-products",
    name: "Produtos mais vendidos",
    description: "Ranking de produtos por receita.",
    group: "sales",
    config: {
      source: "sales",
      dimension: "product",
      metric: "revenue",
      filters: {},
      viz: "bar",
      limit: 20,
    },
  },
  {
    id: "sales-by-category",
    name: "Vendas por categoria",
    description: "Receita agrupada por categoria.",
    group: "sales",
    config: {
      source: "sales",
      dimension: "category",
      metric: "revenue",
      filters: {},
      viz: "bar",
      limit: 20,
    },
  },
  {
    id: "sales-by-channel",
    name: "Vendas por canal",
    description: "PDV, autônomo, iFood, WhatsApp, Mercado Livre.",
    group: "sales",
    config: {
      source: "sales",
      dimension: "channel",
      metric: "revenue",
      filters: {},
      viz: "bar",
      limit: 10,
    },
  },
  {
    id: "payment-methods",
    name: "Formas de pagamento",
    description: "Total recebido por método (pagamentos confirmados).",
    group: "sales",
    config: {
      source: "sales",
      dimension: "paymentMethod",
      metric: "revenue",
      filters: {},
      viz: "bar",
      limit: 10,
    },
  },
  {
    id: "stock-position",
    name: "Posição de estoque",
    description: "Valor em estoque (custo) por produto.",
    group: "inventory",
    config: {
      source: "inventory",
      dimension: "product",
      metric: "stockValue",
      filters: {},
      viz: "table",
      limit: 100,
    },
  },
  {
    id: "stock-by-location",
    name: "Estoque por unidade",
    description: "Valor em estoque por loja/CD.",
    group: "inventory",
    config: {
      source: "inventory",
      dimension: "location",
      metric: "stockValue",
      filters: {},
      viz: "bar",
      limit: 50,
    },
  },
  {
    id: "losses-by-reason",
    name: "Perdas por motivo",
    description: "Dano, vencimento e furto no período.",
    group: "losses",
    config: {
      source: "losses",
      dimension: "reason",
      metric: "lossValue",
      filters: {},
      viz: "bar",
      limit: 10,
    },
  },
  {
    id: "losses-by-product",
    name: "Perdas por produto",
    description: "Produtos com maior perda financeira.",
    group: "losses",
    config: {
      source: "losses",
      dimension: "product",
      metric: "lossValue",
      filters: {},
      viz: "table",
      limit: 30,
    },
  },
  {
    id: "payables-aging",
    name: "Aging de contas a pagar",
    description: "Saldo em aberto por faixa de vencimento.",
    group: "finance",
    config: {
      source: "finance",
      dimension: "agingBucket",
      metric: "payableOpen",
      filters: {},
      viz: "bar",
      limit: 10,
    },
  },
  {
    id: "receivables-aging",
    name: "Aging de contas a receber",
    description: "Saldo a receber por faixa de vencimento.",
    group: "finance",
    config: {
      source: "finance",
      dimension: "agingBucket",
      metric: "receivableOpen",
      filters: {},
      viz: "bar",
      limit: 10,
    },
  },
  {
    id: "settlement-calendar",
    name: "Calendário de liquidação",
    description: "Líquido de cartão a liquidar por mês.",
    group: "finance",
    config: {
      source: "finance",
      dimension: "settlementMonth",
      metric: "settlementNet",
      filters: {},
      viz: "bar",
      limit: 24,
    },
  },
  {
    id: "card-fees",
    name: "Taxas de cartão",
    description: "Taxa de adquirente por método de pagamento.",
    group: "finance",
    config: {
      source: "finance",
      dimension: "paymentMethod",
      metric: "feeTotal",
      filters: {},
      viz: "bar",
      limit: 10,
    },
  },
  {
    id: "dre-by-category",
    name: "DRE por categoria",
    description: "Resultado realizado (receitas − despesas) por categoria.",
    group: "finance",
    config: {
      source: "finance",
      dimension: "financeCategory",
      metric: "dreNet",
      filters: {},
      viz: "table",
      limit: 50,
    },
  },
];

export function getFixedReport(id: string): FixedReport | undefined {
  return FIXED_REPORTS.find((r) => r.id === id);
}
