"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

type PO = {
  id: string;
  status: string;
  total: unknown;
  subtotal: unknown;
  discountTotal: unknown;
  freight: unknown;
  notes: string | null;
  expectedDate: Date | null;
  createdAt: Date;
  paymentTerms: unknown;
  supplier: {
    id: string;
    name: string;
    document: string | null;
    email: string | null;
    phone: string | null;
  };
  location: { id: string; name: string } | null;
  items: Array<{
    id: string;
    productNameSnapshot: string;
    expectedQuantity: unknown;
    unitCost: unknown;
    lineTotal: unknown;
    product: { id: string; name: string; sku: string | null } | null;
    variant: { id: string; name: string } | null;
  }>;
  receipts: Array<{
    id: string;
    status: string;
    createdAt: Date;
  }>;
  accountPayables: Array<{
    id: string;
    amount: unknown;
    dueDate: Date;
    status: string;
    installmentNumber: number;
    totalInstallments: number;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    reason: string | null;
    createdAt: Date;
  }>;
};

type Props = { po: PO };

export function PurchaseOrderDetailClient({ po }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSend = () => {
    startTransition(async () => {
      const r = await sendPurchaseOrderAction(po.id);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const handleConfirm = () => {
    startTransition(async () => {
      const r = await confirmPurchaseOrderAction(po.id);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const handleCancel = () => {
    const reason = prompt("Motivo do cancelamento:");
    if (!reason) return;
    startTransition(async () => {
      const r = await cancelPurchaseOrderAction(po.id, reason);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">PO #{po.id.slice(0, 8)}</h1>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? "bg-gray-100 text-gray-700"}`}
            >
              {STATUS_LABELS[po.status] ?? po.status}
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            {po.supplier.name} · {new Date(po.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          {po.status === "DRAFT" && (
            <button
              type="button"
              onClick={handleSend}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Enviar ao Fornecedor
            </button>
          )}
          {po.status === "SENT" && (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
            >
              Confirmar Pedido
            </button>
          )}
          {po.status === "CONFIRMED" && (
            <button
              type="button"
              onClick={() => router.push(`/app/purchasing/receive?poId=${po.id}`)}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
            >
              Registrar Recebimento
            </button>
          )}
          {["DRAFT", "SENT", "CONFIRMED"].includes(po.status) && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-red-300 text-red-700 text-sm rounded-lg hover:bg-red-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Subtotal", value: po.subtotal },
          { label: "Desconto", value: po.discountTotal },
          { label: "Frete", value: po.freight },
          { label: "Total", value: po.total },
        ].map((t) => (
          <div key={t.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{t.label}</p>
            <p className="text-lg font-semibold">
              {Number(t.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        ))}
      </div>

      {/* Itens */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Itens</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Produto</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Qtd</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Custo Unit.</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total Linha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {po.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.productNameSnapshot}</p>
                    {item.variant && <p className="text-xs text-gray-400">{item.variant.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">{Number(item.expectedQuantity)}</td>
                  <td className="px-4 py-3 text-right">
                    {Number(item.unitCost).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {Number(item.lineTotal).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recebimentos */}
      {po.receipts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recebimentos</h2>
          <div className="space-y-2">
            {po.receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
              >
                <span className="font-mono text-xs text-gray-500">{r.id.slice(0, 8)}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {r.status}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/app/purchasing/receive/${r.id}`)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contas a pagar */}
      {po.accountPayables.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Contas a Pagar</h2>
          <div className="space-y-2">
            {po.accountPayables.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
              >
                <span className="text-sm">
                  {p.installmentNumber}/{p.totalInstallments}
                </span>
                <span className="font-semibold">
                  {Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="text-xs text-gray-500">
                  Vence {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === "PAID" ? "bg-green-100 text-green-700" : p.status === "CANCELED" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Histórico */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Histórico</h2>
        <div className="space-y-2">
          {po.history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-xs text-gray-400 w-24 shrink-0">
                {new Date(h.createdAt).toLocaleDateString("pt-BR")}
              </span>
              <span>
                {h.fromStatus ? `${h.fromStatus} → ` : ""}
                <strong>{h.toStatus}</strong>
                {h.reason && ` — ${h.reason}`}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
