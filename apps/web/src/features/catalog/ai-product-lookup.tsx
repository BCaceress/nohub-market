"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  lookupProductByBarcodeAction,
  type OpenFoodFactsProduct,
} from "@/features/inventory/actions/ai-product-actions";
import { Barcode, Loader2, CheckCircle2, AlertCircle, ImageIcon } from "lucide-react";
import Image from "next/image";

interface Props {
  onFound: (product: OpenFoodFactsProduct) => void;
}

export function AiProductLookup({ onFound }: Props) {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<OpenFoodFactsProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!barcode.trim()) return;
    setResult(null);
    setError(null);

    startTransition(async () => {
      const res = await lookupProductByBarcodeAction(barcode);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error);
      }
    });
  }

  const confidenceConfig = {
    high: { label: "Alta confiança", variant: "success" as const },
    medium: { label: "Confiança média", variant: "warning" as const },
    low: { label: "Baixa confiança", variant: "secondary" as const },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Barcode input */}
      <form onSubmit={handleLookup} className="flex gap-2">
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Código de barras EAN-13 / EAN-8…"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit" disabled={isPending || !barcode.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex gap-4 p-4">
            {/* Image */}
            <div className="relative h-20 w-20 shrink-0 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
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

            {/* Info */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="font-semibold text-sm leading-snug">{result.name}</p>
                <Badge variant={confidenceConfig[result.confidence].variant} className="shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {confidenceConfig[result.confidence].label}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {result.brand && (
                  <span>
                    <span className="font-medium text-foreground/70">Marca:</span> {result.brand}
                  </span>
                )}
                {result.category && (
                  <span>
                    <span className="font-medium text-foreground/70">Categoria:</span>{" "}
                    {result.category}
                  </span>
                )}
                {result.weight !== undefined && (
                  <span>
                    <span className="font-medium text-foreground/70">Peso:</span>{" "}
                    {result.weight >= 1000
                      ? `${(result.weight / 1000).toFixed(2)} kg`
                      : `${result.weight} g`}
                  </span>
                )}
                <span>
                  <span className="font-medium text-foreground/70">Código:</span> {result.barcode}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                Fonte: Open Food Facts
              </p>
            </div>
          </div>

          <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Os campos serão preenchidos automaticamente. Você pode editá-los antes de salvar.
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
