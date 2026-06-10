"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import {
  convertSuggestionToPOAction,
  dismissSuggestionAction,
  generatePurchaseSuggestionAction,
} from "@/features/purchasing/actions/purchasing-actions";

type SuggestionItem = {
  id: string;
  productId: string;
  suggestedQuantity: unknown;
  currentStock: unknown;
  averageDailySales: unknown;
  daysOfCoverage: unknown;
  suggestedSupplierId: string | null;
  product: { id: string; name: string } | null;
};

type Suggestion = {
  id: string;
  status: string;
  generatedAt: Date;
  locationId: string;
  items: SuggestionItem[];
};

type Location = { id: string; name: string };

type Props = {
  open: boolean;
  suggestions: Suggestion[];
  locations: Location[];
  onClose: () => void;
  /** Após converter em PO — leva para a aba Pedidos. */
  onConverted: () => void;
};

export function SuggestionsPanel({ open, suggestions, locations, onClose, onConverted }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState(locations[0]?.id ?? "");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    if (!selectedLocation) return;
    setGenerating(true);
    startTransition(async () => {
      const r = await generatePurchaseSuggestionAction({ locationId: selectedLocation });
      setGenerating(false);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const handleConvert = (suggestionId: string) => {
    startTransition(async () => {
      const r = await convertSuggestionToPOAction({ suggestionId });
      if (!r.success) setError(r.error);
      else {
        setError(null);
        onConverted();
        onClose();
      }
    });
  };

  const handleDismiss = (suggestionId: string) => {
    if (!confirm("Descartar esta sugestão?")) return;
    startTransition(async () => {
      await dismissSuggestionAction(suggestionId);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-3xl">
      <SheetHeader
        title="Sugestões de Compra"
        description="Gere sugestões a partir do estoque e converta em pedidos de compra."
        onClose={onClose}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="h-8 text-xs"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={handleGenerate} disabled={generating || !selectedLocation}>
              {generating ? "Gerando…" : "Gerar"}
            </Button>
          </div>
        }
      />
      <SheetBody className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {suggestions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <p className="text-base">Nenhuma sugestão pendente.</p>
            <p className="mt-1 text-sm">Clique em "Gerar" para analisar o estoque.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border bg-surface-1 px-5 py-4">
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      Sugestão #{s.id.slice(0, 8)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(s.generatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleConvert(s.id)}>
                      Converter em PO
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDismiss(s.id)}>
                      Descartar
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-1 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Produto</th>
                        <th className="px-4 py-2 text-right font-medium">Estoque</th>
                        <th className="px-4 py-2 text-right font-medium">Venda/dia</th>
                        <th className="px-4 py-2 text-right font-medium">Cobertura</th>
                        <th className="px-4 py-2 text-right font-medium">Sugestão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {s.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {item.product?.name ?? item.productId}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {Number(item.currentStock)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {Number(item.averageDailySales ?? 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={
                                Number(item.daysOfCoverage ?? 0) < 7
                                  ? "font-medium text-destructive"
                                  : "text-foreground"
                              }
                            >
                              {item.daysOfCoverage !== null
                                ? Number(item.daysOfCoverage).toFixed(1)
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                            {Number(item.suggestedQuantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetBody>
    </Sheet>
  );
}
