import { prisma } from "@nohub/db";
import { AlertTriangle, ArrowLeft, CalendarClock } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getLocationStockAction } from "@/features/inventory/actions/stock-actions";
import { getSession } from "@/lib/auth-server";
import { UnitStockClient } from "./unit-stock-client";

export const metadata = { title: "Estoque da unidade — NoHub Market" };

export default async function UnitStockPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;

  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: member.organizationId, deletedAt: null },
  });
  if (!location) notFound();

  const [entries, allLocations, products] = await Promise.all([
    getLocationStockAction(member.organizationId, locationId),
    prisma.location.findMany({
      where: { organizationId: member.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { organizationId: member.organizationId, deletedAt: null, active: true },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  const totalSkus = entries.length;
  const totalUnits = entries.reduce((s, e) => s + Number(e.quantity), 0);
  const lowStockCount = entries.filter(
    (e) => e.minQuantity !== null && Number(e.quantity) <= Number(e.minQuantity),
  ).length;
  const expiringCount = entries.filter((e) => {
    if (!e.expiryDate) return false;
    return new Date(e.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }).length;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <Link
          href="/app/inventory"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Estoque
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{location.name}</h1>
            <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>{totalSkus} SKUs</span>
              <span>·</span>
              <span>
                {totalUnits.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} unidades
              </span>
              {lowStockCount > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {lowStockCount} abaixo do mínimo
                  </span>
                </>
              )}
              {expiringCount > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {expiringCount} vencendo
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/app/inventory/movements?locationId=${locationId}`}>Histórico</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Interactive table ───────────────────────────────────── */}
      <UnitStockClient
        organizationId={member.organizationId}
        location={{ id: location.id, name: location.name }}
        allLocations={allLocations}
        entries={entries as never}
        products={products}
      />
    </div>
  );
}
