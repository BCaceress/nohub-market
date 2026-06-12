import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────
   Report engine — config compartilhado.
   Relatórios fixos, personalizados e IA compilam para o MESMO ReportConfig.
   A IA NUNCA gera SQL: mapeia linguagem natural para este schema validado.
───────────────────────────────────────────────────────────────────── */

export const reportSourceSchema = z.enum(["sales", "inventory", "losses", "finance"]);
export type ReportSource = z.infer<typeof reportSourceSchema>;

/** Dimensões válidas por fonte (groupBy). */
export const reportDimensionSchema = z.enum([
  // sales
  "day",
  "channel",
  "paymentMethod",
  "product",
  "category",
  // inventory
  "location",
  // losses
  "reason",
  // finance
  "agingBucket",
  "settlementMonth",
  "financeCategory",
]);
export type ReportDimension = z.infer<typeof reportDimensionSchema>;

/** Métricas válidas por fonte. */
export const reportMetricSchema = z.enum([
  "revenue", // R$ vendido
  "orders", // nº pedidos
  "qty", // quantidade
  "ticket", // ticket médio
  "stockValue", // R$ em estoque
  "lossValue", // R$ perdido
  // finance
  "payableOpen", // R$ a pagar em aberto
  "receivableOpen", // R$ a receber em aberto
  "settlementNet", // R$ líquido de cartão a liquidar
  "feeTotal", // R$ de taxa de adquirente
  "dreNet", // resultado (receitas − despesas) realizado
]);
export type ReportMetric = z.infer<typeof reportMetricSchema>;

export const reportVizSchema = z.enum(["table", "bar", "line"]);
export type ReportViz = z.infer<typeof reportVizSchema>;

export const reportFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  locationId: z.string().optional(),
  channel: z.enum(["POS", "SELF_SERVICE", "IFOOD", "WHATSAPP", "MERCADO_LIVRE"]).optional(),
  categoryId: z.string().optional(),
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

export const reportConfigSchema = z.object({
  source: reportSourceSchema,
  dimension: reportDimensionSchema,
  metric: reportMetricSchema,
  filters: reportFiltersSchema.default({}),
  viz: reportVizSchema.default("table"),
  limit: z.number().int().min(1).max(500).default(50),
});
export type ReportConfig = z.infer<typeof reportConfigSchema>;

/* ── Resultado normalizado (consumido pelo viewer) ──────────────── */

export type ReportColumnType = "text" | "number" | "currency" | "date";

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportColumnType;
}

export interface ReportResult {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  /** chave da coluna usada no eixo X de gráficos */
  labelKey: string;
  /** chave da coluna numérica plotada */
  valueKey: string;
  totals?: Record<string, number>;
}
