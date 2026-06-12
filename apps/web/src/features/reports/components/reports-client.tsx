"use client";

import {
  Boxes,
  LayoutGrid,
  Loader2,
  PieChart,
  Send,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  aiReportAction,
  runCustomReportAction,
  runFixedReportAction,
} from "../actions/report-actions";
import { FIXED_REPORTS, GROUP_LABELS, type ReportGroup } from "../lib/fixed-reports";
import type { ReportConfig, ReportResult, ReportViz } from "../schemas";
import { ReportViewer } from "./report-viewer";

/* ── Builder options ─────────────────────────────────────────────── */

const SOURCE_DIMS: Record<string, { value: string; label: string }[]> = {
  sales: [
    { value: "day", label: "Dia" },
    { value: "product", label: "Produto" },
    { value: "category", label: "Categoria" },
    { value: "channel", label: "Canal" },
    { value: "paymentMethod", label: "Forma de pagamento" },
  ],
  inventory: [
    { value: "product", label: "Produto" },
    { value: "location", label: "Unidade" },
  ],
  losses: [
    { value: "reason", label: "Motivo" },
    { value: "product", label: "Produto" },
  ],
  finance: [
    { value: "agingBucket", label: "Faixa de vencimento" },
    { value: "financeCategory", label: "Categoria financeira" },
    { value: "settlementMonth", label: "Mês de liquidação" },
    { value: "paymentMethod", label: "Forma de pagamento" },
  ],
};

const SOURCE_METRICS: Record<string, { value: string; label: string }[]> = {
  sales: [
    { value: "revenue", label: "Receita" },
    { value: "orders", label: "Nº pedidos" },
    { value: "ticket", label: "Ticket médio" },
  ],
  inventory: [
    { value: "stockValue", label: "Valor em estoque" },
    { value: "qty", label: "Quantidade" },
  ],
  losses: [
    { value: "lossValue", label: "Perda (R$)" },
    { value: "qty", label: "Quantidade" },
  ],
  finance: [
    { value: "payableOpen", label: "A pagar em aberto" },
    { value: "receivableOpen", label: "A receber em aberto" },
    { value: "settlementNet", label: "Líquido de cartão" },
    { value: "feeTotal", label: "Taxa de cartão" },
    { value: "dreNet", label: "Resultado (DRE)" },
  ],
};

const GROUP_META: Record<ReportGroup, { icon: typeof ShoppingCart; tone: string }> = {
  sales: { icon: ShoppingCart, tone: "text-primary bg-primary-soft" },
  inventory: { icon: Boxes, tone: "text-success bg-success-soft" },
  losses: { icon: TriangleAlert, tone: "text-destructive bg-destructive-soft" },
  finance: { icon: Wallet, tone: "text-warning bg-warning-soft" },
};

const RANGES = [
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
  { id: "all", label: "Tudo", days: 0 },
];

const AI_SUGGESTIONS = [
  "Top 10 produtos por receita",
  "Vendas por dia",
  "Perdas por motivo",
  "Estoque por categoria",
];

const MODES = [
  { id: "fixed", label: "Fixos", icon: LayoutGrid },
  { id: "custom", label: "Personalizado", icon: SlidersHorizontal },
  { id: "ai", label: "IA", icon: Sparkles },
] as const;
type Mode = (typeof MODES)[number]["id"];

function rangeFilters(days: number): { from?: string; to?: string } {
  if (days === 0) return {};
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ReportsClient() {
  const [range, setRange] = useState("30d");
  const [mode, setMode] = useState<Mode>("fixed");
  const [active, setActive] = useState<{ result: ReportResult; viz: ReportViz } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // builder
  const [source, setSource] = useState("sales");
  const [dimension, setDimension] = useState("product");
  const [metric, setMetric] = useState("revenue");
  const [viz, setViz] = useState<ReportViz>("bar");

  // IA
  const [prompt, setPrompt] = useState("");
  const [interpreted, setInterpreted] = useState("");

  const filters = rangeFilters(RANGES.find((r) => r.id === range)?.days ?? 30);

  function runFixed(id: string, vz: ReportViz) {
    setInterpreted("");
    setActiveId(id);
    startTransition(async () => {
      const res = await runFixedReportAction(id, filters);
      if (res.success) setActive({ result: res.data, viz: vz });
      else toast.error(res.error);
    });
  }

  function runBuilder() {
    setInterpreted("");
    setActiveId(null);
    const config: ReportConfig = {
      source: source as ReportConfig["source"],
      dimension: dimension as ReportConfig["dimension"],
      metric: metric as ReportConfig["metric"],
      viz,
      filters,
      limit: 50,
    };
    startTransition(async () => {
      const res = await runCustomReportAction(config);
      if (res.success) setActive({ result: res.data, viz });
      else toast.error(res.error);
    });
  }

  function runAi(text?: string) {
    const q = (text ?? prompt).trim();
    if (q.length < 3) return;
    if (text) setPrompt(text);
    setActiveId(null);
    startTransition(async () => {
      const res = await aiReportAction(q);
      if (res.success) {
        setActive({ result: res.data.result, viz: res.data.config.viz });
        setInterpreted(res.data.interpreted);
      } else {
        toast.error(res.error);
      }
    });
  }

  function onSourceChange(s: string) {
    setSource(s);
    setDimension(SOURCE_DIMS[s]?.[0]?.value ?? "");
    setMetric(SOURCE_METRICS[s]?.[0]?.value ?? "");
  }

  const groups: ReportGroup[] = ["sales", "inventory", "losses", "finance"];

  return (
    <div className="flex flex-col gap-5">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-xs">
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all",
                  on
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-1",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 shadow-xs">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium tabular-nums transition-all",
                range === r.id
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Left rail */}
        <div className="flex flex-col gap-4">
          {mode === "fixed" && (
            <div className="flex flex-col gap-5 animate-in-up">
              {groups.map((g) => {
                const { icon: Icon, tone } = GROUP_META[g];
                const items = FIXED_REPORTS.filter((r) => r.group === g);
                return (
                  <div key={g} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-0.5">
                      <span
                        className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {GROUP_LABELS[g]}
                      </span>
                    </div>
                    {items.map((r) => {
                      const on = activeId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => runFixed(r.id, r.config.viz)}
                          disabled={pending}
                          className={cn(
                            "group relative overflow-hidden rounded-xl border bg-card px-4 py-3 text-left transition-all disabled:opacity-60",
                            on
                              ? "border-primary/60 shadow-sm ring-1 ring-primary/20"
                              : "border-border hover:border-border-strong hover:bg-surface-1 hover:shadow-sm",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[13.5px] font-semibold text-foreground">
                              {r.name}
                            </div>
                            {on && pending ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                            ) : (
                              <span className="text-[10px] font-medium uppercase tracking-wide text-subtle">
                                {r.config.viz === "line"
                                  ? "linha"
                                  : r.config.viz === "bar"
                                    ? "barras"
                                    : "tabela"}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {r.description}
                          </div>
                          {on && (
                            <span
                              className="absolute inset-y-0 left-0 w-1 bg-primary"
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {mode === "custom" && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5 shadow-xs animate-in-up">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Montar relatório</h3>
              </div>
              <Field label="Fonte de dados">
                <Select value={source} onChange={(e) => onSourceChange(e.target.value)}>
                  <option value="sales">Vendas</option>
                  <option value="inventory">Estoque</option>
                  <option value="losses">Perdas</option>
                  <option value="finance">Financeiro</option>
                </Select>
              </Field>
              <Field label="Agrupar por">
                <Select value={dimension} onChange={(e) => setDimension(e.target.value)}>
                  {SOURCE_DIMS[source]?.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Métrica">
                <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  {SOURCE_METRICS[source]?.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Visualização">
                <Select value={viz} onChange={(e) => setViz(e.target.value as ReportViz)}>
                  <option value="bar">Barras</option>
                  <option value="line">Linha</option>
                  <option value="table">Tabela</option>
                </Select>
              </Field>
              <Button onClick={runBuilder} disabled={pending} className="mt-1">
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PieChart className="h-4 w-4" />
                )}
                Gerar relatório
              </Button>
            </div>
          )}

          {mode === "ai" && (
            <div className="relative flex flex-col gap-3.5 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs animate-in-up">
              <span
                className="aurora-orange pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60"
                aria-hidden
              />
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Pergunte à IA</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Descreva em português o que quer ver. A IA monta o relatório.
              </p>
              <Textarea
                rows={3}
                placeholder="Ex: faturamento por canal nos últimos 90 dias"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runAi();
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {AI_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runAi(s)}
                    disabled={pending}
                    className="rounded-full border border-border bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button onClick={() => runAi()} disabled={pending || prompt.trim().length < 3}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Gerar
              </Button>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="min-h-104 rounded-2xl border border-border bg-card p-6 shadow-sm">
            {interpreted && active && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-primary-soft px-4 py-3 text-[13px] text-primary-soft-foreground">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="leading-relaxed">{interpreted}</span>
              </div>
            )}

            {pending && !active ? (
              <ResultSkeleton />
            ) : active ? (
              <ReportViewer result={active.result} viz={active.viz} />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: label wraps form control via children
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{label}</span>
      {children}
    </label>
  );
}

function EmptyState() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden py-28 text-center">
      <span className="aurora-orange pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-md ring-1 ring-border">
        <PieChart className="h-7 w-7" />
      </div>
      <div className="relative">
        <p className="font-display text-base font-semibold">Nenhum relatório aberto</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          Escolha um relatório fixo, monte um personalizado ou peça à IA. O resultado aparece aqui.
        </p>
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="skeleton h-6 w-56" />
        <div className="skeleton h-3.5 w-32" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[90, 70, 55, 40, 30].map((w) => (
          <div key={w} className="skeleton h-7 rounded-md" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
