import { prisma } from "@nohub/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocationAction } from "@/features/app/actions/location-actions";
import { LocationForm } from "@/features/app/location-form";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Editar unidade — NoHub Market" };

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const location = await getLocationAction(id, member.organizationId);
  if (!location) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Editar unidade</h1>
        <p className="text-muted-foreground text-sm mt-1">{location.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da unidade</CardTitle>
          <CardDescription>Atualize os dados desta unidade.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationForm organizationId={member.organizationId} location={location} />
        </CardContent>
      </Card>
    </div>
  );
}
