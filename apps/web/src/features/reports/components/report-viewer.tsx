"use client";

import { Coins, Download, Hash, Package, Receipt, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportColumn, ReportResult } from "../schemas";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function fmt(value: string | number | undefined, type: ReportColumn["type"]): string {
  if (type === "currency") return brl.format(Number(value) || 0);
  if (type === "number") return dec.format(Number(value) || 0);
  if (type === "date") return formatDay(String(value));
  return String(value ?? "");
}

function formatDay(iso: string): string {
  // "2026-05-30" → "30/05"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/* ── KPI tone mapping ────────────────────────────────────────────── */

const KPI_META: Record<string, { tone: string; icon: typeof Coins }> = {
  revenue: { tone: "text-primary bg-primary-soft", icon: Coins },
  orders: { tone: "text-info bg-info-soft", icon: Receipt },
  ticket: { tone: "text-foreground bg-surface-2", icon: Hash },
  stockValue: { tone: "text-success bg-success-soft", icon: Package },
  qty: { tone: "text-foreground bg-surface-2", icon: Hash },
  lossValue: { tone: "text-destructive bg-destructive-soft", icon: TrendingDown },
};

/* ── CSV export ──────────────────────────────────────────────────── */

function toCsv(result: ReportResult): string {
  const head = result.columns.map((c) => `"${c.label}"`).join(";");
  const lines = result.rows.map((row) =>
    result.columns
      .map((c) => {
        const v = row[c.key];
        if (c.type === "currency" || c.type === "number") return String(v ?? 0);
        return `"${String(v ?? "").replace(/"/g, '""')}"`;
      })
      .join(";"),
  );
  return [head, ...lines].join("\n");
}

function download(result: ReportResult) {
  const csv = `﻿${toCsv(result)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Bar chart (ranked, animated) ────────────────────────────────── */

function BarChart({ result }: { result: ReportResult }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const data = result.rows.slice(0, 12);
  const valueCol = result.columns.find((c) => c.key === result.valueKey);
  const max = Math.max(1, ...data.map((r) => Number(r[result.valueKey]) || 0));

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((row, i) => {
        const v = Number(row[result.valueKey]) || 0;
        const pct = (v / max) * 100;
        return (
          <div
            key={String(row[result.labelKey])}
            className="group grid grid-cols-[1.25rem_8.5rem_1fr_auto] items-center gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-1"
          >
            <span className="text-right text-[11px] font-semibold tabular-nums text-subtle">
              {i + 1}
            </span>
            <span
              className="truncate text-right text-xs font-medium text-foreground"
              title={String(row[result.labelKey])}
            >
              {fmt(row[result.labelKey], result.columns[0]?.type ?? "text")}
            </span>
            <div className="relative h-7 overflow-hidden rounded-md bg-surface-1/70 ring-1 ring-inset ring-border/60">
              <div
                className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-700 ease-out"
                style={{
                  width: mounted ? `${Math.max(pct, 1.5)}%` : "0%",
                  background:
                    "linear-gradient(90deg, color-mix(in srgb, var(--primary) 75%, white 10%), var(--primary))",
                  transitionDelay: `${i * 40}ms`,
                }}
              />
            </div>
            <span className="w-24 text-right text-xs font-semibold tabular-nums text-foreground">
              {fmt(v, valueCol?.type ?? "number")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Line chart (area + grid + dots) ─────────────────────────────── */

function LineChart({ result }: { result: ReportResult }) {
  const data = result.rows;
  if (data.length < 2) return <BarChart result={result} />;

  const w = 760;
  const h = 220;
  const padX = 14;
  const padY = 18;
  const vals = data.map((r) => Number(r[result.valueKey]) || 0);
  const max = Math.max(1, ...vals);
  const stepX = (w - padX * 2) / (data.length - 1);

  const pt = (v: number, i: number) => {
    const x = padX + i * stepX;
    const y = h - padY - (v / max) * (h - padY * 2);
    return [x, y] as const;
  };

  const linePts = vals.map((v, i) => pt(v, i));
  const linePath = linePts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `M${padX},${h - padY} L${linePts
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" L")} L${(padX + (data.length - 1) * stepX).toFixed(1)},${h - padY} Z`;

  const last = linePts.at(-1) ?? ([padX, h - padY] as [number, number]);
  const valueCol = result.columns.find((c) => c.key === result.valueKey);

  return (
    <div className="relative rounded-xl border border-border bg-card p-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-52 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico de linha"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={w - padX}
            y1={padY + g * (h - padY * 2)}
            y2={padY + g * (h - padY * 2)}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={areaPath} fill="url(#area-fill)" />
        <polyline
          points={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={last[0]}
          cy={last[1]}
          r="3.5"
          fill="var(--primary)"
          stroke="var(--card)"
          strokeWidth="2"
        />
      </svg>
      {/* x labels (first / last) */}
      <div className="mt-1 flex justify-between px-1 text-[10px] text-subtle">
        <span>{fmt(data[0]?.[result.labelKey], result.columns[0]?.type ?? "text")}</span>
        <span className="font-medium text-muted-foreground">
          pico {fmt(max, valueCol?.type ?? "number")}
        </span>
        <span>
          {fmt(data[data.length - 1]?.[result.labelKey], result.columns[0]?.type ?? "text")}
        </span>
      </div>
    </div>
  );
}

/* ── Viewer ──────────────────────────────────────────────────────── */

export function ReportViewer({
  result,
  viz = "table",
}: {
  result: ReportResult;
  viz?: "table" | "bar" | "line";
}) {
  return (
    <div className="flex flex-col gap-6 animate-in-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">{result.title}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {result.rows.length} {result.rows.length === 1 ? "registro" : "registros"}
            {result.subtitle ? ` · ${result.subtitle}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => download(result)}>
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {/* KPIs */}
      {result.totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(result.totals).map(([k, v]) => {
            const col = result.columns.find((c) => c.key === k);
            const meta = KPI_META[k] ?? { tone: "text-foreground bg-surface-2", icon: Hash };
            const Icon = meta.icon;
            return (
              <div
                key={k}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    meta.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium uppercase tracking-wide text-subtle">
                    {col?.label ?? k}
                  </div>
                  <div className="font-display text-lg font-semibold leading-tight tabular-nums">
                    {fmt(v, col?.type ?? "number")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viz === "bar" && result.rows.length > 0 && <BarChart result={result} />}
      {viz === "line" && result.rows.length > 0 && <LineChart result={result} />}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="max-h-112 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-1/90 backdrop-blur">
              <tr>
                {result.columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle first:pl-5 last:pr-5",
                      c.type !== "text" ? "text-right" : "text-left",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={result.columns.length}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Sem dados no período.
                  </td>
                </tr>
              ) : (
                result.rows.map((row) => (
                  <tr
                    key={String(row[result.labelKey])}
                    className="transition-colors hover:bg-surface-1/60"
                  >
                    {result.columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-2.5 align-middle text-[13.5px] first:pl-5 last:pr-5",
                          c.type !== "text"
                            ? "text-right tabular-nums"
                            : "font-medium text-foreground",
                          ci === 0 && c.type === "text" && "max-w-72 truncate",
                        )}
                      >
                        {fmt(row[c.key], c.type)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
