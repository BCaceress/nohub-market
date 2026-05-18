import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";

export default async function DashboardPage() {
  const session = await getSession();
  const member = await prisma.member.findFirst({
    where: { userId: session?.user.id },
    include: {
      organization: { include: { capabilities: true, locations: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const org = member?.organization;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Bem-vindo ao NoHub Market</h1>
        <p className="text-muted-foreground">
          Onboarding concluído. Os módulos de negócio chegam nas próximas etapas.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unidades</CardTitle>
            <CardDescription>{org?.locations.length ?? 0} cadastradas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Capabilities ativas</CardTitle>
            <CardDescription>{org?.capabilities.length ?? 0} regras aplicadas</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seu papel</CardTitle>
            <CardDescription>{member?.role}</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personalização do sistema</CardTitle>
          <CardDescription>
            Estas capabilities controlam o que aparece para o seu negócio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {org?.capabilities.length ? (
            <ul className="flex flex-wrap gap-2">
              {org.capabilities.map((c) => (
                <li key={c.id} className="rounded-md border bg-secondary px-3 py-1 text-sm">
                  {c.key}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma capability derivada do seu tipo de negócio.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
