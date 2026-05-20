import { ChannelsManager } from "@/features/app/channels-manager";
import { getChannelsAction } from "@/features/app/actions/channel-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
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
      <div>
        <h1 className="text-2xl font-bold">Canais de venda</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ative ou desative os canais configurados no onboarding.
        </p>
      </div>
      <ChannelsManager organizationId={member.organizationId} channels={channels} />
    </div>
  );
}
