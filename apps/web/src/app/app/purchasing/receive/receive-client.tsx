"use client";

import {
  confirmReceiptAction,
  registerReceiptAction,
} from "@/features/purchasing/actions/purchasing-actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ReadyPO = {
  id: string;
  status: string;
  supplier: { id: string; name: string } | null;
  createdAt: Date;
};

type POItem = {
  id: string;
  productId: string;
  variantId: string | null;
  productNameSnapshot: string;
  expectedQuantity: unknown;
  unitCost: unknown;
  product: { id: string; name: string; sku: string | null } | null;
  variant: { id: string; name: string } | null;
};

type SelectedPO = {
  id: string;
  status: string;
  supplier: { name: string };
  items: POItem[];
};

type ReceiptItemState = {
  purchaseOrderItemId: string;
  productId: string;
  variantId: string | null;
  receivedQuantity: number;
  unitCost: number;
};

type Props = {
  readyPOs: ReadyPO[];
  selectedPO: SelectedPO | null;
};

export function ReceiveClient({ readyPOs, selectedPO }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [items, setItems] = useState<ReceiptItemState[]>(
    selectedPO?.items.map((item) => ({
      purchaseOrderItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      receivedQuantity: Number(item.expectedQuantity),
      unitCost: Number(item.unitCost),
    })) ?? [],
  );

  const updateItem = (idx: number, key: keyof ReceiptItemState, value: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const handleRegister = () => {
    if (!selectedPO) return;
    startTransition(async () => {
      const r = await registerReceiptAction({
        purchaseOrderId: selectedPO.id,
        items,
        supplierInvoiceNumber: invoiceNumber || null,
      });
      if (!r.success) setError(r.error);
      else {
        setError(null);
        setReceiptId(r.receiptId);
      }
    });
  };

  const handleConfirm = () => {
    if (!receiptId) return;
    startTransition(async () => {
      const r = await confirmReceiptAction(receiptId);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        router.push(`/app/purchasing/orders/${selectedPO?.id}`);
      }
    });
  };

  if (!selectedPO) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Receber Mercadorias</h1>
        <p className="text-gray-500">Selecione um pedido para registrar o recebimento:</p>
        <div className="space-y-2">
          {readyPOs.length === 0 ? (
            <p className="text-gray-400">Nenhum pedido aguardando recebimento.</p>
          ) : (
            readyPOs.map((po) => (
              <button
                type="button"
                key={po.id}
                onClick={() => router.push(`/app/purchasing/receive?poId=${po.id}`)}
                className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
              >
                <div>
                  <span className="font-medium">{po.supplier?.name}</span>
                  <span className="text-xs text-gray-400 ml-2">#{po.id.slice(0, 8)}</span>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${po.status === "CONFIRMED" ? "bg-yellow-100 text-yellow-700" : "bg-purple-100 text-purple-700"}`}
                >
                  {po.status}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push("/app/purchasing/receive")}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold">Receber de {selectedPO.supplier.name}</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {receiptId ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4">
            <p className="text-green-700 font-medium">✓ Rascunho de recebimento criado</p>
            <p className="text-sm text-green-600 mt-1">ID: {receiptId.slice(0, 8)}</p>
          </div>
          <p className="text-gray-600 text-sm">
            Confira os itens e confirme o recebimento para atualizar o estoque.
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Confirmar Recebimento (Atualizar Estoque)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="receipt-invoice-number"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Número da Nota Fiscal (opcional)
            </label>
            <input
              id="receipt-invoice-number"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 000001"
            />
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Produto</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Qtd Pedida</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Qtd Recebida</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Custo Unit.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedPO.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.productNameSnapshot}</p>
                      {item.variant && <p className="text-xs text-gray-400">{item.variant.name}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {Number(item.expectedQuantity)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={items[idx]?.receivedQuantity ?? 0}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            "receivedQuantity",
                            Number.parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={items[idx]?.unitCost ?? 0}
                        onChange={(e) =>
                          updateItem(idx, "unitCost", Number.parseFloat(e.target.value) || 0)
                        }
                        className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleRegister}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Registrar Recebimento
          </button>
        </div>
      )}
    </div>
  );
}
