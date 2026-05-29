/**
 * Pedidos de Compra — listagem com filtro de status.
 */

import { redirect } from "next/navigation";
import { listPurchaseOrdersAction } from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { PurchaseOrdersClient } from "./orders-client";

export const metadata = { title: "Pedidos de Compra — NoHub Market" };

type SearchParams = { status?: string; page?: string };

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const sp = await searchParams;
  const page = sp.page ? Number.parseInt(sp.page, 10) : 1;

  const result = await listPurchaseOrdersAction({ status: sp.status, page, pageSize: 20 });

  return (
    <PurchaseOrdersClient
      orders={result.orders}
      total={result.total}
      page={page}
      statusFilter={sp.status ?? ""}
    />
  );
}
