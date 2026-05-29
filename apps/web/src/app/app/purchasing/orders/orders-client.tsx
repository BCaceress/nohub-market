"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  cancelPurchaseOrderAction,
  confirmPurchaseOrderAction,
  sendPurchaseOrderAction,
} from "@/features/purchasing/actions/purchasing-actions";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SENT: "Enviado",
  CONFIRMED: "Confirmado",
  RECEIVING: "Recebendo",
  RECEIVED: "Recebido",
  CANCELED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-yellow-100 text-yellow-800",
  RECEIVING: "bg-purple-100 text-purple-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELED: "bg-red-100 text-red-700",
};

type POSummary = {
  id: string;
  status: string;
  total: unknown;
  createdAt: Date;
  supplier: { id: string; name: string } | null;
  items: { id: string }[];
};

type Props = {
  orders: POSummary[];
  total: number;
  page: number;
  statusFilter: string;
};

export function PurchaseOrdersClient({ orders, total, page, statusFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const setFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("status", value);
      else params.delete("status");
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

  const handleSend = (poId: string) => {
    startTransition(async () => {
      const r = await sendPurchaseOrderAction(poId);
      if (!r.success) setActionError(r.error);
      else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  const handleConfirm = (poId: string) => {
    startTransition(async () => {
      const r = await confirmPurchaseOrderAction(poId);
      if (!r.success) setActionError(r.error);
      else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  const handleCancel = (poId: string) => {
    const reason = prompt("Motivo do cancelamento:");
    if (!reason) return;
    startTransition(async () => {
      const r = await cancelPurchaseOrderAction(poId, reason);
      if (!r.success) setActionError(r.error);
      else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos de Compra</h1>
        <button
          type="button"
          onClick={() => router.push("/app/purchasing/orders/new")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Novo Pedido
        </button>
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 flex-wrap">
        {["", ...Object.keys(STATUS_LABELS)].map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {s ? STATUS_LABELS[s] : "Todos"}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {actionError}
        </div>
      )}

      {/* Tabela */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Fornecedor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Itens</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    <button
                      type="button"
                      onClick={() => router.push(`/app/purchasing/orders/${po.id}`)}
                      className="text-blue-600 hover:underline"
                    >
                      {po.id.slice(0, 8)}
                    </button>
                  </td>
                  <td className="px-4 py-3">{po.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_LABELS[po.status] ?? po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(po.total).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-3">{po.items.length}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(po.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {po.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() => handleSend(po.id)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                        >
                          Enviar
                        </button>
                      )}
                      {po.status === "SENT" && (
                        <button
                          type="button"
                          onClick={() => handleConfirm(po.id)}
                          className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100"
                        >
                          Confirmar
                        </button>
                      )}
                      {po.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => router.push(`/app/purchasing/receive?poId=${po.id}`)}
                          className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                        >
                          Receber
                        </button>
                      )}
                      {["DRAFT", "SENT", "CONFIRMED"].includes(po.status) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(po.id)}
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded text-sm ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
