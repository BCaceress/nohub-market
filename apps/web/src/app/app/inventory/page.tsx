import Link from "next/link";
import {
  Package,
  AlertTriangle,
  CalendarClock,
  ArrowLeftRight,
  TrendingUp,
  ChevronRight,
  Boxes,
  Plus,
  PackagePlus,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBalanceSummaryAction, getAlertsAction } from "@/features/inventory/actions/inventory-actions";
import { getLocationsAction } from "@/features/inventory/actions/transfer-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { BalanceTable } from "@/features/inventory/components/balance-table";

export const metadata = { title: "Estoque — NoHub Market" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [balances, alerts, locations] = await Promise.all([
    getBalanceSummaryAction(member.organizationId, sp.locationId),
    getAlertsAction(member.organizationId),
    getLocationsAction(member.organizationId),
  ]);

  const totalOnHand  = balances.reduce((s, r) => s + r.quantityOnHand, 0);
  const totalProducts = new Set(balances.map((r) => r.productId)).size;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saldos físicos, reservas e disponibilidade em tempo real.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild size="sm" variant="outline">
            <Link href="/app/inventory/inbound">
              <PackagePlus className="h-3.5 w-3.5" />
              Entrada
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/inventory/loss">
              <Trash2 className="h-3.5 w-3.5" />
              Perda
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/app/inventory/transfer">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transferir
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app/inventory/count">
              <ClipboardList className="h-3.5 w-3.5" />
              Contagem
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-5 pb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">Produtos com saldo</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-5 pb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40">
              <Boxes className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {totalOnHand.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground">Unidades físicas</p>
            </div>
          </CardContent>
        </Card>

        <Card className={alerts.lowStockCount > 0 ? "border-amber-200 dark:border-amber-900/60" : ""}>
          <CardContent className="flex items-center gap-4 pt-5 pb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{alerts.lowStockCount}</p>
                {alerts.lowStockCount > 0 && (
                  <Badge variant="warning" className="text-[10px]">Atenção</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Estoque baixo</p>
            </div>
          </CardContent>
        </Card>

        <Card className={alerts.expiringCount > 0 ? "border-red-200 dark:border-red-900/60" : ""}>
          <CardContent className="flex items-center gap-4 pt-5 pb-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40">
              <CalendarClock className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{alerts.expiringCount}</p>
                {alerts.expiringCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">30 dias</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Lotes vencendo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────── */}
      {(alerts.lowStockCount > 0 || alerts.expiringCount > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {alerts.lowStockCount > 0 && (
            <Card className="border-amber-200 dark:border-amber-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Estoque abaixo do mínimo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {alerts.lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.product.name}</p>
                      <p className="text-muted-foreground">{item.location.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-amber-600">{item.quantityOnHand.toFixed(1)}</span>
                      <span className="text-muted-foreground">/ {item.minQuantity.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
                {alerts.lowStockCount > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{alerts.lowStockCount - 10} itens
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {alerts.expiringCount > 0 && (
            <Card className="border-red-200 dark:border-red-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                  <CalendarClock className="h-4 w-4" />
                  Lotes vencendo em 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {alerts.expiringItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.product.name}</p>
                      <p className="font-mono text-muted-foreground">{item.code}</p>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      {item.expiryDate
                        ? new Date(item.expiryDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                        : "—"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Balance table ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Saldo por produto</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/inventory/movements" className="gap-1">
              Ver movimentações <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {balances.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Boxes className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhum saldo registrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Registre uma entrada de estoque para começar.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/app/inventory/inbound">
                  <Plus className="h-3.5 w-3.5" />
                  Registrar entrada
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <BalanceTable
            rows={balances as never}
            organizationId={member.organizationId}
          />
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/inventory/movements" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Todas movimentações
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/locations" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Gerenciar locais
          </Link>
        </Button>
      </div>
    </div>
  );
}
