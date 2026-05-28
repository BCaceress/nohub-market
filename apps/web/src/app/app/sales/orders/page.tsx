/**
 * Lista de Pedidos — todos os canais.
 */

import { PageHeader } from "@/components/page-header";
import { getOrdersAction } from "@/features/sales/actions/order-actions";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { prisma } from "@nohub/db";
import type { OrderChannel, OrderStatus } from "@nohub/db";
import { Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { OrdersClient } from "./orders-client";

export const metadata = { title: "Pedidos — NoHub Market" };

type SearchParams = {
  status?: string;
  channel?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const sp = await searchParams;
  const orgLocations = await prisma.location.findMany({
    where: { organizationId: member.organizationId, deletedAt: null },
    select: { id: true },
  });
  const scopedIds =
    member.locationScopes.length > 0
      ? orgLocations.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : orgLocations.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const locationId = cookieSelected === ALL_LOCATIONS ? undefined : cookieSelected;

  const result = await getOrdersAction(member.organizationId, {
    status: sp.status as OrderStatus | undefined,
    channel: sp.channel as OrderChannel | undefined,
    locationId,
    from: sp.from,
    to: sp.to,
    search: sp.search,
    page: Number(sp.page ?? "1"),
    pageSize: 25,
  });

  // Serialize Decimal fields for client component
  const serializedOrders = result.orders.map((o) => ({
    ...o,
    total: Number(o.total),
    payments: o.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    items: o.items.map((i) => ({
      productNameSnapshot: i.productNameSnapshot,
      quantity: Number(i.quantity),
      lineTotal: Number(i.lineTotal),
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Receipt className="h-5 w-5" />}
        iconTone="primary"
        title="Pedidos"
        description={`${result.total} pedido${result.total !== 1 ? "s" : ""} encontrado${result.total !== 1 ? "s" : ""}.`}
      />
      <OrdersClient
        orders={serializedOrders}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        organizationId={member.organizationId}
      />
    </div>
  );
}
