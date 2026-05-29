/**
 * Canais — conectar/desconectar iFood, WhatsApp, Mercado Livre.
 */

import { prisma } from "@nohub/db";
import { Link2 } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getChannelIntegrationsAction } from "@/features/sales/actions/channel-actions";
import { getSession } from "@/lib/auth-server";
import { ChannelsClient } from "./channels-client";

export const metadata = { title: "Canais — NoHub Market" };

export default async function ChannelsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const integrations = await getChannelIntegrationsAction(member.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Link2 className="h-5 w-5" />}
        iconTone="primary"
        title="Canais de venda"
        description="Conecte sua loja aos principais canais de venda externos — iFood, WhatsApp, Mercado Livre."
      />
      <ChannelsClient
        integrations={integrations}
        organizationId={member.organizationId}
        actorId={session.user.id}
      />
    </div>
  );
}
