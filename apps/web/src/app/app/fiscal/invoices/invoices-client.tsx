"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { InvoiceListItem } from "@/features/fiscal/actions/fiscal-actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  SENDING: "Enviando",
  IN_CONTINGENCY: "Contingência",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  DENIED: "Denegada",
  CANCELED: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  SENDING: "bg-blue-100 text-blue-700",
  IN_CONTINGENCY: "bg-yellow-100 text-yellow-700",
  AUTHORIZED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  DENIED: "bg-red-200 text-red-800",
  CANCELED: "bg-gray-200 text-gray-600",
};

type Props = {
  invoices: InvoiceListItem[];
  total: number;
  page: number;
  statusFilter: string;
  error: string | null;
};

export function InvoicesClient({ invoices, total, page, statusFilter, error }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(p));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notas Fiscais</h1>
        <span className="text-sm text-gray-500">
          {total} nota{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setFilter("status", e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nº</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Chave</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Impostos</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Autorização</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma nota fiscal encontrada
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">
                  {inv.number ? `${inv.series}/${String(inv.number).padStart(9, "0")}` : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {inv.accessKey ? `${inv.accessKey.slice(0, 8)}...` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-100"}`}
                  >
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {inv.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                  {inv.totalTax.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {inv.authorizedAt
                    ? new Date(inv.authorizedAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a
                      href={`/app/fiscal/invoices/${inv.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Ver
                    </a>
                    {inv.danfeUrl && (
                      <a
                        href={inv.danfeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline text-xs"
                      >
                        DANFE
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
