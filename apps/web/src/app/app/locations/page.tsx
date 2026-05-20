import Link from "next/link";
import { MapPin, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocationsAction } from "@/features/app/actions/location-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Unidades — NoHub Market" };

const TYPE_LABELS: Record<string, string> = {
  STORE:  "Loja",
  DC:     "Centro de distribuição",
  HYBRID: "Híbrido",
};

export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const locations = await getLocationsAction(member.organizationId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lojas, centros de distribuição e pontos de venda da organização.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/locations/new">
            <Plus className="h-4 w-4" />
            Nova unidade
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <MapPin className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold">Nenhuma unidade cadastrada</h3>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Cadastre a primeira unidade da sua organização.
          </p>
          <Button asChild className="mt-6">
            <Link href="/app/locations/new">
              <Plus className="h-4 w-4" />
              Criar unidade
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <Card key={loc.id} className="group transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="leading-snug">{loc.name}</CardTitle>
                  <Link
                    href={`/app/locations/${loc.id}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary"
                    aria-label={`Editar ${loc.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </div>
                <CardDescription>{TYPE_LABELS[loc.type] ?? loc.type}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {loc.isSelfService && (
                  <Badge variant="secondary">Autoatendimento</Badge>
                )}
                {loc.is24h && (
                  <Badge variant="secondary">24h</Badge>
                )}
                {loc.city && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {loc.city}{loc.state && `, ${loc.state}`}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
