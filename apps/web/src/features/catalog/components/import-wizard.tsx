"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiProductLookup } from "@/features/catalog/ai-product-lookup";
import type { OpenFoodFactsProduct } from "@/features/inventory/actions/ai-product-actions";
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Sparkles,
  Square,
  Upload,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { importFromFiscalTemplateAction, importProductRowsAction } from "../actions/import-actions";

/* ── Types ──────────────────────────────────────────────────── */

type FiscalTemplate = {
  id: string;
  productName: string;
  suggestedNcm: string;
  suggestedCest: string | null;
  defaultCfopInternal: string | null;
  segment: string;
  barcode: string | null;
};

type ImportRowResult = {
  row: number;
  input: Record<string, unknown>;
  success: boolean;
  productId?: string;
  error?: string;
};

interface Props {
  organizationId: string;
  templates: FiscalTemplate[];
}

/* ── Segment label ───────────────────────────────────────────── */

const SEGMENT_LABELS: Record<string, string> = {
  BEVERAGE: "Bebidas",
  SNACK: "Salgadinhos / Snacks",
  PERSONAL_HYGIENE: "Higiene Pessoal",
  CLEANING: "Limpeza",
  DAIRY: "Laticínios",
  CONVENIENCE: "Conveniência",
};

/* ── Template tab ────────────────────────────────────────────── */

function TemplateTab({ organizationId, templates }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set(Object.keys(SEGMENT_LABELS)),
  );

  // Group by segment
  const bySegment = templates.reduce<Record<string, FiscalTemplate[]>>((acc, t) => {
    const segmentTemplates = acc[t.segment] ?? [];
    segmentTemplates.push(t);
    acc[t.segment] = segmentTemplates;
    return acc;
  }, {});

  function toggleSegment(seg: string) {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      next.has(seg) ? next.delete(seg) : next.add(seg);
      return next;
    });
  }

  function toggleTemplate(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSegmentAll(seg: string, tpls: FiscalTemplate[]) {
    const ids = tpls.map((t) => t.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of ids) {
          next.delete(id);
        }
      } else {
        for (const id of ids) {
          next.add(id);
        }
      }
      return next;
    });
  }

  async function handleImport() {
    startTransition(async () => {
      const result = await importFromFiscalTemplateAction(organizationId, Array.from(selected));
      if (result.success) {
        setResults(result.data.results);
        const ok = result.data.results.filter((r) => r.success).length;
        const fail = result.data.results.length - ok;
        toast.success(
          `${ok} produto${ok !== 1 ? "s" : ""} importado${ok !== 1 ? "s" : ""}${fail > 0 ? `, ${fail} com erro` : ""}`,
        );
        setSelected(new Set());
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Selecione produtos do catálogo fiscal pré-configurado. Cada produto é criado com NCM, CFOP e
        CST corretos para o regime da sua organização.
      </p>

      {/* Template list by segment */}
      <div className="rounded-xl border border-border overflow-hidden">
        {Object.entries(bySegment).map(([seg, tpls]) => (
          <div key={seg} className="border-b border-border last:border-0">
            {/* Segment header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => toggleSegmentAll(seg, tpls)}
              >
                {tpls.every((t) => selected.has(t.id)) ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => toggleSegment(seg)}
              >
                {expandedSegments.has(seg) ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium flex-1">{SEGMENT_LABELS[seg] ?? seg}</span>
                <Badge variant="secondary" className="text-xs">
                  {tpls.length}
                </Badge>
              </button>
            </div>

            {/* Products */}
            {expandedSegments.has(seg) && (
              <div>
                {tpls.map((tpl) => (
                  <label
                    key={tpl.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors border-t border-border/40 first:border-0"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected.has(tpl.id)}
                      onChange={() => toggleTemplate(tpl.id)}
                    />
                    {selected.has(tpl.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    )}
                    <span className="flex-1 text-sm">{tpl.productName}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {tpl.suggestedNcm}
                    </Badge>
                    {tpl.defaultCfopInternal && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {tpl.defaultCfopInternal}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
        </p>
        <Button onClick={handleImport} disabled={selected.size === 0 || isPending}>
          {isPending
            ? "Importando…"
            : `Importar ${selected.size > 0 ? selected.size : ""} produto${selected.size !== 1 ? "s" : ""}`}
        </Button>
      </div>

      {/* Results */}
      {results && <ImportResults results={results} />}
    </div>
  );
}

/* ── CSV tab ─────────────────────────────────────────────────── */

function CsvTab({ organizationId }: { organizationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setFileName(file.name);

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");

    if (isCsv) {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) {
        toast.error("Arquivo CSV vazio ou sem dados");
        return;
      }
      const headers = (lines[0] ?? "").split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const parsed = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
      });
      setRows(parsed);
      toast.success(`${parsed.length} linhas carregadas`);
    } else if (isXlsx) {
      toast.error("XLSX ainda não é suportado. Exporte como CSV primeiro.");
    } else {
      toast.error("Formato inválido. Use .csv ou .xlsx");
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;
    startTransition(async () => {
      const result = await importProductRowsAction(organizationId, rows);
      if (result.success) {
        setResults(result.data.results);
        const ok = result.data.results.filter((r) => r.success).length;
        const fail = result.data.results.length - ok;
        toast.success(
          `${ok} importado${ok !== 1 ? "s" : ""}${fail > 0 ? `, ${fail} com erro` : ""}`,
        );
        setRows([]);
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Importe produtos a partir de um arquivo CSV. Colunas reconhecidas:{" "}
        <code className="text-xs bg-muted px-1 rounded">name</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">sku</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">barcode</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">brand</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">category</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">price</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">costPrice</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">unit</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">ncm</code>,{" "}
        <code className="text-xs bg-muted px-1 rounded">cest</code>.
      </p>

      {/* Download template */}
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
        <p className="text-xs text-muted-foreground mb-2">Modelo CSV</p>
        <a
          href={
            "data:text/csv;charset=utf-8,name,sku,barcode,brand,category,price,costPrice,unit,ncm,cest\nProduto Exemplo,SKU-001,7894900011517,Marca,Bebidas,5.99,2.50,UN,,"
          }
          download="modelo-importacao.csv"
          className="text-xs text-primary underline underline-offset-2"
        >
          Baixar modelo-importacao.csv
        </a>
      </div>

      {/* File dropzone */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="csv-upload"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/10 hover:bg-muted/20"
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium">
            {fileName || "Arraste o arquivo ou clique para selecionar"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">.csv ou .xlsx · até 500 linhas</p>
          <input
            ref={fileRef}
            id="csv-upload"
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {/* Preview */}
      {rows.length > 0 && rows[0] && (
        <div className="rounded-lg border border-border overflow-auto max-h-48">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                {Object.keys(rows[0] as Record<string, unknown>)
                  .slice(0, 6)
                  .map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                {Object.keys(rows[0] as Record<string, unknown>).length > 6 && (
                  <th className="px-3 py-1.5 text-left font-medium">…</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row) => (
                <tr key={JSON.stringify(row)} className="border-t border-border/40">
                  {Object.entries(row as Record<string, unknown>)
                    .slice(0, 6)
                    .map(([key, v]) => (
                      <td key={key} className="px-3 py-1.5 truncate max-w-[120px]">
                        {String(v)}
                      </td>
                    ))}
                </tr>
              ))}
              {rows.length > 5 && (
                <tr className="border-t border-border/40">
                  <td colSpan={7} className="px-3 py-1.5 text-muted-foreground">
                    + {rows.length - 5} linha{rows.length - 5 !== 1 ? "s" : ""} adicionais
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length > 0
            ? `${rows.length} linha${rows.length !== 1 ? "s" : ""} prontas`
            : "Nenhum arquivo selecionado"}
        </p>
        <Button onClick={handleImport} disabled={rows.length === 0 || isPending}>
          {isPending
            ? "Importando…"
            : `Importar ${rows.length > 0 ? rows.length : ""} linha${rows.length !== 1 ? "s" : ""}`}
        </Button>
      </div>

      {results && <ImportResults results={results} />}
    </div>
  );
}

/* ── Manual / barcode tab ────────────────────────────────────── */

function ManualTab() {
  const router = useRouter();

  function handleFound(p: OpenFoodFactsProduct) {
    const params = new URLSearchParams({
      name: p.name,
      brand: p.brand ?? "",
      barcode: p.barcode,
      imageUrl: p.imageUrl ?? "",
    });
    router.push(`/app/products/new?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Busque pelo código de barras (EAN) e preencha os dados automaticamente. Os dados de nome,
        marca e imagem vêm do Open Food Facts.
      </p>
      <div className="rounded-xl border border-border bg-card p-5">
        <AiProductLookup onFound={handleFound} />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Ou{" "}
        <a href="/app/products/new" className="text-primary underline underline-offset-2">
          crie manualmente
        </a>{" "}
        sem usar o código de barras.
      </p>
    </div>
  );
}

/* ── Results panel ────────────────────────────────────────────── */

function ImportResults({ results }: { results: ImportRowResult[] }) {
  const ok = results.filter((r) => r.success);
  const fail = results.filter((r) => !r.success);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
        <span className="text-sm font-medium">Resultado da importação</span>
        <Badge variant="success" className="gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          {ok.length} ok
        </Badge>
        {fail.length > 0 && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <XCircle className="h-3 w-3" />
            {fail.length} erro{fail.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {fail.length > 0 && (
        <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
          {fail.map((r) => (
            <div key={r.row} className="flex items-start gap-3 px-4 py-2.5">
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">
                  Linha {r.row}: {String((r.input as Record<string, unknown>).name ?? "—")}
                </p>
                <p className="text-xs text-muted-foreground">{r.error}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main ImportWizard ───────────────────────────────────────── */

export function ImportWizard({ organizationId, templates }: Props) {
  const [tab, setTab] = useState("template");

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-0">
      <TabsList variant="pills" className="w-fit mb-5">
        <TabsTrigger value="template" variant="pills" icon={<Sparkles className="h-3.5 w-3.5" />}>
          Por template fiscal
        </TabsTrigger>
        <TabsTrigger value="csv" variant="pills" icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
          Planilha CSV
        </TabsTrigger>
        <TabsTrigger value="barcode" variant="pills" icon={<CheckSquare className="h-3.5 w-3.5" />}>
          Código de barras
        </TabsTrigger>
      </TabsList>

      <TabsContent value="template">
        <TemplateTab organizationId={organizationId} templates={templates} />
      </TabsContent>
      <TabsContent value="csv">
        <CsvTab organizationId={organizationId} />
      </TabsContent>
      <TabsContent value="barcode">
        <ManualTab />
      </TabsContent>
    </Tabs>
  );
}
