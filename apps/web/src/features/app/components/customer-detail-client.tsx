"use client";

import { formatCNPJ, formatCPF } from "@nohub/shared/brazilian";
import {
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Customer = {
  id: string;
  personType: string;
  name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contactName: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  notes: string | null;
};

type Stats = {
  totalSpent: number;
  orderCount: number;
  avgTicket: number;
  invoiceCount: number;
  lastOrder: { createdAt: string | Date; total: number } | null;
};

type OrderRow = {
  id: string;
  channel: string;
  status: string;
  total: number;
  createdAt: string | Date;
  itemCount: number;
  invoice: { id: string; status: string; number: number | null } | null;
};

type AuditLog = {
  id: string;
  action: string;
  userName: string | null;
  createdAt: string | Date;
};

interface Props {
  customer: Customer;
  stats: Stats;
  orderHistory: { orders: OrderRow[]; total: number };
  auditLogs: AuditLog[];
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Rascunho", tone: "bg-muted text-muted-foreground" },
  CONFIRMED: { label: "Confirmado", tone: "bg-info-soft text-info" },
  FULFILLED: { label: "Concluído", tone: "bg-success-soft text-success" },
  CANCELED: { label: "Cancelado", tone: "bg-destructive-soft text-destructive" },
};

const CHANNEL_LABEL: Record<string, string> = {
  POS: "PDV",
  SELF_SERVICE: "Autoatendimento",
  IFOOD: "iFood",
  WHATSAPP: "WhatsApp",
  ONLINE: "Online",
};

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Cadastrado",
  UPDATED: "Atualizado",
  DELETED: "Removido",
  REACTIVATED: "Reativado",
  DEACTIVATED: "Inativado",
};

export function CustomerDetailClient({ customer, stats, orderHistory, auditLogs }: Props) {
  const doc = customer.document
    ? customer.personType === "PJ"
      ? formatCNPJ(customer.document)
      : formatCPF(customer.document)
    : null;

  const addressLine = [customer.addressStreet, customer.addressNumber, customer.addressComplement]
    .filter(Boolean)
    .join(", ");
  const cityLine = [customer.addressDistrict, customer.addressCity, customer.addressState]
    .filter(Boolean)
    .join(" — ");
  const hasAddress = addressLine || cityLine || customer.addressZip;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5 items-start">
      {/* ── Coluna esquerda: dados do cliente ─────────────────── */}
      <div className="flex flex-col gap-5 xl:sticky xl:top-6">
        {/* Contato */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Contato</h2>
          {doc && (
            <InfoRow
              icon={<Receipt className="h-3.5 w-3.5" />}
              label={customer.personType === "PJ" ? "CNPJ" : "CPF"}
            >
              {doc}
            </InfoRow>
          )}
          {customer.contactName && <InfoRow label="Responsável">{customer.contactName}</InfoRow>}
          {customer.phone && (
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telefone">
              {customer.phone}
            </InfoRow>
          )}
          {customer.whatsapp && (
            <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp">
              {customer.whatsapp}
            </InfoRow>
          )}
          {customer.email && (
            <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail">
              <a href={`mailto:${customer.email}`} className="hover:underline">
                {customer.email}
              </a>
            </InfoRow>
          )}
          {!doc && !customer.phone && !customer.whatsapp && !customer.email && (
            <p className="text-sm text-muted-foreground">Sem dados de contato.</p>
          )}
        </div>

        {/* Endereço */}
        {hasAddress && (
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Endereço
            </h2>
            {addressLine && <p className="text-sm text-foreground">{addressLine}</p>}
            {cityLine && <p className="text-sm text-muted-foreground">{cityLine}</p>}
            {customer.addressZip && (
              <p className="text-xs text-muted-foreground">CEP {customer.addressZip}</p>
            )}
          </div>
        )}

        {/* Observações */}
        {customer.notes && (
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Observações</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}

        {/* Histórico de alterações */}
        {auditLogs.length > 0 && (
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Histórico de alterações</h2>
            <ul className="flex flex-col gap-2">
              {auditLogs.slice(0, 8).map((log) => (
                <li key={log.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">
                    {ACTION_LABEL[log.action] ?? log.action}
                    {log.userName && (
                      <span className="text-muted-foreground"> · {log.userName}</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">{fmtDate(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Coluna direita: stats + histórico de pedidos ──────── */}
      <div className="flex flex-col gap-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total gasto"
            value={BRL(stats.totalSpent)}
          />
          <StatCard
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Pedidos"
            value={String(stats.orderCount)}
          />
          <StatCard
            icon={<Receipt className="h-4 w-4" />}
            label="Ticket médio"
            value={BRL(stats.avgTicket)}
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Notas fiscais"
            value={String(stats.invoiceCount)}
          />
        </div>

        {/* Histórico de pedidos */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">Histórico de pedidos</h2>
            <span className="text-xs text-muted-foreground">{orderHistory.total} no total</span>
          </div>
          {orderHistory.orders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              Este cliente ainda não tem pedidos.
            </div>
          ) : (
            <div className="divide-y">
              {orderHistory.orders.map((o) => {
                const st = STATUS_LABEL[o.status] ?? {
                  label: o.status,
                  tone: "bg-muted text-muted-foreground",
                };
                return (
                  <div key={o.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {fmtDate(o.createdAt)}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {CHANNEL_LABEL[o.channel] ?? o.channel}
                        </Badge>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.tone}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {o.itemCount} {o.itemCount === 1 ? "item" : "itens"}
                        {o.invoice && <span> · NF {o.invoice.number ?? "emitida"}</span>}
                      </p>
                    </div>
                    <span className="font-display text-sm font-semibold tabular-nums">
                      {BRL(o.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {stats.lastOrder && (
          <p className="text-xs text-muted-foreground">
            Último pedido em {fmtDate(stats.lastOrder.createdAt)} · {BRL(stats.lastOrder.total)}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-foreground text-right truncate">{children}</span>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-display text-lg font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
