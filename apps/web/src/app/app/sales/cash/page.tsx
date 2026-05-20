/**
 * Gestão de Caixa — sessão de caixa, sangria, suprimento.
 */

import { redirect } from "next/navigation";
import { prisma } from "@nohub/db";
import { getSession } from "@/lib/auth-server";
import { CashClient } from "./cash-client";

export const metadata = { title: "Caixa — NoHub Market" };

export default async function CashPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const orgId  = member.organizationId;
  const userId = session.user.id;

  const locations = await prisma.location.findMany({
    where:   { organizationId: orgId, deletedAt: null },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const openSessions = await prisma.cashSession.findMany({
    where:   { organizationId: orgId, status: "OPEN" },
    include: {
      location:  { select: { name: true } },
      movements: { orderBy: { createdAt: "desc" }, take: 5 },
      _count:    { select: { orders: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const recentClosed = await prisma.cashSession.findMany({
    where:   { organizationId: orgId, status: "CLOSED" },
    include: { location: { select: { name: true } } },
    orderBy: { closedAt: "desc" },
    take:    10,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Caixa</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de sessões de caixa do PDV
        </p>
      </div>
      <CashClient
        locations={locations}
        openSessions={openSessions.map((s) => ({
          id:            s.id,
          locationId:    s.locationId,
          location:      s.location,
          openingAmount: Number(s.openingAmount),
          closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
          systemAmount:  s.systemAmount  ? Number(s.systemAmount)  : null,
          divergence:    s.divergence    ? Number(s.divergence)    : null,
          status:        s.status,
          openedAt:      s.openedAt.toISOString(),
          movements:     s.movements.map((m) => ({
            id:        m.id,
            type:      m.type,
            amount:    Number(m.amount),
            note:      m.note,
            createdAt: m.createdAt.toISOString(),
          })),
          _count: s._count,
        }))}
        recentClosed={recentClosed.map((s) => ({
          id:            s.id,
          locationId:    s.locationId,
          location:      s.location,
          openingAmount: Number(s.openingAmount),
          closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
          systemAmount:  s.systemAmount  ? Number(s.systemAmount)  : null,
          divergence:    s.divergence    ? Number(s.divergence)    : null,
          status:        s.status,
          openedAt:      s.openedAt.toISOString(),
          closedAt:      s.closedAt?.toISOString() ?? null,
        }))}
        organizationId={orgId}
        actorId={userId}
      />
    </div>
  );
}
