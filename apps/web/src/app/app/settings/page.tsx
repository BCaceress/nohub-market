import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsOrgForm } from "@/features/app/settings-org-form";
import { getOrgAction } from "@/features/app/actions/org-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

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
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organização</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados legais e endereço da empresa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
          <CardDescription>
            O CNPJ não pode ser alterado após o cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsOrgForm org={org} />
        </CardContent>
      </Card>
    </div>
  );
}
