"use client";

import { formatCNPJ } from "@nohub/shared/brazilian";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingCart,
  Tag,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupplierProductsManager } from "./supplier-products-manager";

/* ── Types ───────────────────────────────────────────────────────── */

type PaymentTerms = { termsDays: number; type: string } | null;

type Supplier = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  contactName: string | null;
  segment: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  defaultPaymentTerms: PaymentTerms;
  defaultLeadTimeDays: number | null;
  minOrderAmount: unknown;
  deliveryDays: string[] | null;
  defaultDiscountPercent: unknown;
  freightFixedAmount: unknown;
  freightFreeAbove: unknown;
  freightNotes: string | null;
  notes: string | null;
  supplierProductMappings: ProductMapping[];
};

type ProductMapping = {
  id: string;
  supplierId: string;
  productId: string;
  variantId: string | null;
  supplierProductCode: string;
  supplierProductName: string;
  purchaseUnit: string | null;
  defaultPackQuantity: unknown;
  minOrderQuantity: unknown;
  barcode: string | null;
  leadTimeDays: number | null;
  lastCost: unknown;
  previousCost: unknown;
  lastPurchaseAt: Date | string | null;
  isPreferred: boolean;
  active: boolean;
  discountPercent: unknown;
  product: { id: string; name: string; sku: string; imageUrl: string | null };
  variant: { id: string; name: string } | null;
};

type Stats = {
  totalPurchased: unknown;
  orderCount: number;
  avgTicket: unknown;
  lastOrder: { createdAt: Date | string; total: unknown } | null;
  topProducts: {
    productId: string;
    productName: string;
    totalValue: unknown;
    orderCount: number;
  }[];
};

type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  total: unknown;
  createdAt: Date | string;
  items: { id: string }[];
  receipts: { id: string; status: string }[];
};

type PriceMapping = {
  id: string;
  product: { id: string; name: string };
  variant: { id: string; name: string } | null;
  lastCost: unknown;
  previousCost: unknown;
  lastPurchaseAt: Date | string | null;
  priceHistory: {
    id: string;
    unitCost: unknown;
    recordedAt: Date | string;
    source: string;
  }[];
};

type Payable = {
  id: string;
  amount: unknown;
  dueDate: Date | string;
  paidAt: Date | string | null;
  status: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  purchaseOrder: { id: string; number: string } | null;
  goodsReceipt: { id: string; supplierInvoiceNumber: string | null } | null;
};

type AuditLog = {
  id: string;
  action: string;
  userName: string | null;
  userId: string | null;
  changedFields: unknown;
  createdAt: Date | string;
};

type AuditData = {
  auditLogs: AuditLog[];
  purchaseOrders: {
    id: string;
    number: string;
    status: string;
    total: unknown;
    createdAt: Date | string;
  }[];
  goodsReceipts: {
    id: string;
    status: string;
    receivedAt: Date | string | null;
    supplierInvoiceNumber: string | null;
    purchaseOrder: { number: string };
  }[];
  accountPayables: {
    id: string;
    amount: unknown;
    paidAt: Date | string | null;
    dueDate: Date | string;
  }[];
};

interface Props {
  supplier: Supplier;
  stats: Stats;
  purchaseHistory: { orders: PurchaseOrder[]; total: number };
  priceEvolution: PriceMapping[];
  accountsPayable: { payables: Payable[]; total: number };
  auditData: AuditData;
  organizationId: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function fmt(value: unknown): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtNum(value: unknown, decimals = 4): string {
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const WEEKDAY_LABEL: Record<string, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

const PO_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "info" | "outline" | "destructive" }
> = {
  DRAFT: { label: "Rascunho", variant: "outline" },
  SENT: { label: "Enviado", variant: "info" },
  CONFIRMED: { label: "Confirmado", variant: "info" },
  RECEIVING: { label: "Recebendo", variant: "warning" },
  RECEIVED: { label: "Recebido", variant: "success" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
};

const AP_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendente", variant: "warning" },
  PAID: { label: "Pago", variant: "success" },
  PARTIALLY_PAID: { label: "Parcial", variant: "info" as never },
  CANCELED: { label: "Cancelado", variant: "destructive" },
};

/* ── Main component ──────────────────────────────────────────────── */

export function SupplierDetailClient({
  supplier,
  stats,
  purchaseHistory,
  priceEvolution,
  accountsPayable,
  auditData,
  organizationId: _organizationId,
}: Props) {
  const [tab, setTab] = useState("info");

  return (
    <div className="flex flex-col gap-0">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total comprado"
          value={fmt(stats.totalPurchased)}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label="Pedidos"
          value={String(stats.orderCount)}
          icon={<Package className="h-4 w-4" />}
        />
        <StatCard
          label="Ticket médio"
          value={fmt(stats.avgTicket)}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="Última compra"
          value={stats.lastOrder ? fmtDate(stats.lastOrder.createdAt) : "—"}
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="info">Informações Gerais</TabsTrigger>
          <TabsTrigger
            value="products"
            badge={supplier.supplierProductMappings.length || undefined}
          >
            Produtos
          </TabsTrigger>
          <TabsTrigger value="purchases" badge={purchaseHistory.total || undefined}>
            Histórico de Compras
          </TabsTrigger>
          <TabsTrigger value="prices">Evolução de Preços</TabsTrigger>
          <TabsTrigger value="payables" badge={accountsPayable.total || undefined}>
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        {/* ── Informações Gerais ──────────────────────────────── */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dados */}
            <InfoCard title="Dados Cadastrais">
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label="Razão Social"
                value={supplier.name}
              />
              {supplier.tradeName && (
                <InfoRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Nome Fantasia"
                  value={supplier.tradeName}
                />
              )}
              {supplier.document && (
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="CNPJ"
                  value={formatCNPJ(supplier.document)}
                />
              )}
              {supplier.email && (
                <InfoRow
                  icon={<Mail className="h-4 w-4" />}
                  label="E-mail"
                  value={supplier.email}
                />
              )}
              {supplier.phone && (
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefone"
                  value={supplier.phone}
                />
              )}
              {supplier.contactName && (
                <InfoRow
                  icon={<User className="h-4 w-4" />}
                  label="Contato"
                  value={supplier.contactName}
                />
              )}
              {supplier.segment && (
                <InfoRow
                  icon={<Tag className="h-4 w-4" />}
                  label="Segmento"
                  value={supplier.segment}
                />
              )}
              {supplier.website && (
                <InfoRow
                  icon={<Globe className="h-4 w-4" />}
                  label="Website"
                  value={
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {supplier.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  }
                />
              )}
              {(supplier.addressCity || supplier.addressStreet) && (
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Endereço"
                  value={[
                    supplier.addressStreet &&
                      `${supplier.addressStreet}${supplier.addressNumber ? `, ${supplier.addressNumber}` : ""}`,
                    supplier.addressComplement,
                    supplier.addressDistrict,
                    supplier.addressCity &&
                      `${supplier.addressCity}${supplier.addressState ? ` — ${supplier.addressState}` : ""}`,
                    supplier.addressZip,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
            </InfoCard>

            {/* Condições */}
            <div className="flex flex-col gap-6">
              <InfoCard title="Condições Comerciais">
                {supplier.defaultPaymentTerms && (
                  <InfoRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Prazo de pagamento"
                    value={`${(supplier.defaultPaymentTerms as { termsDays: number }).termsDays} dias`}
                  />
                )}
                {supplier.defaultLeadTimeDays != null && (
                  <InfoRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Prazo de entrega"
                    value={`${supplier.defaultLeadTimeDays} dias`}
                  />
                )}
                {supplier.minOrderAmount != null && Number(supplier.minOrderAmount) > 0 && (
                  <InfoRow
                    icon={<ShoppingCart className="h-4 w-4" />}
                    label="Pedido mínimo"
                    value={fmt(supplier.minOrderAmount)}
                  />
                )}
                {supplier.defaultDiscountPercent != null &&
                  Number(supplier.defaultDiscountPercent) > 0 && (
                    <InfoRow
                      icon={<Tag className="h-4 w-4" />}
                      label="Desconto padrão"
                      value={`${Number(supplier.defaultDiscountPercent).toFixed(1)}%`}
                    />
                  )}
                {supplier.deliveryDays && (supplier.deliveryDays as string[]).length > 0 && (
                  <InfoRow
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Dias de entrega"
                    value={(supplier.deliveryDays as string[])
                      .map((d) => WEEKDAY_LABEL[d] ?? d)
                      .join(", ")}
                  />
                )}
                {(Number(supplier.freightFixedAmount) > 0 ||
                  Number(supplier.freightFreeAbove) > 0 ||
                  supplier.freightNotes) && (
                  <InfoRow
                    icon={<Truck className="h-4 w-4" />}
                    label="Frete"
                    value={[
                      Number(supplier.freightFixedAmount) > 0
                        ? `Fixo ${fmt(supplier.freightFixedAmount)}`
                        : null,
                      Number(supplier.freightFreeAbove) > 0
                        ? `Grátis acima de ${fmt(supplier.freightFreeAbove)}`
                        : null,
                      supplier.freightNotes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                )}
              </InfoCard>

              {supplier.notes && (
                <InfoCard title="Observações">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {supplier.notes}
                  </p>
                </InfoCard>
              )}

              {/* Top produtos */}
              {stats.topProducts.length > 0 && (
                <InfoCard title="Produtos Mais Comprados">
                  <ol className="flex flex-col gap-2">
                    {stats.topProducts.map((p, i) => (
                      <li key={p.productId} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-bold text-muted-foreground w-4">
                          {i + 1}.
                        </span>
                        <Link
                          href={`/app/products/${p.productId}`}
                          className="flex-1 text-foreground hover:text-primary transition-colors"
                        >
                          {p.productName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{fmt(p.totalValue)}</span>
                      </li>
                    ))}
                  </ol>
                </InfoCard>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Produtos Fornecidos ─────────────────────────────── */}
        <TabsContent value="products">
          <SupplierProductsManager
            supplierId={supplier.id}
            initialMappings={supplier.supplierProductMappings.map((m) => ({
              id: m.id,
              supplierId: m.supplierId,
              productId: m.productId,
              variantId: m.variantId,
              supplierProductCode: m.supplierProductCode,
              supplierProductName: m.supplierProductName,
              purchaseUnit: m.purchaseUnit ?? null,
              defaultPackQuantity:
                m.defaultPackQuantity != null ? Number(m.defaultPackQuantity) : null,
              minOrderQuantity: m.minOrderQuantity != null ? Number(m.minOrderQuantity) : null,
              barcode: m.barcode ?? null,
              leadTimeDays: m.leadTimeDays ?? null,
              discountPercent: m.discountPercent != null ? Number(m.discountPercent) : null,
              lastCost: m.lastCost != null ? Number(m.lastCost) : null,
              previousCost: m.previousCost != null ? Number(m.previousCost) : null,
              lastPurchaseAt: m.lastPurchaseAt ? new Date(m.lastPurchaseAt).toISOString() : null,
              isPreferred: m.isPreferred,
              active: m.active,
              product: m.product,
              variant: m.variant,
            }))}
          />
        </TabsContent>

        {/* ── Histórico de Compras ────────────────────────────── */}
        <TabsContent value="purchases">
          {purchaseHistory.orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-8 w-8" />}
              message="Nenhum pedido encontrado."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseHistory.orders.map((o) => {
                  const status = PO_STATUS[o.status] ?? {
                    label: o.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">#{o.number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {o.items.length}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {fmt(o.total)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/app/purchasing/orders/${o.id}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ── Evolução de Preços ──────────────────────────────── */}
        <TabsContent value="prices">
          {priceEvolution.length === 0 ? (
            <EmptyState
              icon={<Tag className="h-8 w-8" />}
              message="Nenhum histórico de preço encontrado."
            />
          ) : (
            <div className="flex flex-col gap-6">
              {priceEvolution.map((m) => (
                <div key={m.id} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.product.name}</span>
                    {m.variant && <Badge variant="outline">{m.variant.name}</Badge>}
                    <div className="h-px flex-1 bg-border" />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Atual:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {fmt(m.lastCost)}
                        </span>
                      </span>
                      {Number(m.previousCost) > 0 && (
                        <span>
                          Anterior: <span className="font-mono">{fmt(m.previousCost)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {m.priceHistory.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Custo Unitário</TableHead>
                          <TableHead className="text-right">Variação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.priceHistory.map((h, i) => {
                          const prev = m.priceHistory[i + 1];
                          const delta = prev ? Number(h.unitCost) - Number(prev.unitCost) : null;
                          const pct =
                            delta !== null && Number(prev?.unitCost) > 0
                              ? (delta / Number(prev?.unitCost)) * 100
                              : null;
                          return (
                            <TableRow key={h.id}>
                              <TableCell className="text-muted-foreground">
                                {fmtDate(h.recordedAt)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {h.source}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {fmtNum(h.unitCost, 2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {pct !== null ? (
                                  <span
                                    className={`text-xs font-semibold ${pct > 0 ? "text-destructive" : pct < 0 ? "text-success" : "text-muted-foreground"}`}
                                  >
                                    {pct > 0 ? "+" : ""}
                                    {pct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Contas a Pagar ──────────────────────────────────── */}
        <TabsContent value="payables">
          {accountsPayable.payables.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-8 w-8" />}
              message="Nenhuma conta a pagar encontrada."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Nota Fiscal</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountsPayable.payables.map((p) => {
                  const status = AP_STATUS[p.status] ?? {
                    label: p.status,
                    variant: "outline" as const,
                  };
                  const isOverdue = p.status === "PENDING" && new Date(p.dueDate) < new Date();
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.purchaseOrder ? `#${p.purchaseOrder.number}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.goodsReceipt?.supplierInvoiceNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                          }
                        >
                          {fmtDate(p.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(p.paidAt)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.installmentNumber != null && p.totalInstallments != null
                          ? `${p.installmentNumber}/${p.totalInstallments}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmt(p.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ── Auditoria ───────────────────────────────────────── */}
        <TabsContent value="audit">
          <div className="flex flex-col gap-6">
            {/* Log de alterações */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Log de Alterações</h3>
              {auditData.auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
              ) : (
                <div className="flex flex-col gap-0 rounded-xl border divide-y">
                  {auditData.auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                      <div
                        className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                          log.action === "CREATED"
                            ? "bg-success"
                            : log.action === "DELETED"
                              ? "bg-destructive"
                              : "bg-primary"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {log.action === "CREATED"
                              ? "Fornecedor criado"
                              : log.action === "DELETED"
                                ? "Fornecedor removido"
                                : "Dados atualizados"}
                          </span>
                          {log.userName && (
                            <span className="text-xs text-muted-foreground">
                              por {log.userName}
                            </span>
                          )}
                        </div>
                        {log.changedFields != null &&
                          typeof log.changedFields === "object" &&
                          Object.keys(log.changedFields as object).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(
                                log.changedFields as Record<string, { from: unknown; to: unknown }>,
                              ).map(([field, change]) => (
                                <span
                                  key={field}
                                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px]"
                                >
                                  <span className="font-medium">{field}:</span>
                                  <span className="line-through text-muted-foreground">
                                    {String(change.from ?? "—")}
                                  </span>
                                  <span>→</span>
                                  <span>{String(change.to ?? "—")}</span>
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {fmtDate(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Timeline de eventos */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Timeline Comercial</h3>
              <div className="flex flex-col gap-0 rounded-xl border divide-y">
                {/* Pedidos */}
                {auditData.purchaseOrders.map((po) => (
                  <TimelineEvent
                    key={`po-${po.id}`}
                    color="info"
                    date={fmtDate(po.createdAt)}
                    label={`Pedido #${po.number} criado`}
                    value={fmt(po.total)}
                    href={`/app/purchasing/orders/${po.id}`}
                  />
                ))}
                {/* Recebimentos */}
                {auditData.goodsReceipts.map((gr) => (
                  <TimelineEvent
                    key={`gr-${gr.id}`}
                    color="success"
                    date={fmtDate(gr.receivedAt)}
                    label={`Recebimento PO #${gr.purchaseOrder.number}${gr.supplierInvoiceNumber ? ` · NF ${gr.supplierInvoiceNumber}` : ""}`}
                  />
                ))}
                {/* Pagamentos */}
                {auditData.accountPayables.map((ap) => (
                  <TimelineEvent
                    key={`ap-${ap.id}`}
                    color="warning"
                    date={fmtDate(ap.paidAt)}
                    label="Pagamento registrado"
                    value={fmt(ap.amount)}
                  />
                ))}
                {auditData.purchaseOrders.length === 0 &&
                  auditData.goodsReceipts.length === 0 &&
                  auditData.accountPayables.length === 0 && (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      Nenhum evento comercial.
                    </p>
                  )}
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xl font-semibold font-mono tabular-nums">{value}</span>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-sm text-foreground break-words">{value}</span>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  message,
  hint,
}: {
  icon: React.ReactNode;
  message: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
      <span className="text-muted-foreground mb-3">{icon}</span>
      <p className="text-sm font-medium">{message}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground max-w-xs">{hint}</p>}
    </div>
  );
}

function TimelineEvent({
  color,
  date,
  label,
  value,
  href,
}: {
  color: "info" | "success" | "warning";
  date: string;
  label: string;
  value?: string;
  href?: string;
}) {
  const dot = {
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
  }[color];

  const content = (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
      <span className="flex-1 text-sm text-foreground">{label}</span>
      {value && <span className="text-sm font-mono text-muted-foreground">{value}</span>}
      <span className="text-xs text-muted-foreground shrink-0">{date}</span>
      {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:bg-muted/40 transition-colors">
        {content}
      </Link>
    );
  }
  return <div>{content}</div>;
}
