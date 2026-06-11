"use client";

import { FolderTree, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markSettlementSettledAction } from "@/features/financeiro/actions/financeiro-actions";
import { CategoryPanel } from "./panels/category-panel";
import { CreateReceivablePanel } from "./panels/create-receivable-panel";
import { PayablePaymentPanel, type PayablePaymentTarget } from "./panels/payable-payment-panel";
import {
  ReceivableReceiptPanel,
  type ReceivableReceiptTarget,
} from "./panels/receivable-receipt-panel";

// ── Tipos ────────────────────────────────────────────────────────────
type Bucket = { open: number; today: number; next7: number; overdue: number };

type Overview = {
  payable: Bucket;
  receivable: Bucket;
  settlements: { pendingNet: number; pendingCount: number };
  openCashSessions: number;
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
  category: { id: string; name: string } | null;
};

type Receivable = {
  id: string;
  amount: unknown;
  receivedAmount: unknown;
  dueDate: Date;
  status: string;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  customer: { id: string; name: string | null } | null;
  category: { id: string; name: string } | null;
};

type Settlement = {
  id: string;
  grossAmount: unknown;
  feeAmount: unknown;
  netAmount: unknown;
  expectedDate: Date;
  status: string;
  provider: string | null;
  payment: { method: string; orderId: string; confirmedAt: Date | null } | null;
};

type Session = {
  id: string;
  status: string;
  operatorId: string;
  openingAmount: unknown;
  closingAmount: unknown;
  divergence: unknown;
  openedAt: Date;
  closedAt: Date | null;
  location: { name: string } | null;
  _count: { orders: number };
};

type CashFlow = {
  realized: { inflow: number; outflow: number; net: number };
  projected: { inflow: number; outflow: number; net: number };
  byDay: { date: string; inflow: number; outflow: number }[];
};

type Dre = {
  income: { categoryId: string | null; name: string; total: number }[];
  expense: { categoryId: string | null; name: string; total: number }[];
  totalIncome: number;
  totalExpense: number;
  result: number;
};

type Category = { id: string; name: string; kind: string };

type Props = {
  overview: Overview;
  cashflow: CashFlow;
  dre: Dre;
  categories: Category[];
  customers: { id: string; name: string | null }[];
  payables: Payable[];
  receivables: Receivable[];
  settlements: Settlement[];
  sessions: Session[];
};

type StatusMeta = { variant: BadgeProps["variant"]; label: string };

const PAY_STATUS: Record<string, StatusMeta> = {
  PENDING: { variant: "warning", label: "Pendente" },
  PARTIALLY_PAID: { variant: "info", label: "Parcial" },
  PAID: { variant: "success", label: "Pago" },
  CANCELED: { variant: "outline", label: "Cancelado" },
};
const RECV_STATUS: Record<string, StatusMeta> = {
  PENDING: { variant: "warning", label: "Pendente" },
  PARTIALLY_RECEIVED: { variant: "info", label: "Parcial" },
  RECEIVED: { variant: "success", label: "Recebido" },
  CANCELED: { variant: "outline", label: "Cancelado" },
};
const SETTLE_STATUS: Record<string, StatusMeta> = {
  PENDING: { variant: "warning", label: "A liquidar" },
  SETTLED: { variant: "success", label: "Liquidado" },
  CANCELED: { variant: "outline", label: "Cancelado" },
};
const SESSION_STATUS: Record<string, StatusMeta> = {
  OPEN: { variant: "info", label: "Aberto" },
  CLOSED: { variant: "outline", label: "Fechado" },
};
const METHOD_LABELS: Record<string, string> = {
  CARD_PRESENT: "Cartão presencial",
  CARD_CREDIT: "Cartão crédito",
  CARD_DEBIT: "Cartão débito",
  CARD_ONLINE: "Cartão online",
};

const SECTIONS = [
  { id: "overview", label: "Visão geral" },
  { id: "pagar", label: "A pagar" },
  { id: "receber", label: "A receber" },
  { id: "fluxo", label: "Fluxo de caixa" },
  { id: "conciliacao", label: "Conciliação" },
  { id: "caixas", label: "Caixas" },
  { id: "dre", label: "DRE" },
];

const brl = (v: unknown) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";

function StatusBadge({ meta }: { meta: StatusMeta | undefined }) {
  if (!meta) return <Badge variant="outline">—</Badge>;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "destructive" | "info" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "info"
          ? "text-info"
          : tone === "success"
            ? "text-success"
            : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function Section({
  active,
  title,
  subtitle,
  action,
  children,
}: {
  active: boolean;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!active) return null;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FinanceiroHub({
  overview,
  cashflow,
  dre,
  categories,
  customers,
  payables,
  receivables,
  settlements,
  sessions,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState("overview");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreateReceivable, setShowCreateReceivable] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [payTarget, setPayTarget] = useState<PayablePaymentTarget | null>(null);
  const [recvTarget, setRecvTarget] = useState<ReceivableReceiptTarget | null>(null);

  const today = new Date();

  const handleSettle = (id: string) => {
    startTransition(async () => {
      const r = await markSettlementSettledAction(id);
      if (!r.success) setActionError(r.error);
      else {
        setActionError(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Contas a pagar e receber, fluxo de caixa, conciliação de cartão, caixas e DRE.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategories(true)}>
            <FolderTree className="h-4 w-4" /> Categorias
          </Button>
          <Button size="sm" onClick={() => setShowCreateReceivable(true)}>
            <Plus className="h-4 w-4" /> Conta a receber
          </Button>
        </div>
      </div>

      {/* Abas — cada uma com sua visão */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface-1 p-1">
        {SECTIONS.map((s) => (
          <button
            type="button"
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === s.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* ── Visão geral ───────────────────────────────────────────── */}
      <Section active={tab === "overview"} title="Visão geral">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="A pagar (aberto)" value={brl(overview.payable.open)} tone="warning" />
          <Kpi label="A pagar vencido" value={brl(overview.payable.overdue)} tone="destructive" />
          <Kpi label="A receber (aberto)" value={brl(overview.receivable.open)} tone="info" />
          <Kpi
            label="A receber vencido"
            value={brl(overview.receivable.overdue)}
            tone="destructive"
          />
          <Kpi label="Vence hoje (pagar)" value={brl(overview.payable.today)} />
          <Kpi label="Vence hoje (receber)" value={brl(overview.receivable.today)} />
          <Kpi
            label="A liquidar (cartão)"
            value={brl(overview.settlements.pendingNet)}
            tone="info"
          />
          <Kpi label="Caixas abertos" value={String(overview.openCashSessions)} />
        </div>

        {(overview.payable.overdue > 0 ||
          overview.openCashSessions > 0 ||
          overview.settlements.pendingCount > 0) && (
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <p className="text-sm font-semibold text-foreground">Alertas</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {overview.payable.overdue > 0 && (
                <li>⚠ {brl(overview.payable.overdue)} em contas a pagar vencidas.</li>
              )}
              {overview.openCashSessions > 0 && (
                <li>● {overview.openCashSessions} caixa(s) ainda aberto(s).</li>
              )}
              {overview.settlements.pendingCount > 0 && (
                <li>
                  ● {overview.settlements.pendingCount} liquidação(ões) de cartão pendente(s).
                </li>
              )}
            </ul>
          </div>
        )}
      </Section>

      {/* ── Contas a pagar ────────────────────────────────────────── */}
      <Section
        active={tab === "pagar"}
        title="Contas a pagar"
        subtitle={`${payables.length} em aberto · ${brl(overview.payable.open)}`}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-1">
              <tr>
                <th className={TH}>Fornecedor</th>
                <th className={TH}>Descrição</th>
                <th className={TH}>Parcela</th>
                <th className={`${TH} text-right`}>Valor</th>
                <th className={`${TH} text-right`}>Em aberto</th>
                <th className={TH}>Vencimento</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma conta a pagar em aberto.
                  </td>
                </tr>
              ) : (
                payables.map((p) => {
                  const isOverdue = new Date(p.dueDate) < today;
                  const remaining = Number(p.amount) - Number(p.paidAmount);
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-surface-1 ${isOverdue ? "bg-destructive-soft/40" : ""}`}
                    >
                      <td className="px-4 py-3 text-foreground">{p.supplier?.name ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                        {p.description}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.installmentNumber}/{p.totalInstallments}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {brl(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-warning">
                        {brl(remaining)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${isOverdue ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {new Date(p.dueDate).toLocaleDateString("pt-BR")}
                        {isOverdue && " ⚠"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge meta={PAY_STATUS[p.status]} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() =>
                              setPayTarget({
                                id: p.id,
                                description: p.description,
                                amount: Number(p.amount),
                                paidAmount: Number(p.paidAmount),
                                supplierName: p.supplier?.name ?? "—",
                              })
                            }
                          >
                            Baixar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Contas a receber ──────────────────────────────────────── */}
      <Section
        active={tab === "receber"}
        title="Contas a receber"
        subtitle={`${receivables.length} em aberto · ${brl(overview.receivable.open)}`}
        action={
          <Button size="sm" variant="outline" onClick={() => setShowCreateReceivable(true)}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        }
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-1">
              <tr>
                <th className={TH}>Cliente</th>
                <th className={TH}>Descrição</th>
                <th className={TH}>Parcela</th>
                <th className={`${TH} text-right`}>Valor</th>
                <th className={`${TH} text-right`}>Em aberto</th>
                <th className={TH}>Vencimento</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma conta a receber em aberto. Crie em “Nova conta”.
                  </td>
                </tr>
              ) : (
                receivables.map((r) => {
                  const isOverdue = new Date(r.dueDate) < today;
                  const remaining = Number(r.amount) - Number(r.receivedAmount);
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-surface-1 ${isOverdue ? "bg-destructive-soft/40" : ""}`}
                    >
                      <td className="px-4 py-3 text-foreground">{r.customer?.name ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                        {r.description}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.installmentNumber}/{r.totalInstallments}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {brl(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-info">
                        {brl(remaining)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${isOverdue ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {new Date(r.dueDate).toLocaleDateString("pt-BR")}
                        {isOverdue && " ⚠"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge meta={RECV_STATUS[r.status]} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() =>
                              setRecvTarget({
                                id: r.id,
                                description: r.description,
                                amount: Number(r.amount),
                                receivedAmount: Number(r.receivedAmount),
                                customerName: r.customer?.name ?? "—",
                              })
                            }
                          >
                            Baixar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Fluxo de caixa ────────────────────────────────────────── */}
      <Section active={tab === "fluxo"} title="Fluxo de caixa">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Realizado (últimos 30 dias)</p>
            <div className="mt-2 space-y-1 text-sm">
              <Row label="Entradas" value={brl(cashflow.realized.inflow)} tone="success" />
              <Row label="Saídas" value={brl(cashflow.realized.outflow)} tone="destructive" />
              <Row label="Saldo" value={brl(cashflow.realized.net)} bold />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Projetado (próximos 30 dias)</p>
            <div className="mt-2 space-y-1 text-sm">
              <Row label="A receber" value={brl(cashflow.projected.inflow)} tone="success" />
              <Row label="A pagar" value={brl(cashflow.projected.outflow)} tone="destructive" />
              <Row label="Saldo projetado" value={brl(cashflow.projected.net)} bold />
            </div>
          </div>
        </div>
        {cashflow.byDay.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-1">
                <tr>
                  <th className={TH}>Dia</th>
                  <th className={`${TH} text-right`}>Entradas</th>
                  <th className={`${TH} text-right`}>Saídas</th>
                  <th className={`${TH} text-right`}>Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cashflow.byDay.map((d) => (
                  <tr key={d.date} className="hover:bg-surface-1">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(d.date).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">
                      {brl(d.inflow)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">
                      {brl(d.outflow)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {brl(d.inflow - d.outflow)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Conciliação ───────────────────────────────────────────── */}
      <Section
        active={tab === "conciliacao"}
        title="Conciliação de cartão"
        subtitle={`${settlements.length} a liquidar · ${brl(overview.settlements.pendingNet)} líquido`}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-1">
              <tr>
                <th className={TH}>Método</th>
                <th className={`${TH} text-right`}>Bruto</th>
                <th className={`${TH} text-right`}>Taxa</th>
                <th className={`${TH} text-right`}>Líquido</th>
                <th className={TH}>Previsão</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma liquidação de cartão pendente.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-surface-1">
                    <td className="px-4 py-3 text-foreground">
                      {METHOD_LABELS[s.payment?.method ?? ""] ?? s.payment?.method ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {brl(s.grossAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">
                      −{brl(s.feeAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-success">
                      {brl(s.netAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(s.expectedDate).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge meta={SETTLE_STATUS[s.status]} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button size="sm" variant="soft" onClick={() => handleSettle(s.id)}>
                          Marcar liquidado
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Caixas ────────────────────────────────────────────────── */}
      <Section active={tab === "caixas"} title="Caixas">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-1">
              <tr>
                <th className={TH}>Unidade</th>
                <th className={`${TH} text-right`}>Abertura</th>
                <th className={`${TH} text-right`}>Fechamento</th>
                <th className={`${TH} text-right`}>Divergência</th>
                <th className={TH}>Pedidos</th>
                <th className={TH}>Aberto em</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma sessão de caixa registrada.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const div = s.divergence == null ? null : Number(s.divergence);
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-surface-1">
                      <td className="px-4 py-3 text-foreground">{s.location?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {brl(s.openingAmount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {s.closingAmount == null ? "—" : brl(s.closingAmount)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${div && Math.abs(div) > 0.001 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {div == null ? "—" : brl(div)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s._count.orders}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(s.openedAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge meta={SESSION_STATUS[s.status]} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── DRE ───────────────────────────────────────────────────── */}
      <Section
        active={tab === "dre"}
        title="DRE simplificado"
        subtitle="Realizado do mês por categoria."
        action={
          <Button variant="outline" size="sm" onClick={() => setShowCategories(true)}>
            <FolderTree className="h-4 w-4" /> Gerenciar categorias
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DreCard title="Receitas" rows={dre.income} total={dre.totalIncome} tone="success" />
          <DreCard
            title="Despesas"
            rows={dre.expense}
            total={dre.totalExpense}
            tone="destructive"
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Row
            label="Resultado do período"
            value={brl(dre.result)}
            bold
            tone={dre.result >= 0 ? "success" : "destructive"}
          />
        </div>
      </Section>

      {/* ── Painéis ───────────────────────────────────────────────── */}
      <PayablePaymentPanel
        open={payTarget !== null}
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onDone={() => router.refresh()}
      />
      <ReceivableReceiptPanel
        open={recvTarget !== null}
        target={recvTarget}
        onClose={() => setRecvTarget(null)}
        onDone={() => router.refresh()}
      />
      <CreateReceivablePanel
        open={showCreateReceivable}
        customers={customers}
        categories={categories}
        onClose={() => setShowCreateReceivable(false)}
        onCreated={() => router.refresh()}
      />
      <CategoryPanel
        open={showCategories}
        categories={categories}
        onClose={() => setShowCategories(false)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
  bold?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div
      className={`flex justify-between ${bold ? "border-t border-border pt-1 font-semibold" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function DreCard({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: { categoryId: string | null; name: string; total: number }[];
  total: number;
  tone: "success" | "destructive";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 space-y-1 text-sm">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">Sem lançamentos.</p>
        ) : (
          rows.map((r) => (
            <Row
              key={r.categoryId ?? "none"}
              label={r.name}
              value={r.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            />
          ))
        )}
        <Row
          label="Total"
          value={total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          bold
          tone={tone}
        />
      </div>
    </div>
  );
}
