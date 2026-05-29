/**
 * Gestão de Caixa — sessão de caixa, sangria, suprimento.
 */

import { prisma } from "@nohub/db";
import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { CashClient } from "./cash-client";

export const metadata = { title: "Caixa — NoHub Market" };

export default async function CashPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const orgId = member.organizationId;
  const userId = session.user.id;

  const locations = await prisma.location.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedIds =
    member.locationScopes.length > 0
      ? locations.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : locations.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const filterLocationId = cookieSelected === ALL_LOCATIONS ? undefined : cookieSelected;

  const openSessions = await prisma.cashSession.findMany({
    where: {
      organizationId: orgId,
      status: "OPEN",
      ...(filterLocationId && { locationId: filterLocationId }),
    },
    include: {
      location: { select: { name: true } },
      movements: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { orders: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const recentClosed = await prisma.cashSession.findMany({
    where: {
      organizationId: orgId,
      status: "CLOSED",
      ...(filterLocationId && { locationId: filterLocationId }),
    },
    include: { location: { select: { name: true } } },
    orderBy: { closedAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Wallet className="h-5 w-5" />}
        iconTone="primary"
        title="Caixa"
        description="Gestão de sessões de caixa do PDV — abertura, sangria, suprimento e fechamento."
      />
      <CashClient
        locations={locations}
        openSessions={openSessions.map((s) => ({
          id: s.id,
          locationId: s.locationId,
          location: s.location,
          openingAmount: Number(s.openingAmount),
          closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
          systemAmount: s.systemAmount ? Number(s.systemAmount) : null,
          divergence: s.divergence ? Number(s.divergence) : null,
          status: s.status,
          openedAt: s.openedAt.toISOString(),
          movements: s.movements.map((m) => ({
            id: m.id,
            type: m.type,
            amount: Number(m.amount),
            note: m.note,
            createdAt: m.createdAt.toISOString(),
          })),
          _count: s._count,
        }))}
        recentClosed={recentClosed.map((s) => ({
          id: s.id,
          locationId: s.locationId,
          location: s.location,
          openingAmount: Number(s.openingAmount),
          closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
          systemAmount: s.systemAmount ? Number(s.systemAmount) : null,
          divergence: s.divergence ? Number(s.divergence) : null,
          status: s.status,
          openedAt: s.openedAt.toISOString(),
          closedAt: s.closedAt?.toISOString() ?? null,
        }))}
        organizationId={orgId}
        actorId={userId}
      />
    </div>
  );
}
