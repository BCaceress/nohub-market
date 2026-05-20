/**
 * Lista de Pedidos — todos os canais.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { getOrdersAction } from "@/features/sales/actions/order-actions";
import { OrdersClient } from "./orders-client";
import type { OrderStatus, OrderChannel } from "@nohub/db";

export const metadata = { title: "Pedidos — NoHub Market" };

type SearchParams = {
  status?:  string;
  channel?: string;
  from?:    string;
  to?:      string;
  search?:  string;
  page?:    string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const sp = await searchParams;
  const result = await getOrdersAction(member.organizationId, {
    status:   sp.status  as OrderStatus  | undefined,
    channel:  sp.channel as OrderChannel | undefined,
    from:     sp.from,
    to:       sp.to,
    search:   sp.search,
    page:     Number(sp.page ?? "1"),
    pageSize: 25,
  });

  // Serialize Decimal fields for client component
  const serializedOrders = result.orders.map((o) => ({
    ...o,
    total:    Number(o.total),
    payments: o.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    items:    o.items.map((i) => ({
      productNameSnapshot: i.productNameSnapshot,
      quantity:            Number(i.quantity),
      lineTotal:           Number(i.lineTotal),
    })),
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          {result.total} pedido{result.total !== 1 ? "s" : ""} encontrado{result.total !== 1 ? "s" : ""}
        </p>
      </div>
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
