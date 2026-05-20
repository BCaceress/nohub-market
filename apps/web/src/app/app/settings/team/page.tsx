import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamManager } from "@/features/app/team-manager";
import { getMembersAction } from "@/features/app/actions/team-actions";
import { getPendingInvitationsAction } from "@/features/app/actions/invite-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Time — NoHub Market" };

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [members, invitations] = await Promise.all([
    getMembersAction(member.organizationId),
    getPendingInvitationsAction(member.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Time</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os membros e papéis da sua organização.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
          <CardDescription>
            Admin e Owner podem adicionar ou remover membros. O papel do Owner não pode ser alterado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamManager
            organizationId={member.organizationId}
            currentUserId={session.user.id}
            initialMembers={members}
            initialInvitations={invitations}
          />
        </CardContent>
      </Card>
    </div>
  );
}
