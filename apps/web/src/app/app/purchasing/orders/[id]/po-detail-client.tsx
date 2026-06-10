"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cancelPurchaseOrderAction,
  confirmPurchaseOrderAction,
  sendPurchaseOrderAction,
} from "@/features/purchasing/actions/purchasing-actions";

const PO_STATUS: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  DRAFT: { variant: "outline", label: "Rascunho" },
  SENT: { variant: "info", label: "Enviado" },
  CONFIRMED: { variant: "warning", label: "Confirmado" },
  RECEIVING: { variant: "soft", label: "Recebendo" },
  RECEIVED: { variant: "success", label: "Recebido" },
  CANCELED: { variant: "destructive", label: "Cancelado" },
};

const brl = (v: unknown) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const SECTION_TITLE = "mb-3 text-lg font-semibold text-foreground";
const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function PurchaseOrderDetailClient({ po }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (!r.success) setError(r.error ?? "Erro");
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const handleSend = () => run(() => sendPurchaseOrderAction(po.id));
  const handleConfirm = () => run(() => confirmPurchaseOrderAction(po.id));
  const handleCancel = () => {
    const reason = prompt("Motivo do cancelamento:");
    if (!reason) return;
    run(() => cancelPurchaseOrderAction(po.id, reason));
  };

  const statusMeta = PO_STATUS[po.status];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Voltar */}
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => router.push("/app/purchasing")}
      >
        ← Compras
      </Button>

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              PO #{po.id.slice(0, 8)}
            </h1>
            <Badge variant={statusMeta?.variant ?? "outline"}>
              {statusMeta?.label ?? po.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {po.supplier.name} · {new Date(po.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          {po.status === "DRAFT" && <Button onClick={handleSend}>Enviar ao Fornecedor</Button>}
          {po.status === "SENT" && <Button onClick={handleConfirm}>Confirmar Pedido</Button>}
          {po.status === "CONFIRMED" && (
            <Button onClick={() => router.push(`/app/purchasing?receive=${po.id}`)}>
              Registrar Recebimento
            </Button>
          )}
          {["DRAFT", "SENT", "CONFIRMED"].includes(po.status) && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive-soft"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Totais */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Subtotal", value: po.subtotal },
          { label: "Desconto", value: po.discountTotal },
          { label: "Frete", value: po.freight },
          { label: "Total", value: po.total, highlight: true },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${t.highlight ? "text-primary" : "text-foreground"}`}
            >
              {brl(t.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Itens */}
      <section>
        <h2 className={SECTION_TITLE}>Itens</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-1">
              <tr>
                <th className={TH}>Produto</th>
                <th className={`${TH} text-right`}>Qtd</th>
                <th className={`${TH} text-right`}>Custo Unit.</th>
                <th className={`${TH} text-right`}>Total Linha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {po.items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-surface-1">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{item.productNameSnapshot}</p>
                    {item.variant && (
                      <p className="text-xs text-muted-foreground">{item.variant.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {Number(item.expectedQuantity)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {brl(item.unitCost)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                    {brl(item.lineTotal)}
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
          <h2 className={SECTION_TITLE}>Recebimentos</h2>
          <div className="space-y-2">
            {po.receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</span>
                <Badge variant={r.status === "CONFIRMED" ? "success" : "outline"}>{r.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/app/purchasing/receive/${r.id}`)}
                  className="cursor-pointer text-xs text-primary hover:underline"
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
          <h2 className={SECTION_TITLE}>Contas a Pagar</h2>
          <div className="space-y-2">
            {po.accountPayables.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">
                  {p.installmentNumber}/{p.totalInstallments}
                </span>
                <span className="font-semibold tabular-nums text-foreground">{brl(p.amount)}</span>
                <span className="text-xs text-muted-foreground">
                  Vence {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                </span>
                <Badge
                  variant={
                    p.status === "PAID"
                      ? "success"
                      : p.status === "CANCELED"
                        ? "outline"
                        : "warning"
                  }
                >
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Histórico */}
      <section>
        <h2 className={SECTION_TITLE}>Histórico</h2>
        <div className="space-y-2">
          {po.history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="w-24 shrink-0 text-xs text-muted-foreground/70">
                {new Date(h.createdAt).toLocaleDateString("pt-BR")}
              </span>
              <span>
                {h.fromStatus ? `${h.fromStatus} → ` : ""}
                <strong className="text-foreground">{h.toStatus}</strong>
                {h.reason && ` — ${h.reason}`}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
