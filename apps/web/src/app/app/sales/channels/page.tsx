/**
 * Canais — conectar/desconectar iFood, WhatsApp, Mercado Livre.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { getChannelIntegrationsAction } from "@/features/sales/actions/channel-actions";
import { ChannelsClient } from "./channels-client";

export const metadata = { title: "Canais — NoHub Market" };

export default async function ChannelsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const integrations = await getChannelIntegrationsAction(member.organizationId);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Canais de Venda</h1>
        <p className="text-sm text-muted-foreground">
          Conecte sua loja aos principais canais de venda
        </p>
      </div>
      <ChannelsClient
        integrations={integrations}
        organizationId={member.organizationId}
        actorId={session.user.id}
      />
    </div>
  );
}
