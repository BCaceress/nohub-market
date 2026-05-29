"use client";

import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  CLOSED: "Encerrada",
  CONVERTED: "Convertida",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-500",
  CONVERTED: "bg-green-100 text-green-700",
};

type QuotationItem = {
  id: string;
  product: { id: string; name: string } | null;
  quantity: unknown;
};

type SupplierResponse = {
  id: string;
  supplierId: string;
  selected: boolean;
  receivedAt: Date | null;
  totalPrice: unknown;
  leadTimeDays: number | null;
  supplier: { id: string; name: string } | null;
};

type Quotation = {
  id: string;
  description: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  items: QuotationItem[];
  supplierResponses: SupplierResponse[];
};

type Props = { quotations: Quotation[] };

export function QuotationsClient({ quotations }: Props) {
  const router = useRouter();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cotações</h1>
        <button
          type="button"
          onClick={() => router.push("/app/purchasing/quotations/new")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Nova Cotação
        </button>
      </div>

      {quotations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma cotação criada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quotations.map((q) => {
            const respondedCount = q.supplierResponses.filter((r) => r.receivedAt).length;
            const _selected = q.supplierResponses.find((r) => r.selected);

            return (
              <div
                key={q.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Cabeçalho */}
                <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{q.description}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {q.items.length} iten(s) · {respondedCount}/{q.supplierResponses.length}{" "}
                      respostas · criada {new Date(q.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {q.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => router.push(`/app/purchasing/quotations/${q.id}`)}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Gerenciar
                    </button>
                  )}
                </div>

                {/* Comparativo de respostas */}
                {q.supplierResponses.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">
                            Fornecedor
                          </th>
                          <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-600">
                            Prazo (dias)
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">
                            Respondeu?
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {q.supplierResponses.map((r) => (
                          <tr
                            key={r.id}
                            className={r.selected ? "bg-green-50" : "hover:bg-gray-50"}
                          >
                            <td className="px-4 py-3">
                              {r.supplier?.name ?? r.supplierId}
                              {r.selected && (
                                <span className="ml-2 text-xs text-green-600 font-medium">
                                  ✓ Selecionado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {r.totalPrice != null
                                ? Number(r.totalPrice).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">{r.leadTimeDays ?? "—"}</td>
                            <td className="px-4 py-3 text-xs">
                              {r.receivedAt ? (
                                <span className="text-green-600">
                                  {new Date(r.receivedAt).toLocaleDateString("pt-BR")}
                                </span>
                              ) : (
                                <span className="text-gray-400">Aguardando</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
