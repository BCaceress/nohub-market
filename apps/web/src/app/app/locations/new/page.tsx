import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationForm } from "@/features/app/location-form";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Nova unidade — NoHub Market" };

export default async function NewLocationPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Nova unidade</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Preencha os dados da nova loja ou ponto de distribuição.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da unidade</CardTitle>
          <CardDescription>O endereço é opcional e pode ser preenchido depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationForm organizationId={member.organizationId} />
        </CardContent>
      </Card>
    </div>
  );
}
