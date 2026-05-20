import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActions } from "@/features/app/account-actions";
import { TwoFactorSetup } from "@/features/auth/two-factor-setup";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Minha conta — NoHub Market" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, name: true, email: true },
  });

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Minha conta</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.name} · {user?.email}
        </p>
      </div>

      {/* 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
          <CardDescription>
            Configure autenticação de dois fatores (TOTP) para proteger sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup enabled={user?.twoFactorEnabled ?? false} />
        </CardContent>
      </Card>

      {/* LGPD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacidade e dados (LGPD)</CardTitle>
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
