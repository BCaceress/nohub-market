import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import {
  getAlertsAction,
  getBalanceSummaryAction,
} from "@/features/inventory/actions/inventory-actions";
import { getLocationsAction } from "@/features/inventory/actions/transfer-actions";
import { BalanceTable } from "@/features/inventory/components/balance-table";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { prisma } from "@nohub/db";
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Package,
  PackagePlus,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  const locations = await getLocationsAction(member.organizationId);
  const scopedIds =
    member.locationScopes.length > 0
      ? locations.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : locations.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const effectiveLocationId =
    sp.locationId ?? (cookieSelected === ALL_LOCATIONS ? undefined : cookieSelected);

  const [balances, alerts] = await Promise.all([
    getBalanceSummaryAction(member.organizationId, effectiveLocationId),
    getAlertsAction(member.organizationId),
  ]);

  const totalOnHand = balances.reduce((s, r) => s + r.quantityOnHand, 0);
  const totalProducts = new Set(balances.map((r) => r.productId)).size;
  const totalReserved = balances.reduce((s, r) => s + r.quantityReserved, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Boxes className="h-5 w-5" />}
        iconTone="primary"
        title="Estoque"
        description="Saldos físicos, reservas e disponibilidade em tempo real."
        meta={
          locations.length > 1 && effectiveLocationId ? (
            <Badge variant="soft" dotColor="primary">
              filtro: {locations.find((l) => l.id === effectiveLocationId)?.name ?? "—"}
            </Badge>
          ) : null
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/inventory/inbound">
                <PackagePlus className="h-3.5 w-3.5" />
                Entrada
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/inventory/loss">
                <Trash2 className="h-3.5 w-3.5" />
                Perda
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/inventory/transfer">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Transferir
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/app/inventory/count">
                <ClipboardList className="h-3.5 w-3.5" />
                Contagem
              </Link>
            </Button>
          </>
        }
      />

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Produtos com saldo"
          value={totalProducts}
          icon={<Package className="h-4 w-4" />}
          iconTone="info"
        />
        <Stat
          label="Unidades físicas"
          value={totalOnHand.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          icon={<Boxes className="h-4 w-4" />}
          iconTone="primary"
          hint={totalReserved > 0 ? `${totalReserved.toFixed(0)} reservadas` : undefined}
        />
        <Stat
          label="Estoque baixo"
          value={alerts.lowStockCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          iconTone={alerts.lowStockCount > 0 ? "warning" : "neutral"}
          hint={alerts.lowStockCount > 0 ? "abaixo do mínimo" : "ok"}
        />
        <Stat
          label="Lotes vencendo"
          value={alerts.expiringCount}
          icon={<CalendarClock className="h-4 w-4" />}
          iconTone={alerts.expiringCount > 0 ? "destructive" : "neutral"}
          hint={alerts.expiringCount > 0 ? "próximos 30 dias" : "sem urgência"}
        />
      </div>

      {/* ── Alerts ─────────────────────────────────────────────── */}
      {(alerts.lowStockCount > 0 || alerts.expiringCount > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {alerts.lowStockCount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Estoque abaixo do mínimo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {alerts.lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.product.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.location.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                      <span className="font-semibold text-warning">
                        {item.quantityOnHand.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground">/ {item.minQuantity.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
                {alerts.lowStockCount > 10 && (
                  <p className="pt-1.5 text-center text-[11px] text-muted-foreground">
                    + {alerts.lowStockCount - 10} itens
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {alerts.expiringCount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <CalendarClock className="h-4 w-4" />
                  Lotes vencendo em 30 dias
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {alerts.expiringItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors hover:bg-surface-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.product.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{item.code}</p>
                    </div>
                    <Badge variant="destructive">
                      {item.expiryDate
                        ? new Date(item.expiryDate).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Balance table ──────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[17px] font-semibold tracking-tight">
            Saldo por produto
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/inventory/movements" className="gap-1">
              Movimentações <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {balances.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-1 text-muted-foreground ring-1 ring-border">
                <Boxes className="h-5 w-5" />
              </span>
              <p className="text-[14px] font-semibold">Nenhum saldo registrado</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
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
          <BalanceTable rows={balances as never} organizationId={member.organizationId} />
        )}
      </div>

      {/* ── Quick links ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/inventory/movements">
            <TrendingUp className="h-3.5 w-3.5" />
            Todas movimentações
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/locations">
            <Package className="h-3.5 w-3.5" />
            Gerenciar locais
          </Link>
        </Button>
      </div>
    </div>
  );
}
