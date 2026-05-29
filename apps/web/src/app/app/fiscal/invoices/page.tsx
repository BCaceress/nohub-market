/**
 * Notas Fiscais — listagem com filtro de status.
 */

import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { listInvoicesAction } from "@/features/fiscal/actions/fiscal-actions";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
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

  const locs = await prisma.location.findMany({
    where: { organizationId: member.organizationId, deletedAt: null },
    select: { id: true },
  });
  const scopedIds =
    member.locationScopes.length > 0
      ? locs.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : locs.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const locationId = cookieSelected === ALL_LOCATIONS ? undefined : cookieSelected;

  const result = await listInvoicesAction({
    status: sp.status,
    locationId,
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
