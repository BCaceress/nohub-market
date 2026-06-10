"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Boxes,
  DollarSign,
  GitBranch,
  Hash,
  ImageOff,
  Layers,
  Package,
  Pencil,
  Scissors,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Stat } from "@/components/ui/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMovementsAction } from "@/features/inventory/actions/stock-actions";
import { getProductSalesStatsAction } from "@/features/sales/actions/order-actions";

// ── Types ─────────────────────────────────────────────────────────

type Product = Awaited<
  ReturnType<typeof import("@/features/catalog/actions/product-actions").getProductAction>
>;

type StockEntry = {
  id: string;
  locationId: string;
  locationName: string;
  quantity: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  shelfLocation: string | null;
  expiryDate: string | null;
  batchCode: string | null;
};

type Movement = {
  id: string;
  type: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  locationName: string;
  notes: string | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  userName: string | null;
};

type SalesStats = {
  totalQty: number;
  totalRevenue: number;
  daily: { date: string; qty: number; revenue: number }[];
};

interface Props {
  organizationId: string;
  product: NonNullable<Product>;
  stockEntries: StockEntry[];
  movements: Movement[];
  totalMovements: number;
  salesStats: SalesStats;
  defaultFrom: string;
  defaultTo: string;
}

// ── Constants ─────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "1 ano", days: 365 },
] as const;

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "secondary" | "info" | "warning" | "success" }
> = {
  SIMPLE: { label: "Simples", icon: <Package className="h-3 w-3" />, variant: "secondary" },
  VARIANT_PARENT: { label: "Variantes", icon: <GitBranch className="h-3 w-3" />, variant: "info" },
  KIT: { label: "Kit/Combo", icon: <Layers className="h-3 w-3" />, variant: "warning" },
  FRACTIONED: { label: "Fracionado", icon: <Scissors className="h-3 w-3" />, variant: "success" },
  CUSTOM: {
    label: "Personalizado",
    icon: <SlidersHorizontal className="h-3 w-3" />,
    variant: "info",
  },
};

const MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  IN: { label: "Entrada", color: "text-emerald-600" },
  INBOUND: { label: "Entrada", color: "text-emerald-600" },
  OUT: { label: "Saída", color: "text-rose-500" },
  OUTBOUND: { label: "Saída venda", color: "text-rose-500" },
  LOSS: { label: "Perda", color: "text-amber-500" },
  ADJUSTMENT: { label: "Ajuste", color: "text-blue-500" },
  TRANSFER_IN: { label: "Transfer. entrada", color: "text-sky-500" },
  TRANSFER_OUT: { label: "Transfer. saída", color: "text-sky-500" },
  RESERVATION: { label: "Reserva", color: "text-purple-500" },
  RESERVATION_RELEASE: { label: "Lib. reserva", color: "text-purple-400" },
};

const chartConfig: ChartConfig = {
  qty: { label: "Qtd vendida", color: "hsl(var(--primary))" },
  revenue: { label: "Receita (R$)", color: "hsl(var(--success))" },
};

// ── Helpers ───────────────────────────────────────────────────────

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Component ─────────────────────────────────────────────────────

export function ProductOverviewClient({
  organizationId,
  product,
  stockEntries,
  movements: initialMovements,
  totalMovements: initialTotal,
  salesStats: initialStats,
}: Props) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365>(30);
  const [salesStats, setSalesStats] = useState<SalesStats>(initialStats);
  const [movements, setMovements] = useState<Movement[]>(initialMovements);
  const [totalMovements, setTotalMovements] = useState(initialTotal);
  const [movPage, setMovPage] = useState(1);
  const MOV_PAGE_SIZE = 20;

  const [isPending, startTransition] = useTransition();

  const typeCfg = (TYPE_CONFIG[product.productType] ?? TYPE_CONFIG.SIMPLE)!;
  const totalStock = stockEntries.reduce((s, e) => s + e.quantity, 0);
  const belowMin = stockEntries.some((e) => e.minQuantity !== null && e.quantity < e.minQuantity);

  function changeRange(days: 7 | 30 | 90 | 365) {
    setRangeDays(days);
    setMovPage(1);
    const from = daysAgo(days);
    const to = new Date();

    startTransition(async () => {
      const [newStats, { total, movements: newMov }] = await Promise.all([
        getProductSalesStatsAction(organizationId, product.id, { from, to }),
        getMovementsAction(organizationId, {
          productId: product.id,
          from,
          to,
          take: MOV_PAGE_SIZE,
          skip: 0,
        }),
      ]);
      setSalesStats(newStats);
      setMovements(
        newMov.map((m) => ({
          id: m.id,
          type: m.type,
          quantity: Number(m.quantity),
          previousQty: Number(m.previousQty),
          newQty: Number(m.newQty),
          locationName: m.location?.name ?? "—",
          notes: m.notes ?? (m as { note?: string | null }).note ?? null,
          reason: m.reason ?? null,
          referenceType: m.referenceType ?? null,
          referenceId: m.referenceId ?? null,
          createdAt: m.createdAt.toISOString(),
          userName: m.userName ?? null,
        })),
      );
      setTotalMovements(total);
    });
  }

  function loadMovPage(page: number) {
    setMovPage(page);
    const from = daysAgo(rangeDays);
    const to = new Date();
    startTransition(async () => {
      const { total, movements: newMov } = await getMovementsAction(organizationId, {
        productId: product.id,
        from,
        to,
        take: MOV_PAGE_SIZE,
        skip: (page - 1) * MOV_PAGE_SIZE,
      });
      setMovements(
        newMov.map((m) => ({
          id: m.id,
          type: m.type,
          quantity: Number(m.quantity),
          previousQty: Number(m.previousQty),
          newQty: Number(m.newQty),
          locationName: m.location?.name ?? "—",
          notes: m.notes ?? (m as { note?: string | null }).note ?? null,
          reason: m.reason ?? null,
          referenceType: m.referenceType ?? null,
          referenceId: m.referenceId ?? null,
          createdAt: m.createdAt.toISOString(),
          userName: m.userName ?? null,
        })),
      );
      setTotalMovements(total);
    });
  }

  const movTotalPages = Math.ceil(totalMovements / MOV_PAGE_SIZE);

  const basePrice = Number(product.price);
  const costPrice = product.costPrice ? Number(product.costPrice) : null;
  const margin =
    costPrice && basePrice > 0 && costPrice > 0
      ? ((basePrice - costPrice) / basePrice) * 100
      : null;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/app/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {product.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: external user-provided URL
          <img
            src={product.imageUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-md object-contain border border-border"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
            <ImageOff className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold leading-snug">{product.name}</h1>
            <Badge variant={typeCfg.variant} className="gap-1 shrink-0">
              {typeCfg.icon}
              {typeCfg.label}
            </Badge>
            {!product.isActive && (
              <Badge variant="secondary" className="shrink-0 text-muted-foreground">
                Inativo
              </Badge>
            )}
          </div>
          {product.sku && (
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <Hash className="h-2.5 w-2.5" />
              {product.sku}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/products/${product.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 p-6 overflow-y-auto">
        {/* Date range selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Período:</span>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => changeRange(opt.days as 7 | 30 | 90 | 365)}
              disabled={isPending}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                rangeDays === opt.days
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
          {isPending && (
            <span className="text-xs text-muted-foreground ml-2 animate-pulse">Carregando…</span>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Vendas (qtd)"
            value={salesStats.totalQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
            icon={<ShoppingCart className="h-4 w-4" />}
            iconTone="primary"
            hint={`últimos ${rangeDays} dias`}
          />
          <Stat
            label="Receita"
            value={brl(salesStats.totalRevenue)}
            icon={<DollarSign className="h-4 w-4" />}
            iconTone="success"
            hint={`últimos ${rangeDays} dias`}
          />
          <Stat
            label="Estoque total"
            value={totalStock.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
            icon={<Boxes className={`h-4 w-4 ${belowMin ? "text-amber-500" : ""}`} />}
            iconTone={belowMin ? "warning" : "neutral"}
            hint={
              belowMin ? (
                <span className="text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Abaixo do mínimo
                </span>
              ) : (
                `${stockEntries.length} local${stockEntries.length !== 1 ? "is" : ""}`
              )
            }
          />
          <Stat
            label="Margem bruta"
            value={margin !== null ? `${margin.toFixed(1)}%` : "—"}
            icon={<TrendingUp className="h-4 w-4" />}
            iconTone={
              margin === null
                ? "neutral"
                : margin >= 30
                  ? "success"
                  : margin >= 10
                    ? "warning"
                    : "destructive"
            }
            hint={costPrice !== null ? `Custo ${brl(costPrice)}` : "Custo não informado"}
          />
        </div>

        {/* Chart + Info side by side */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Sales chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Vendas por dia</h2>
            </div>
            {salesStats.daily.every((d) => d.qty === 0) ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Sem vendas no período
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <AreaChart
                  data={salesStats.daily}
                  margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradQty" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-qty)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-qty)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={fmtDate}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    width={30}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => fmtDate(String(v))}
                        formatter={(value, name) => (
                          <span className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">
                              {name === "qty" ? "Qtd" : "Receita"}:
                            </span>
                            <span className="font-medium tabular-nums">
                              {name === "revenue"
                                ? brl(Number(value))
                                : Number(value).toLocaleString("pt-BR", {
                                    maximumFractionDigits: 3,
                                  })}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="qty"
                    stroke="var(--color-qty)"
                    strokeWidth={2}
                    fill="url(#gradQty)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>

          {/* Product info */}
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Informações</h2>

            {product.imageUrl && (
              // biome-ignore lint/performance/noImgElement: external user-provided URL
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-28 w-full rounded-lg object-contain border border-border bg-muted/20"
              />
            )}

            <InfoRow label="Preço de venda" value={brl(basePrice)} mono />
            {costPrice !== null && <InfoRow label="Custo" value={brl(costPrice)} mono />}
            {product.category && <InfoRow label="Categoria" value={product.category.name} />}
            {product.supplier && <InfoRow label="Fornecedor" value={product.supplier.name} />}
            {product.brand && <InfoRow label="Marca" value={product.brand} />}
            {product.barcode && <InfoRow label="Código de barras" value={product.barcode} mono />}
            {product.unit && <InfoRow label="Unidade" value={product.unit} />}
            {product.description && (
              <div className="text-xs text-muted-foreground border-t border-border pt-3 mt-1">
                {product.description}
              </div>
            )}
          </div>
        </div>

        {/* Stock table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Estoque atual</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Total:{" "}
              <span className="font-mono font-medium text-foreground">
                {totalStock.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
              </span>
            </span>
          </div>
          {stockEntries.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Sem registros de estoque
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Máximo</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Posição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockEntries.map((e) => {
                  const zero = e.quantity <= 0;
                  const low = e.minQuantity !== null && e.quantity < e.minQuantity;
                  const tone = zero ? "text-rose-500" : low ? "text-amber-500" : "text-foreground";
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.locationName}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono tabular-nums font-semibold ${tone}`}>
                          {e.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                        </span>
                        {(zero || low) && (
                          <AlertTriangle
                            className={`inline ml-1 h-3 w-3 ${zero ? "text-rose-500" : "text-amber-500"}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {e.minQuantity !== null
                          ? e.minQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {e.maxQuantity !== null
                          ? e.maxQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.batchCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.expiryDate ? new Date(e.expiryDate).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.shelfLocation ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Movements table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Histórico de movimentos</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {totalMovements} movimento{totalMovements !== 1 ? "s" : ""} no período
            </span>
          </div>
          {movements.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Sem movimentos no período
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Novo saldo</TableHead>
                    <TableHead>Motivo / Ref.</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => {
                    const movCfg = MOVEMENT_LABELS[m.type] ?? {
                      label: m.type,
                      color: "text-foreground",
                    };
                    const isIn = ["IN", "INBOUND", "TRANSFER_IN", "RESERVATION_RELEASE"].includes(
                      m.type,
                    );
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDateTime(m.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${movCfg.color}`}>
                            {movCfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{m.locationName}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-mono text-xs font-medium tabular-nums ${isIn ? "text-emerald-600" : "text-rose-500"}`}
                          >
                            {isIn ? "+" : "-"}
                            {m.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {m.newQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                          {m.reason ?? m.referenceType ?? m.notes ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.userName ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {movTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Página {movPage} de {movTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movPage <= 1 || isPending}
                      onClick={() => loadMovPage(movPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={movPage >= movTotalPages || isPending}
                      onClick={() => loadMovPage(movPage + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
