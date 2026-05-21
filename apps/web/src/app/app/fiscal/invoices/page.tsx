/**
 * Notas Fiscais — listagem com filtro de status.
 */

import { listInvoicesAction } from "@/features/fiscal/actions/fiscal-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { InvoicesClient } from "./invoices-client";

export const metadata = { title: "Notas Fiscais — NoHub Market" };

type SearchParams = {
  status?: string;
  page?: string;
};

export default async function InvoicesPage({
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
  const page = sp.page ? Number.parseInt(sp.page, 10) : 1;

  const result = await listInvoicesAction({
    status: sp.status,
    page,
    limit: 20,
  });

  return (
    <InvoicesClient
      invoices={result.success ? result.invoices : []}
      total={result.success ? result.total : 0}
      page={page}
      statusFilter={sp.status ?? ""}
      error={result.success ? null : result.error}
    />
  );
}
