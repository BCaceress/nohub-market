import { prisma } from "@nohub/db";
import { notFound, redirect } from "next/navigation";
import { getProductAction } from "@/features/catalog/actions/product-actions";
import { getMovementsAction } from "@/features/inventory/actions/stock-actions";
import { getProductSalesStatsAction } from "@/features/sales/actions/order-actions";
import { getSession } from "@/lib/auth-server";
import { ProductOverviewClient } from "./overview-client";

export default async function ProductOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const { organizationId } = member;

  const product = await getProductAction(id, organizationId);
  if (!product) notFound();

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);

  const [stockEntries, { total: totalMovements, movements }, salesStats] = await Promise.all([
    prisma.stockEntry.findMany({
      where: { organizationId, productId: id },
      include: { location: { select: { id: true, name: true } } },
      orderBy: { location: { name: "asc" } },
    }),
    getMovementsAction(organizationId, { productId: id, from, to: now, take: 50 }),
    getProductSalesStatsAction(organizationId, id, { from, to: now }),
  ]);

  return (
    <ProductOverviewClient
      organizationId={organizationId}
      product={product}
      stockEntries={stockEntries.map((e) => ({
        id: e.id,
        locationId: e.locationId,
        locationName: e.location?.name ?? "—",
        quantity: Number(e.quantity),
        minQuantity: e.minQuantity !== null ? Number(e.minQuantity) : null,
        maxQuantity: e.maxQuantity !== null ? Number(e.maxQuantity) : null,
        shelfLocation: e.shelfLocation,
        expiryDate: e.expiryDate?.toISOString() ?? null,
        batchCode: e.batchCode,
      }))}
      movements={movements.map((m) => ({
        id: m.id,
        type: m.type,
        quantity: Number(m.quantity),
        previousQty: Number(m.previousQty),
        newQty: Number(m.newQty),
        locationName: m.location?.name ?? "—",
        notes: m.notes ?? m.note ?? null,
        reason: m.reason ?? null,
        referenceType: m.referenceType ?? null,
        referenceId: m.referenceId ?? null,
        createdAt: m.createdAt.toISOString(),
        userName: m.userName ?? null,
      }))}
      totalMovements={totalMovements}
      salesStats={salesStats}
      defaultFrom={from.toISOString()}
      defaultTo={now.toISOString()}
    />
  );
}
