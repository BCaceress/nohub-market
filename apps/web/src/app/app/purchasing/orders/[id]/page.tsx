/**
 * Detalhe do Pedido de Compra — itens, histórico e ações.
 */

import { notFound, redirect } from "next/navigation";
import { getPurchaseOrderAction } from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { PurchaseOrderDetailClient } from "./po-detail-client";

export const metadata = { title: "Pedido de Compra — NoHub Market" };

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const { id } = await params;
  const po = await getPurchaseOrderAction(id);
  if (!po) notFound();

  return <PurchaseOrderDetailClient po={po} />;
}
