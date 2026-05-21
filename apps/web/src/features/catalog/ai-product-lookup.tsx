"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/features/catalog/components/barcode-scanner";
import {
  type OpenFoodFactsProduct,
  lookupProductByBarcodeAction,
} from "@/features/inventory/actions/ai-product-actions";
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  Globe,
  ImageIcon,
  Loader2,
  Package,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

/* ── Mobile detection ───────────────────────────────────────── */

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

/* ── Nutriscore badge ───────────────────────────────────────── */

const NUTRISCORE_CONFIG = {
  a: { bg: "bg-green-500", label: "A" },
  b: { bg: "bg-lime-400", label: "B" },
  c: { bg: "bg-yellow-400", label: "C" },
  d: { bg: "bg-orange-400", label: "D" },
  e: { bg: "bg-red-500", label: "E" },
} as const;

function NutriScore({ grade }: { grade: "a" | "b" | "c" | "d" | "e" }) {
  const cfg = NUTRISCORE_CONFIG[grade];
  return (
    <span
      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-white text-xs font-bold ${cfg.bg}`}
      title={`Nutri-Score ${cfg.label}`}
    >
      {cfg.label}
    </span>
  );
}

/* ── Main component ─────────────────────────────────────────── */

interface Props {
  onFound: (product: OpenFoodFactsProduct) => void;
}

export function AiProductLookup({ onFound }: Props) {
  const isMobile = useIsMobile();
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<OpenFoodFactsProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scannerOpen, setScannerOpen] = useState(false);

  function handleLookup(code?: string) {
    const value = (code ?? barcode).trim();
    if (!value) return;
    setBarcode(value);
    setResult(null);
    setError(null);

    startTransition(async () => {
      const res = await lookupProductByBarcodeAction(value);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error);
      }
    });
  }

  function handleScanned(code: string) {
    setScannerOpen(false);
    handleLookup(code);
  }

  const confidenceConfig = {
    high: { label: "Alta confiança", variant: "success" as const },
    medium: { label: "Confiança média", variant: "warning" as const },
    low: { label: "Baixa confiança", variant: "secondary" as const },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Input row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup();
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Código de barras EAN-13 / EAN-8…"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            inputMode="numeric"
            autoFocus
          />
        </div>

        {/* Camera — mobile only (isMobile starts false to avoid SSR mismatch) */}
        {isMobile && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            title="Ler com câmera"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="h-4 w-4" />
          </Button>
        )}

        <Button type="submit" disabled={isPending || !barcode.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </form>

      {/* Hint — câmera só aparece no mobile */}
      <p className="text-xs text-muted-foreground -mt-2">
        Digite o EAN do produto
        {isMobile && (
          <>
            {" "}
            ou{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => setScannerOpen(true)}
            >
              use a câmera
            </button>
          </>
        )}{" "}
        para busca automática.
      </p>

      {/* Camera scanner modal */}
      {scannerOpen && (
        <BarcodeScanner onScanned={handleScanned} onClose={() => setScannerOpen(false)} />
      )}

      {/* Loading */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consultando base de produtos…
        </div>
      )}

      {/* Error */}
      {error && !isPending && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result card */}
      {result && !isPending && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex gap-4 p-4">
            {/* Imagem */}
            <div className="relative h-24 w-24 shrink-0 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
              {result.imageUrl ? (
                <Image
                  src={result.imageUrl}
                  alt={result.name}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>

            {/* Dados */}
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              {/* Nome + badges */}
              <div className="flex items-start gap-2 flex-wrap">
                <p className="font-semibold text-sm leading-snug flex-1">{result.name}</p>
                {result.nutriscoreGrade && <NutriScore grade={result.nutriscoreGrade} />}
                <Badge
                  variant={confidenceConfig[result.confidence].variant}
                  className="shrink-0 text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {confidenceConfig[result.confidence].label}
                </Badge>
              </div>

              {/* Linha de detalhes */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {result.brand && (
                  <span>
                    <span className="font-medium text-foreground/70">Marca:</span> {result.brand}
                  </span>
                )}
                {result.quantity && (
                  <span>
                    <span className="font-medium text-foreground/70">Qtd:</span> {result.quantity}
                  </span>
                )}
                {result.packaging && (
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {result.packaging}
                  </span>
                )}
                {result.category && (
                  <span>
                    <span className="font-medium text-foreground/70">Categoria:</span>{" "}
                    {result.category}
                  </span>
                )}
                {result.isImported && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                    <Globe className="h-3 w-3" />
                    Importado
                  </span>
                )}
              </div>

              {/* Tags */}
              {result.tags && result.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {result.tags.slice(0, 8).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Fonte */}
              <p className="text-[10px] text-muted-foreground/50 mt-auto">
                Código: {result.barcode} ·{" "}
                {result.source === "cosmos_br" ? "Cosmos BR" : "Open Food Facts"}
              </p>
            </div>
          </div>

          <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Campos preenchidos automaticamente. Revise antes de salvar.
            </p>
            <Button size="sm" onClick={() => onFound(result)}>
              Usar estes dados
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
