import { prisma } from "@nohub/db";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPendingInvitationsAction } from "@/features/app/actions/invite-actions";
import { getMembersAction } from "@/features/app/actions/team-actions";
import { TeamManager } from "@/features/app/team-manager";
import { getSession } from "@/lib/auth-server";

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
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        iconTone="primary"
        title="Time"
        description="Gerencie os membros e papéis da sua organização."
      />

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>
            Admin e Owner podem adicionar ou remover membros. O papel do Owner não pode ser
            alterado.
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
