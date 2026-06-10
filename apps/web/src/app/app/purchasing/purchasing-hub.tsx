"use client";

import { FileDown, FilePlus2, Lightbulb, ScrollText } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cancelPurchaseOrderAction,
  confirmPurchaseOrderAction,
  confirmSupplierReturnAction,
  sendPurchaseOrderAction,
} from "@/features/purchasing/actions/purchasing-actions";
import { CreatePoPanel } from "./panels/create-po-panel";
import { CreateQuotationPanel } from "./panels/create-quotation-panel";
import { CreateReturnPanel } from "./panels/create-return-panel";
import { NfePanel } from "./panels/nfe-panel";
import { QuotationsPanel } from "./panels/quotations-panel";
import { ReceivePanel } from "./panels/receive-panel";
import { SuggestionsPanel } from "./panels/suggestions-panel";

// ── Tipos compartilhados ────────────────────────────────────────────
type View = "orders" | "returns";

type POSummary = {
  id: string;
  status: string;
  total: unknown;
  createdAt: Date;
  supplier: { id: string; name: string } | null;
  items: { id: string }[];
};

type SupplierReturn = {
  id: string;
  status: string;
  reason: string;
  createdAt: Date;
  supplier: { id: string; name: string } | null;
};

type Props = {
  view: View;
  orders: { rows: POSummary[]; total: number; page: number; statusFilter: string };
  returns: { rows: SupplierReturn[] };
  // Dados dos painéis
  suggestions: Parameters<typeof SuggestionsPanel>[0]["suggestions"];
  quotations: Parameters<typeof QuotationsPanel>[0]["quotations"];
  nfeImports: Parameters<typeof NfePanel>[0]["imports"];
  locations: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string; sku: string | null }[];
  confirmedReceipts: { id: string; createdAt: Date; supplierName: string }[];
  /** Quando presente (via ?receive=poId), abre o painel de recebimento ao carregar. */
  initialReceivePoId?: string | null;
};

// status → { variant Badge, label }
type StatusMeta = { variant: BadgeProps["variant"]; label: string };

const PO_STATUS: Record<string, StatusMeta> = {
  DRAFT: { variant: "outline", label: "Rascunho" },
  SENT: { variant: "info", label: "Enviado" },
  CONFIRMED: { variant: "warning", label: "Confirmado" },
  RECEIVING: { variant: "soft", label: "Recebendo" },
  RECEIVED: { variant: "success", label: "Recebido" },
  CANCELED: { variant: "destructive", label: "Cancelado" },
};
const PO_FILTERS = Object.keys(PO_STATUS);

const RETURN_STATUS: Record<string, StatusMeta> = {
  DRAFT: { variant: "warning", label: "Rascunho" },
  CONFIRMED: { variant: "success", label: "Confirmado" },
  CANCELED: { variant: "outline", label: "Cancelado" },
};
const RETURN_REASON_LABELS: Record<string, string> = {
  DEFECT: "Defeito/Avaria",
  EXPIRY: "Vencimento",
  WRONG_ITEM: "Item Errado",
  OVERSTOCK: "Excesso de Estoque",
  OTHER: "Outro",
};

const VIEWS: { key: View; label: string }[] = [
  { key: "orders", label: "Pedidos" },
  { key: "returns", label: "Devoluções" },
];

const brl = (v: unknown) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatusBadge({ meta }: { meta: StatusMeta | undefined }) {
  if (!meta) return <Badge variant="outline">—</Badge>;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

type PanelKind =
  | "receive"
  | "suggestions"
  | "quotations"
  | "nfe"
  | "create-po"
  | "create-quotation"
  | "create-return"
  | null;

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function PurchasingHub({
  view,
  orders,
  returns,
  suggestions,
  quotations,
  nfeImports,
  locations,
  suppliers,
  products,
  confirmedReceipts,
  initialReceivePoId,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelKind>(initialReceivePoId ? "receive" : null);
  const [receivePoId, setReceivePoId] = useState<string | null>(initialReceivePoId ?? null);

  // ── Navegação por URL (preserva deep-link / paginação) ────────────
  const setParam = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const setView = (v: View) =>
    setParam((p) => {
      p.set("view", v);
      p.delete("page");
      p.delete("status");
      p.delete("overdue");
    });

  const setStatus = (value: string) =>
    setParam((p) => {
      if (value) p.set("status", value);
      else p.delete("status");
      p.delete("page");
    });

  const setPage = (pg: number) => setParam((p) => p.set("page", String(pg)));

  // ── Ações ─────────────────────────────────────────────────────────
  const runAction = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (!r.success) setActionError(r.error ?? "Erro");
      else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  const handleSend = (id: string) => runAction(() => sendPurchaseOrderAction(id));
  const handleConfirm = (id: string) => runAction(() => confirmPurchaseOrderAction(id));
  const handleCancel = (id: string) => {
    const reason = prompt("Motivo do cancelamento:");
    if (!reason) return;
    runAction(() => cancelPurchaseOrderAction(id, reason));
  };
  const openReceive = (poId: string) => {
    setReceivePoId(poId);
    setPanel("receive");
  };
  const handleConfirmReturn = (id: string) => {
    if (!confirm("Confirmar devolução? Isso removerá o estoque.")) return;
    runAction(() => confirmSupplierReturnAction(id));
  };

  const activePage = orders.page;
  const activeTotalPages = Math.ceil(orders.total / 20);

  const primaryCreate =
    view === "returns"
      ? { label: "Nova devolução", action: () => setPanel("create-return") }
      : { label: "Novo pedido", action: () => setPanel("create-po") };

  return (
    <div className="w-full p-6 space-y-5">
      {/* Header + ações globais */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos, recebimento, NFe, sugestões, cotações e devoluções.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPanel("suggestions")}>
            <Lightbulb className="h-4 w-4" /> Sugestões
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPanel("quotations")}>
            <ScrollText className="h-4 w-4" /> Cotações
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPanel("nfe")}>
            <FileDown className="h-4 w-4" /> Importar NFe
          </Button>
          {primaryCreate && (
            <Button size="sm" onClick={primaryCreate.action}>
              <FilePlus2 className="h-4 w-4" /> {primaryCreate.label}
            </Button>
          )}
        </div>
      </div>

      {/* Segmented control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-surface-1 p-1">
          {VIEWS.map((v) => (
            <button
              type="button"
              key={v.key}
              onClick={() => setView(v.key)}
              className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                view === v.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* ── VIEW: Pedidos ─────────────────────────────────────────── */}
      {view === "orders" && (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={orders.statusFilter === ""} onClick={() => setStatus("")}>
              Todos
            </FilterPill>
            {PO_FILTERS.map((s) => (
              <FilterPill key={s} active={orders.statusFilter === s} onClick={() => setStatus(s)}>
                {PO_STATUS[s]?.label}
              </FilterPill>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-1">
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>Fornecedor</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={TH}>Itens</th>
                  <th className={TH}>Data</th>
                  <th className={`${TH} text-right`}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                ) : (
                  orders.rows.map((po) => (
                    <tr key={po.id} className="transition-colors hover:bg-surface-1">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => router.push(`/app/purchasing/orders/${po.id}`)}
                          className="cursor-pointer font-mono text-xs text-primary hover:underline"
                        >
                          {po.id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-foreground">{po.supplier?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge meta={PO_STATUS[po.status]} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                        {brl(po.total)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{po.items.length}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(po.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {po.status === "DRAFT" && (
                            <Button size="sm" variant="soft" onClick={() => handleSend(po.id)}>
                              Enviar
                            </Button>
                          )}
                          {po.status === "SENT" && (
                            <Button size="sm" variant="soft" onClick={() => handleConfirm(po.id)}>
                              Confirmar
                            </Button>
                          )}
                          {(po.status === "CONFIRMED" || po.status === "RECEIVING") && (
                            <Button size="sm" onClick={() => openReceive(po.id)}>
                              Receber
                            </Button>
                          )}
                          {["DRAFT", "SENT", "CONFIRMED"].includes(po.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive-soft"
                              onClick={() => handleCancel(po.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── VIEW: Devoluções ──────────────────────────────────────── */}
      {view === "returns" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-1">
              <tr>
                <th className={TH}>ID</th>
                <th className={TH}>Fornecedor</th>
                <th className={TH}>Motivo</th>
                <th className={TH}>Status</th>
                <th className={TH}>Data</th>
                <th className={`${TH} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {returns.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma devolução registrada.
                  </td>
                </tr>
              ) : (
                returns.rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-surface-1">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {r.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {RETURN_REASON_LABELS[r.reason] ?? r.reason}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge meta={RETURN_STATUS[r.status]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {r.status === "DRAFT" && (
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => handleConfirmReturn(r.id)}
                          >
                            Confirmar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação (orders) */}
      {view === "orders" && activeTotalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: activeTotalPages }, (_, i) => i + 1).map((pg) => (
            <button
              type="button"
              key={pg}
              onClick={() => setPage(pg)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors ${
                pg === activePage
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:border-border-strong"
              }`}
            >
              {pg}
            </button>
          ))}
        </div>
      )}

      {/* ── Side panels ───────────────────────────────────────────── */}
      <ReceivePanel
        open={panel === "receive"}
        poId={receivePoId}
        onClose={() => setPanel(null)}
        onDone={() => router.refresh()}
      />
      <SuggestionsPanel
        open={panel === "suggestions"}
        suggestions={suggestions}
        locations={locations}
        onClose={() => setPanel(null)}
        onConverted={() => setView("orders")}
      />
      <QuotationsPanel
        open={panel === "quotations"}
        quotations={quotations}
        onClose={() => setPanel(null)}
        onCreate={() => setPanel("create-quotation")}
      />
      <NfePanel
        open={panel === "nfe"}
        imports={nfeImports}
        locations={locations}
        onClose={() => setPanel(null)}
      />
      <CreatePoPanel
        open={panel === "create-po"}
        suppliers={suppliers}
        locations={locations}
        products={products}
        onClose={() => setPanel(null)}
        onCreated={() => {
          setView("orders");
          router.refresh();
        }}
      />
      <CreateQuotationPanel
        open={panel === "create-quotation"}
        suppliers={suppliers}
        locations={locations}
        products={products}
        onClose={() => setPanel(null)}
        onCreated={() => router.refresh()}
      />
      <CreateReturnPanel
        open={panel === "create-return"}
        receipts={confirmedReceipts}
        onClose={() => setPanel(null)}
        onCreated={() => {
          setView("returns");
          router.refresh();
        }}
      />
    </div>
  );
}
