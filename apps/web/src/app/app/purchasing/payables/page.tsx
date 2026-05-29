/**
 * Contas a Pagar — listagem com filtro de status e vencidas.
 */

import { redirect } from "next/navigation";
import { listAccountPayablesAction } from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { PayablesClient } from "./payables-client";

export const metadata = { title: "Contas a Pagar — NoHub Market" };

type SearchParams = { status?: string; overdue?: string; page?: string };

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const sp = await searchParams;
  const page = sp.page ? Number.parseInt(sp.page, 10) : 1;

  const result = await listAccountPayablesAction({
    status: sp.status,
    overdue: sp.overdue === "1",
    page,
    pageSize: 20,
  });

  return (
    <PayablesClient
      payables={result.payables}
      total={result.total}
      page={page}
      statusFilter={sp.status ?? ""}
      showOverdue={sp.overdue === "1"}
    />
  );
}
