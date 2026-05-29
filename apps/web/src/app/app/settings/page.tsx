import { prisma } from "@nohub/db";
import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgAction } from "@/features/app/actions/org-actions";
import { SettingsOrgForm } from "@/features/app/settings-org-form";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Organização — NoHub Market" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const org = await getOrgAction(member.organizationId);
  if (!org) redirect("/onboarding");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        iconTone="primary"
        title="Organização"
        description="Dados legais, identidade e endereço da empresa."
      />

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
          <CardDescription>O CNPJ não pode ser alterado após o cadastro.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsOrgForm org={org} />
        </CardContent>
      </Card>
    </div>
  );
}
