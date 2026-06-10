/**
 * Online — pedidos de canais digitais + gestão de canais (side panel).
 * Sem canal conectado: exibe grid de canais para ativar.
 */

import type { OrderChannel, OrderStatus } from "@nohub/db";
import { prisma } from "@nohub/db";
import { Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getChannelIntegrationsAction } from "@/features/sales/actions/channel-actions";
import { getOrdersAction } from "@/features/sales/actions/order-actions";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { OnlineClient } from "./online-client";

export const metadata = { title: "Online — NoHub Market" };

type SearchParams = {
  status?: string;
  channel?: string;
  period?: string;
  search?: string;
  page?: string;
};

function resolveFrom(period: string | undefined): string | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "7d") d.setDate(d.getDate() - 7);
  // default (period ausente ou "today") = início de hoje
  return d.toISOString();
}

export default async function OnlinePage({
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

  const [result, integrations, pendingCount] = await Promise.all([
    getOrdersAction(member.organizationId, {
      status: sp.status as OrderStatus | undefined,
      channel: sp.channel as OrderChannel | undefined,
      locationId,
      from: resolveFrom(sp.period),
      search: sp.search,
      page: Number(sp.page ?? "1"),
      pageSize: 25,
    }),
    getChannelIntegrationsAction(member.organizationId),
    // Contagem estável (sem filtros) p/ detectar novos pedidos via polling.
    prisma.order.count({
      where: {
        organizationId: member.organizationId,
        channel: { notIn: ["POS", "SELF_SERVICE"] },
        status: { in: ["CONFIRMED", "PAID"] },
      },
    }),
  ]);

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

  const hasConnected = integrations.some((i) => i.status === "CONNECTED");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Globe className="h-5 w-5" />}
        iconTone="primary"
        title="Online"
        description={
          hasConnected
            ? `${result.total} pedido${result.total !== 1 ? "s" : ""} no período.`
            : "Gerencie suas vendas dos canais digitais em um só lugar."
        }
      />
      <OnlineClient
        orders={serializedOrders}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        organizationId={member.organizationId}
        actorId={session.user.id}
        integrations={integrations}
        pendingCount={pendingCount}
      />
    </div>
  );
}
