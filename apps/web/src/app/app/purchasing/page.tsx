/**
 * Compras — hub único: Pedidos, Contas a pagar e Devoluções em segmented views,
 * com Recebimento, Importar NFe, Sugestões e Cotações em side panels.
 */

import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { searchOrgProductsAction } from "@/features/app/actions/supplier-actions";
import {
  listLocationsAction,
  listNfeImportsAction,
  listPurchaseOrdersAction,
  listQuotationsAction,
  listSuggestionsAction,
  listSuppliersAction,
} from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { PurchasingHub } from "./purchasing-hub";

export const metadata = { title: "Compras — NoHub Market" };

type View = "orders" | "returns";

type SearchParams = {
  view?: string;
  status?: string;
  page?: string;
  receive?: string;
};

export default async function PurchasingPage({
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
  const view: View = sp.view === "returns" ? sp.view : "orders";
  const page = sp.page ? Number.parseInt(sp.page, 10) : 1;
  const status = sp.status;

  // Listas das views — só busca a ativa em modo paginado; as demais ficam vazias
  // (são recarregadas ao trocar de aba, mantendo cada query leve).
  const [ordersResult, returnRows] = await Promise.all([
    view === "orders"
      ? listPurchaseOrdersAction({ status, page, pageSize: 20 })
      : Promise.resolve({ orders: [], total: 0 }),
    view === "returns"
      ? prisma.supplierReturn.findMany({
          where: { organizationId: member.organizationId },
          include: { supplier: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  // Dados dos painéis (leves — limites baixos nas actions)
  const [suggestions, quotations, nfeImports, locations, suppliers, products, confirmedReceipts] =
    await Promise.all([
      listSuggestionsAction(),
      listQuotationsAction(),
      listNfeImportsAction(),
      listLocationsAction(),
      listSuppliersAction(),
      searchOrgProductsAction(),
      prisma.goodsReceipt.findMany({
        where: { organizationId: member.organizationId, status: "CONFIRMED" },
        include: { purchaseOrder: { select: { supplier: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  const receiptOptions = confirmedReceipts.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    supplierName: r.purchaseOrder?.supplier?.name ?? "—",
  }));

  const supplierOptions = suppliers.map((s) => ({ id: s.id, name: s.name }));

  return (
    <PurchasingHub
      view={view}
      orders={{
        rows: ordersResult.orders,
        total: ordersResult.total,
        page,
        statusFilter: status ?? "",
      }}
      returns={{ rows: returnRows }}
      suggestions={suggestions}
      quotations={quotations}
      nfeImports={nfeImports}
      locations={locations}
      suppliers={supplierOptions}
      products={products}
      confirmedReceipts={receiptOptions}
      initialReceivePoId={sp.receive ?? null}
    />
  );
}
