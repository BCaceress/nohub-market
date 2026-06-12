"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { getSession } from "@/lib/auth-server";
import { getFixedReport } from "../lib/fixed-reports";
import { runReport } from "../lib/run-report";
import {
  type ReportConfig,
  type ReportFilters,
  type ReportResult,
  reportConfigSchema,
} from "../schemas";

/* ── Auth / tenant ───────────────────────────────────────────────── */

async function resolveOrg(): Promise<{ organizationId: string; role: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) return null;
  return { organizationId: member.organizationId, role: member.role };
}

/** Relatórios financeiros (receita/margem/perda) ficam restritos a gestão. */
function canSeeFinancial(role: string): boolean {
  return ["owner", "admin", "manager"].includes(role);
}

/* ── Run fixo ────────────────────────────────────────────────────── */

export async function runFixedReportAction(
  reportId: string,
  filters?: ReportFilters,
): Promise<Result<ReportResult>> {
  const ctx = await resolveOrg();
  if (!ctx) return { success: false, error: "Não autenticado" };

  const fixed = getFixedReport(reportId);
  if (!fixed) return { success: false, error: "Relatório não encontrado" };
  if (!canSeeFinancial(ctx.role)) return { success: false, error: "Sem permissão" };

  const config: ReportConfig = {
    ...fixed.config,
    filters: { ...fixed.config.filters, ...filters },
  };
  try {
    const result = await runReport(ctx.organizationId, config);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Falha ao gerar relatório" };
  }
}

/* ── Run custom (builder) ────────────────────────────────────────── */

export async function runCustomReportAction(raw: unknown): Promise<Result<ReportResult>> {
  const ctx = await resolveOrg();
  if (!ctx) return { success: false, error: "Não autenticado" };
  if (!canSeeFinancial(ctx.role)) return { success: false, error: "Sem permissão" };

  const parsed = reportConfigSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Configuração inválida" };

  try {
    const result = await runReport(ctx.organizationId, parsed.data);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Falha ao gerar relatório" };
  }
}

/* ── Run IA (linguagem natural → ReportConfig) ───────────────────── */

export interface AiReportResponse {
  config: ReportConfig;
  result: ReportResult;
  interpreted: string;
}

export async function aiReportAction(prompt: string): Promise<Result<AiReportResponse>> {
  const ctx = await resolveOrg();
  if (!ctx) return { success: false, error: "Não autenticado" };
  if (!canSeeFinancial(ctx.role)) return { success: false, error: "Sem permissão" };

  const clean = prompt.trim();
  if (clean.length < 3) return { success: false, error: "Descreva o relatório desejado" };

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "IA não configurada" };

  // Segurança: a IA só preenche um schema fechado. Nada de SQL livre.
  const instruction = `Você converte pedidos em linguagem natural para um relatório de varejo.
Responda APENAS JSON válido, sem markdown, neste formato:
{
  "source": "sales" | "inventory" | "losses",
  "dimension": "day" | "channel" | "paymentMethod" | "product" | "category" | "location" | "reason",
  "metric": "revenue" | "orders" | "qty" | "ticket" | "stockValue" | "lossValue",
  "viz": "table" | "bar" | "line",
  "limit": número (1-200),
  "interpreted": "frase curta resumindo o que será mostrado"
}

Regras:
- source=sales: dimensões válidas day, channel, paymentMethod, product, category; métricas revenue, orders, qty, ticket.
- source=inventory: dimensões product, location; métricas stockValue, qty.
- source=losses: dimensões reason, product; métrica lossValue, qty.
- Série temporal → viz "line". Ranking → viz "bar". Detalhe → "table".

Pedido do usuário: "${clean}"`;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: instruction,
      config: { responseMimeType: "application/json" },
    });
    const text = (response.text ?? "").trim();
    if (!text) return { success: false, error: "Sem resposta da IA" };

    const data = JSON.parse(text) as Record<string, unknown>;
    const interpreted = typeof data.interpreted === "string" ? data.interpreted : "";

    const parsed = reportConfigSchema.safeParse({
      source: data.source,
      dimension: data.dimension,
      metric: data.metric,
      viz: data.viz,
      limit: data.limit,
      filters: {},
    });
    if (!parsed.success) {
      return { success: false, error: "Não entendi o pedido. Tente reformular." };
    }

    const result = await runReport(ctx.organizationId, parsed.data);
    return { success: true, data: { config: parsed.data, result, interpreted } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Falha na IA" };
  }
}
