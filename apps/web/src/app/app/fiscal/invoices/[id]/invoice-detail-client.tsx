"use client";

import { cancelInvoiceAction } from "@/features/fiscal/actions/fiscal-actions";
import type { InvoiceDetail } from "@/features/fiscal/actions/fiscal-actions";
import { useState, useTransition } from "react";

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

const EVENT_LABELS: Record<string, string> = {
  SUBMITTED: "Enviada",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  DENIED: "Denegada",
  CONTINGENCY_ENTERED: "Contingência",
  CONTINGENCY_TRANSMITTED: "Transmitida",
  CANCEL_REQUESTED: "Cancelamento solicitado",
  CANCELED: "Cancelada",
  INUTILIZED: "Inutilizada",
  RETRY_SCHEDULED: "Retry agendado",
};

type Props = { invoice: InvoiceDetail };

export function InvoiceDetailClient({ invoice }: Props) {
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCancel =
    invoice.status === "AUTHORIZED" &&
    invoice.cancelDeadline &&
    new Date() <= new Date(invoice.cancelDeadline);

  function handleCancel() {
    if (cancelReason.trim().length < 15) {
      setMessage({ type: "error", text: "Motivo deve ter pelo menos 15 caracteres" });
      return;
    }
    startTransition(async () => {
      const result = await cancelInvoiceAction({ invoiceId: invoice.id, reason: cancelReason });
      if (result.success) {
        setMessage({ type: "success", text: "Nota fiscal cancelada com sucesso" });
        setShowCancelForm(false);
        // Reload to refresh status
        window.location.reload();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Nota Fiscal</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium ${STATUS_COLORS[invoice.status] ?? "bg-gray-100"}`}
            >
              {STATUS_LABELS[invoice.status] ?? invoice.status}
            </span>
          </div>
          {invoice.number && (
            <p className="text-gray-500 text-sm mt-1">
              Série {invoice.series} / Número {String(invoice.number).padStart(9, "0")}
            </p>
          )}
        </div>
        <a href="/app/fiscal/invoices" className="text-sm text-blue-600 hover:underline">
          ← Voltar
        </a>
      </div>

      {message && (
        <div
          className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
        >
          {message.text}
        </div>
      )}

      {/* Dados principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
            Identificação
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">ID interno</dt>
              <dd className="font-mono text-xs">{invoice.id.slice(0, 12)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Pedido</dt>
              <dd>
                <a
                  href={`/app/sales/orders/${invoice.orderId}`}
                  className="text-blue-600 hover:underline text-xs font-mono"
                >
                  {invoice.orderId.slice(0, 12)}…
                </a>
              </dd>
            </div>
            {invoice.accessKey && (
              <div>
                <dt className="text-gray-500 mb-1">Chave de acesso</dt>
                <dd className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                  {invoice.accessKey}
                </dd>
              </div>
            )}
            {invoice.protocol && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Protocolo</dt>
                <dd className="font-mono text-xs">{invoice.protocol}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Valores</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Total</dt>
              <dd className="font-mono font-semibold">
                {invoice.totalAmount.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Impostos</dt>
              <dd className="font-mono text-gray-600">
                {invoice.totalTax.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Datas</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Criada</dt>
              <dd className="text-xs">{new Date(invoice.createdAt).toLocaleString("pt-BR")}</dd>
            </div>
            {invoice.authorizedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Autorizada</dt>
                <dd className="text-xs">
                  {new Date(invoice.authorizedAt).toLocaleString("pt-BR")}
                </dd>
              </div>
            )}
            {invoice.cancelDeadline && invoice.status === "AUTHORIZED" && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Prazo cancelamento</dt>
                <dd
                  className={`text-xs ${canCancel ? "text-orange-600 font-medium" : "text-red-600"}`}
                >
                  {new Date(invoice.cancelDeadline).toLocaleString("pt-BR")}
                </dd>
              </div>
            )}
            {invoice.canceledAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Cancelada</dt>
                <dd className="text-xs">{new Date(invoice.canceledAt).toLocaleString("pt-BR")}</dd>
              </div>
            )}
          </dl>
        </div>

        {(invoice.rejectionReason || invoice.cancelReason) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
            <h2 className="font-semibold text-sm text-red-700 uppercase tracking-wide">
              {invoice.cancelReason ? "Cancelamento" : "Rejeição"}
            </h2>
            <p className="text-sm text-red-700">
              {invoice.cancelReason ?? invoice.rejectionReason}
            </p>
            {invoice.rejectionCode && (
              <p className="text-xs text-red-500">Código SEFAZ: {invoice.rejectionCode}</p>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-3 flex-wrap">
        {invoice.danfeUrl && (
          <a
            href={invoice.danfeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Abrir DANFE
          </a>
        )}
        {invoice.qrCode && (
          <a
            href={invoice.qrCode}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            QR Code
          </a>
        )}
        {canCancel && !showCancelForm && (
          <button
            type="button"
            onClick={() => setShowCancelForm(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
          >
            Cancelar nota
          </button>
        )}
      </div>

      {/* Formulário de cancelamento */}
      {showCancelForm && (
        <div className="rounded-lg border border-red-200 p-4 space-y-3 bg-red-50">
          <h3 className="font-semibold text-red-800">Cancelar Nota Fiscal</h3>
          <p className="text-sm text-red-700">
            O cancelamento é irreversível. O pedido deve estar cancelado. Prazo:{" "}
            {invoice.cancelDeadline
              ? new Date(invoice.cancelDeadline).toLocaleString("pt-BR")
              : "—"}
            .
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento (mínimo 15 caracteres)"
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">{cancelReason.length} / 15 mínimo</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending || cancelReason.trim().length < 15}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setMessage(null);
              }}
              className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Timeline de eventos */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Timeline</h2>
        <ol className="space-y-3">
          {invoice.events.map((ev, idx) => (
            <li key={ev.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1 ${idx === invoice.events.length - 1 ? "bg-blue-500" : "bg-gray-300"}`}
                />
                {idx < invoice.events.length - 1 && (
                  <div className="w-px flex-1 bg-gray-200 mt-1" />
                )}
              </div>
              <div className="pb-3 flex-1">
                <p className="text-sm font-medium">
                  {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                  <span className="text-xs text-gray-400 ml-2">
                    {ev.fromStatus && ev.toStatus !== ev.fromStatus
                      ? `${ev.fromStatus} → ${ev.toStatus}`
                      : ev.toStatus}
                  </span>
                </p>
                {ev.note && <p className="text-xs text-gray-500 mt-0.5">{ev.note}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(ev.createdAt).toLocaleString("pt-BR")}
                  {ev.source !== "INTERNAL" && (
                    <span className="ml-2 text-gray-300">({ev.source})</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
