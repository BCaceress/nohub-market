"use client";

import { inutilizeRangeAction } from "@/features/fiscal/actions/fiscal-actions";
import type { NumberSkipItem } from "@/features/fiscal/actions/fiscal-actions";
import { useState, useTransition } from "react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "Aguardando", color: "bg-yellow-100 text-yellow-700" },
  INUTILIZED: { label: "Inutilizado", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
};

type Props = {
  skips: NumberSkipItem[];
  error: string | null;
};

export function SkipNumbersClient({ skips, error }: Props) {
  const [series, setSeries] = useState("1");
  const [fromNumber, setFromNumber] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [localSkips, setLocalSkips] = useState<NumberSkipItem[]>(skips);

  function handleSubmit() {
    const from = Number.parseInt(fromNumber, 10);
    const to = Number.parseInt(toNumber, 10);

    if (Number.isNaN(from) || Number.isNaN(to) || from < 1 || to < from) {
      setMessage({ type: "error", text: "Faixa de numeração inválida" });
      return;
    }
    if (reason.trim().length < 15) {
      setMessage({ type: "error", text: "Motivo deve ter pelo menos 15 caracteres" });
      return;
    }

    startTransition(async () => {
      const result = await inutilizeRangeAction({
        series: Number.parseInt(series, 10),
        fromNumber: from,
        toNumber: to,
        reason: reason.trim(),
      });

      if (result.success) {
        setMessage({
          type: "success",
          text: `Inutilizado com sucesso — protocolo: ${result.protocol}`,
        });
        setFromNumber("");
        setToNumber("");
        setReason("");
        // Add to local list
        setLocalSkips((prev) => [
          {
            id: result.skipId,
            series: Number.parseInt(series, 10),
            numberStart: from,
            numberEnd: to,
            reason: reason.trim(),
            status: "INUTILIZED",
            requestedBy: "—",
            requestedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Inutilização de Numeração</h1>
      <p className="text-sm text-gray-500">
        Use esta função para inutilizar faixas de números de NFC-e que foram pulados por falha,
        contingência ou outros motivos. Esta operação é comunicada à SEFAZ.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
        >
          {message.text}
        </div>
      )}

      {/* Formulário */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold">Nova Inutilização</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="skip-series" className="block text-sm font-medium text-gray-700 mb-1">
              Série
            </label>
            <input
              id="skip-series"
              type="number"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              min={1}
              max={999}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="skip-from" className="block text-sm font-medium text-gray-700 mb-1">
              Número inicial
            </label>
            <input
              id="skip-from"
              type="number"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              min={1}
              placeholder="Ex: 100"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="skip-to" className="block text-sm font-medium text-gray-700 mb-1">
              Número final
            </label>
            <input
              id="skip-to"
              type="number"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              min={1}
              placeholder="Ex: 105"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="skip-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Motivo <span className="text-gray-400 font-normal">(mínimo 15 caracteres)</span>
          </label>
          <textarea
            id="skip-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Descreva o motivo da inutilização..."
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">{reason.length} caracteres</p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !fromNumber || !toNumber || reason.trim().length < 15}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Processando…" : "Inutilizar numeração"}
        </button>
      </div>

      {/* Histórico */}
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Histórico de Inutilizações</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Série</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Faixa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Motivo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {localSkips.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma inutilização registrada
                </td>
              </tr>
            )}
            {localSkips.map((skip) => {
              const { label, color } = STATUS_LABELS[skip.status] ?? {
                label: skip.status,
                color: "bg-gray-100",
              };
              return (
                <tr key={skip.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{skip.series}</td>
                  <td className="px-4 py-3 font-mono">
                    {skip.numberStart === skip.numberEnd
                      ? skip.numberStart
                      : `${skip.numberStart}–${skip.numberEnd}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">
                    {skip.reason}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
                    >
                      {label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(skip.requestedAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
