import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { prisma } from "@nohub/db";
import {
  ArrowRight,
  Bell,
  Boxes,
  CircleDollarSign,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Triangle,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Dashboard — NoHub Market" };

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Gerente",
  operator: "Operador",
  viewer: "Visualizador",
};

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const compact = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",")}k` : v.toString();

/* ── Tiny inline sparkline ─────────────────────────────────── */
function Sparkline({
  points,
  width = 120,
  height = 36,
  stroke = "var(--primary)",
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / Math.max(1, points.length - 1);

  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const session = await getSession();
  const member = await prisma.member.findFirst({
    where: { userId: session?.user.id },
    include: {
      organization: {
        include: {
          locations: { where: { deletedAt: null } },
          salesChannels: true,
          suppliers: { where: { deletedAt: null } },
          capabilities: { where: { enabled: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const org = member?.organization;
  const orgId = org?.id ?? "";
  const orgName = org?.tradeName ?? org?.legalName ?? "Dashboard";

  /* ── Scope: selected location (cookie) ─────────────────────── */
  const allLocs = org?.locations ?? [];
  const scopedIds =
    member && member.locationScopes.length > 0
      ? allLocs.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : allLocs.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const scopeLocationId = cookieSelected === ALL_LOCATIONS ? undefined : cookieSelected;
  const scopeWhere = scopeLocationId ? { locationId: scopeLocationId } : {};
  const scopeLocationName = scopeLocationId
    ? (allLocs.find((l) => l.id === scopeLocationId)?.name ?? null)
    : null;

  /* ── Period: today + last 7 days ──────────────────────────── */
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOf7d = new Date(startOfToday);
  startOf7d.setDate(startOf7d.getDate() - 6);

  const [todayAgg, yesterdayAgg, weekAgg, weekOrders, pendingOrders, lowStock, recentOrders] =
    await Promise.all([
      prisma.order.aggregate({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          createdAt: { gte: startOfToday },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          createdAt: { gte: startOfYesterday, lt: startOfToday },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          createdAt: { gte: startOf7d },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          createdAt: { gte: startOf7d },
          status: { notIn: ["DRAFT", "CANCELED"] },
        },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.count({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          status: { in: ["CONFIRMED", "PAID", "FULFILLED"] },
        },
      }),
      prisma.stockBalance.findMany({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          minQuantity: { not: null },
        },
        select: {
          productId: true,
          quantityOnHand: true,
          minQuantity: true,
          product: { select: { name: true, sku: true, unit: true } },
          location: { select: { name: true } },
        },
        take: 100,
      }),
      prisma.order.findMany({
        where: {
          organizationId: orgId,
          ...scopeWhere,
          status: { notIn: ["DRAFT"] },
        },
        select: {
          id: true,
          channel: true,
          status: true,
          total: true,
          createdAt: true,
          location: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  /* ── Derive KPIs ──────────────────────────────────────────── */
  const todayTotal = Number(todayAgg._sum.total ?? 0);
  const yesterdayTotal = Number(yesterdayAgg._sum.total ?? 0);
  const todayCount = todayAgg._count._all;
  const weekTotal = Number(weekAgg._sum.total ?? 0);
  const weekCount = weekAgg._count._all;
  const avgTicket = weekCount > 0 ? weekTotal / weekCount : 0;

  const trendPct =
    yesterdayTotal > 0
      ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100)
      : todayTotal > 0
        ? 100
        : 0;

  // Bucket weekly orders into 7 daily totals for sparkline
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOf7d);
    d.setDate(d.getDate() + i);
    return { key: d.toISOString().slice(0, 10), total: 0 };
  });
  for (const o of weekOrders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const idx = days.findIndex((d) => d.key === key);
    if (idx >= 0 && days[idx]) days[idx].total += Number(o.total);
  }
  const sparkPoints = days.map((d) => d.total);

  // Low stock — quantityOnHand <= minQuantity
  const criticalStock = lowStock.filter(
    (s) => Number(s.quantityOnHand) <= Number(s.minQuantity ?? 0),
  );

  const orderStatusColor: Record<
    string,
    "success" | "warning" | "info" | "secondary" | "destructive"
  > = {
    DRAFT: "secondary",
    CONFIRMED: "info",
    PAID: "info",
    FULFILLED: "warning",
    COMPLETED: "success",
    CANCELED: "destructive",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header band with aurora ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="aurora-orange absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="bg-dot-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Bem-vindo de volta</p>
            <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight tracking-tight text-foreground">
              {orgName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
              <Badge variant="soft" dotColor="primary">
                {ROLE_LABELS[member?.role ?? ""] ?? member?.role}
              </Badge>
              <span aria-hidden>·</span>
              {scopeLocationName ? (
                <Badge variant="soft" dotColor="primary">
                  Unidade: {scopeLocationName}
                </Badge>
              ) : (
                <span>{org?.locations.length ?? 0} unidade(s) · visão consolidada</span>
              )}
              <span aria-hidden>·</span>
              <span>
                {org?.salesChannels.filter((c) => c.enabled).length ?? 0} canal(is) ativo(s)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/products/new">
                <Plus className="h-3.5 w-3.5" />
                Produto
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/app/sales/pos">
                <ShoppingCart className="h-3.5 w-3.5" />
                Abrir PDV
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI grid ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Faturamento hoje"
          value={BRL(todayTotal)}
          icon={<CircleDollarSign className="h-4 w-4" />}
          iconTone="primary"
          trend={{ value: trendPct }}
          hint="vs ontem"
        />
        <Stat
          label="Vendas hoje"
          value={todayCount}
          icon={<Receipt className="h-4 w-4" />}
          iconTone="info"
          hint={
            <>
              <span className="tabular-nums">{compact(weekCount)}</span> nos últimos 7d
            </>
          }
        />
        <Stat
          label="Ticket médio (7d)"
          value={BRL(avgTicket)}
          icon={<TrendingUp className="h-4 w-4" />}
          iconTone="success"
          hint="por venda"
        />
        <Stat
          label="Estoque crítico"
          value={criticalStock.length}
          icon={<Triangle className="h-4 w-4" />}
          iconTone={criticalStock.length > 0 ? "destructive" : "neutral"}
          hint={criticalStock.length === 0 ? "nada urgente" : "produtos em ruptura"}
        />
      </div>

      {/* ── Main grid: chart + activity ──────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
            <div>
              <CardTitle>Faturamento — últimos 7 dias</CardTitle>
              <p className="mt-1 font-display text-[28px] font-semibold tracking-tight tabular-nums">
                {BRL(weekTotal)}
              </p>
            </div>
            <Badge variant="soft" dotColor="primary">
              <Sparkles className="h-3 w-3" />
              {weekCount} pedidos
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <Sparkline points={sparkPoints} height={88} />
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-subtle">
              {days.map((d) => {
                const date = new Date(d.key);
                return (
                  <span key={d.key}>
                    {date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Atalhos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 pt-1">
            <ShortcutLink
              href="/app/sales/pos"
              icon={ShoppingCart}
              label="Abrir PDV"
              tone="primary"
            />
            <ShortcutLink href="/app/products/new" icon={Plus} label="Novo produto" tone="info" />
            <ShortcutLink
              href="/app/inventory/inbound"
              icon={Boxes}
              label="Entrada de estoque"
              tone="success"
            />
            <ShortcutLink
              href="/app/sales/orders"
              icon={Receipt}
              label="Pedidos abertos"
              tone="warning"
              badge={pendingOrders}
            />
            <ShortcutLink href="/app/sales/cash" icon={Wallet} label="Caixa" tone="neutral" />
          </CardContent>
        </Card>
      </div>

      {/* ── Two-col: recent orders + alerts ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent orders */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Últimos pedidos</CardTitle>
            <Link
              href="/app/sales/orders"
              className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <div className="border-t border-border">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Receipt className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-[13px] text-muted-foreground">Nenhum pedido recente.</p>
                <Button size="sm" variant="outline" asChild className="mt-1">
                  <Link href="/app/sales/pos">Iniciar venda</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        #{o.id.slice(-6).toUpperCase()}
                        <span className="ml-2 text-muted-foreground">{o.location.name}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {o.channel} ·{" "}
                        {new Date(o.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant={orderStatusColor[o.status] ?? "secondary"}>
                      {o.status.toLowerCase()}
                    </Badge>
                    <span className="font-mono w-24 text-right text-[13px] font-semibold tabular-nums">
                      {BRL(Number(o.total))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              Alertas operacionais
            </CardTitle>
          </CardHeader>
          <div className="border-t border-border">
            {criticalStock.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success">
                  <Triangle className="h-4 w-4 rotate-180" />
                </span>
                <p className="text-[13px] font-medium">Sem ruptura no momento</p>
                <p className="text-[11px] text-muted-foreground">
                  Configure mínimo nos produtos para receber alertas.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {criticalStock.slice(0, 5).map((s, idx) => (
                  <li key={`${s.productId}-${idx}`} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive-soft text-destructive">
                      <Triangle className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{s.product?.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.location?.name} · mín {Number(s.minQuantity)}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {Number(s.quantityOnHand)} {s.product?.unit}
                    </Badge>
                  </li>
                ))}
                {criticalStock.length > 5 && (
                  <li className="px-5 py-3">
                    <Link
                      href="/app/inventory"
                      className="flex items-center justify-between text-[12px] font-medium text-primary hover:underline"
                    >
                      <span>+ {criticalStock.length - 5} produtos</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Subcomponents ─────────────────────────────────────────── */

const TONE_BG: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-1 text-foreground",
};

function ShortcutLink({
  href,
  icon: Icon,
  label,
  tone,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  tone: "primary" | "info" | "success" | "warning" | "neutral";
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-surface-1"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 font-medium text-foreground">{label}</span>
      {badge !== undefined && badge > 0 && <Badge variant="soft">{badge}</Badge>}
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}
