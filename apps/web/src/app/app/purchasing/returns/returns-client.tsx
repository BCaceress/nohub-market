"use client";

import { confirmSupplierReturnAction } from "@/features/purchasing/actions/purchasing-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELED: "bg-gray-100 text-gray-500",
};

type Return = {
  id: string;
  status: string;
  reason: string;
  notes: string | null;
  createdAt: Date;
  supplier: { id: string; name: string } | null;
};

type Receipt = {
  id: string;
  createdAt: Date;
  purchaseOrder: { supplier: { name: string } } | null;
};

type Props = {
  returns: Return[];
  confirmedReceipts: Receipt[];
};

export function ReturnsClient({ returns, confirmedReceipts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = (returnId: string) => {
    if (!confirm("Confirmar devolução? Isso removerá o estoque.")) return;
    startTransition(async () => {
      const r = await confirmSupplierReturnAction(returnId);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const REASON_LABELS: Record<string, string> = {
    DEFECT: "Defeito/Avaria",
    EXPIRY: "Vencimento",
    WRONG_ITEM: "Item Errado",
    OVERSTOCK: "Excesso de Estoque",
    OTHER: "Outro",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devoluções ao Fornecedor</h1>
        <button
          type="button"
          onClick={() => router.push("/app/purchasing/returns/new")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Nova Devolução
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Fornecedor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Motivo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {returns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma devolução registrada.
                </td>
              </tr>
            ) : (
              returns.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{r.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3">{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handleConfirm(r.id)}
                        className="px-3 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                      >
                        Confirmar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
