import { PageHeader } from "@/components/page-header";
import { getChannelsAction } from "@/features/app/actions/channel-actions";
import { ChannelsManager } from "@/features/app/channels-manager";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { Radio } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = { title: "Canais de venda — NoHub Market" };

export default async function ChannelsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const rawChannels = await getChannelsAction(member.organizationId);
  const channels = rawChannels.map((ch) => ({
    ...ch,
    config: ch.config as Record<string, string> | null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Radio className="h-5 w-5" />}
        iconTone="primary"
        title="Canais de venda"
        description="Ative ou desative os canais configurados no onboarding."
      />
      <ChannelsManager organizationId={member.organizationId} channels={channels} />
    </div>
  );
}
