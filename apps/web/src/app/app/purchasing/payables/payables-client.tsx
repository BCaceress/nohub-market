"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  PARTIALLY_PAID: "Parcialmente Pago",
  CANCELED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  PARTIALLY_PAID: "bg-blue-100 text-blue-700",
  CANCELED: "bg-gray-100 text-gray-500",
};

type Payable = {
  id: string;
  amount: unknown;
  paidAmount: unknown;
  dueDate: Date;
  status: string;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  supplier: { id: string; name: string } | null;
};

type Props = {
  payables: Payable[];
  total: number;
  page: number;
  statusFilter: string;
  showOverdue: boolean;
};

export function PayablesClient({ payables, total, page, statusFilter, showOverdue }: Props) {
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
  const today = new Date();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Contas a Pagar</h1>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilter("overdue", showOverdue ? "" : "1")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${showOverdue ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
        >
          Vencidas
        </button>
        {["", ...Object.keys(STATUS_LABELS)].map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setFilter("status", s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
          >
            {s ? STATUS_LABELS[s] : "Todos"}
          </button>
        ))}
      </div>

      {/* Sumário */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Pendente",
            value: payables
              .filter((p) => p.status === "PENDING")
              .reduce((s, p) => s + Number(p.amount), 0),
            color: "text-yellow-700",
          },
          {
            label: "Vencidas Hoje",
            value: payables
              .filter((p) => p.status === "PENDING" && new Date(p.dueDate) < today)
              .reduce((s, p) => s + Number(p.amount), 0),
            color: "text-red-700",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-lg font-semibold ${stat.color}`}>
              {stat.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Fornecedor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Descrição</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Parcela</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Valor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimento</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payables.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            ) : (
              payables.map((p) => {
                const isOverdue = p.status === "PENDING" && new Date(p.dueDate) < today;
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3">{p.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{p.description}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.installmentNumber}/{p.totalInstallments}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {Number(p.amount).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}
                    >
                      {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                      {isOverdue && " ⚠"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded text-sm ${p === page ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
