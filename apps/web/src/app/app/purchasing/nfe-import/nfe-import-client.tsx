"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { importNfeXmlAction } from "@/features/purchasing/actions/purchasing-actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARSED: "Aguardando Mapeamento",
  MAPPED: "Mapeado",
  CONFIRMED: "Confirmado",
  REJECTED: "Rejeitado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PARSED: "bg-yellow-100 text-yellow-700",
  MAPPED: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

type NfeImport = {
  id: string;
  accessKey: string;
  status: string;
  uploadedAt: Date;
  supplierId: string | null;
  purchaseOrderId: string | null;
};

type Location = { id: string; name: string };

type Props = {
  imports: NfeImport[];
  locations: Location[];
};

export function NfeImportClient({ imports, locations }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !locationId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlContent = e.target?.result as string;
      startTransition(async () => {
        const r = await importNfeXmlAction({ locationId, xmlContent, autoMap: true });
        if (!r.success) {
          setError(r.error);
        } else {
          setError(null);
          if (r.mappingPending) {
            setSuccess(`NFe importada. ${r.unmappedCount} item(ns) precisam de mapeamento manual.`);
          } else {
            setSuccess("NFe importada e mapeada automaticamente. Pronta para confirmação.");
          }
          router.refresh();
        }
      });
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Importar NFe de Entrada</h1>

      {/* Upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Upload de XML</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nfe-location" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade Destino
            </label>
            <select
              id="nfe-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nfe-xml" className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo XML
            </label>
            <input
              id="nfe-xml"
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml"
              className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 file:mr-3 file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:py-1 file:px-3 file:rounded cursor-pointer"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleFileUpload}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Importar NFe
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm">
          {success}
        </div>
      )}

      {/* Histórico */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">Histórico de Importações</h2>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Chave de Acesso</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma importação registrada.
                  </td>
                </tr>
              ) : (
                imports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{imp.accessKey}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[imp.status] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {STATUS_LABELS[imp.status] ?? imp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(imp.uploadedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {imp.purchaseOrderId && (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/app/purchasing/orders/${imp.purchaseOrderId}`)
                          }
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver Pedido
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
    </div>
  );
}
