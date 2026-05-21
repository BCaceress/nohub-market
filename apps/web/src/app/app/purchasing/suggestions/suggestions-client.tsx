"use client";

import {
  convertSuggestionToPOAction,
  dismissSuggestionAction,
  generatePurchaseSuggestionAction,
} from "@/features/purchasing/actions/purchasing-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  suggestions: Suggestion[];
  locations: Location[];
};

export function SuggestionsClient({ suggestions, locations }: Props) {
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
        alert(`${r.purchaseOrderIds.length} pedido(s) criado(s)!`);
        router.push("/app/purchasing/orders");
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sugestões de Compra</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !selectedLocation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {generating ? "Gerando..." : "Gerar Sugestão"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma sugestão pendente.</p>
          <p className="text-sm mt-1">Clique em "Gerar Sugestão" para analisar o estoque.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
                <div>
                  <span className="font-semibold text-sm">Sugestão #{s.id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(s.generatedAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleConvert(s.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium"
                  >
                    Converter em PO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(s.id)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                  >
                    Descartar
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Produto</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">
                        Estoque Atual
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">
                        Venda Média/dia
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">
                        Cobertura (dias)
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">
                        Sugestão Compra
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {s.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {item.product?.name ?? item.productId}
                        </td>
                        <td className="px-4 py-3 text-right">{Number(item.currentStock)}</td>
                        <td className="px-4 py-3 text-right">
                          {Number(item.averageDailySales ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              Number(item.daysOfCoverage ?? 0) < 7
                                ? "text-red-600 font-medium"
                                : "text-gray-700"
                            }
                          >
                            {item.daysOfCoverage !== null
                              ? Number(item.daysOfCoverage).toFixed(1)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-700">
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
    </div>
  );
}
