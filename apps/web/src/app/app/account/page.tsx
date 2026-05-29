import { prisma } from "@nohub/db";
import { ShieldCheck, User } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActions } from "@/features/app/account-actions";
import { TwoFactorSetup } from "@/features/auth/two-factor-setup";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Minha conta — NoHub Market" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, name: true, email: true },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        icon={<User className="h-5 w-5" />}
        iconTone="primary"
        title="Minha conta"
        description={`${user?.name ?? "—"} · ${user?.email ?? ""}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            Segurança
          </CardTitle>
          <CardDescription>
            Configure autenticação de dois fatores (TOTP) para proteger sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup enabled={user?.twoFactorEnabled ?? false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacidade e dados (LGPD)</CardTitle>
          <CardDescription>
            Exporte todos os seus dados ou solicite a exclusão da conta a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountActions />
        </CardContent>
      </Card>
    </div>
  );
}
