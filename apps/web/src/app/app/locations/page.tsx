import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocationsAction } from "@/features/app/actions/location-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { Building2, MapPin, Moon, Pencil, Plus, ShoppingBag, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Unidades — NoHub Market" };

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  STORE: { label: "Loja", icon: ShoppingBag },
  DC: { label: "Centro de distribuição", icon: Building2 },
  HYBRID: { label: "Híbrido", icon: Sparkles },
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
      <PageHeader
        icon={<MapPin className="h-5 w-5" />}
        iconTone="primary"
        title="Unidades"
        description="Lojas, centros de distribuição e pontos de venda da organização."
        actions={
          <Button asChild size="sm">
            <Link href="/app/locations/new">
              <Plus className="h-3.5 w-3.5" />
              Nova unidade
            </Link>
          </Button>
        }
      />

      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-1 text-muted-foreground ring-1 ring-border">
            <MapPin className="h-6 w-6" />
          </span>
          <h3 className="mt-4 font-display text-[16px] font-semibold">
            Nenhuma unidade cadastrada
          </h3>
          <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">
            Cadastre a primeira unidade da sua organização para começar a operar.
          </p>
          <Button asChild className="mt-5" size="sm">
            <Link href="/app/locations/new">
              <Plus className="h-3.5 w-3.5" />
              Criar unidade
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {locations.map((loc) => {
            const conf = TYPE_CONFIG[loc.type] ?? { label: loc.type, icon: MapPin };
            const Icon = conf.icon;
            return (
              <Card
                key={loc.id}
                className="group transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate leading-tight">{loc.name}</CardTitle>
                        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-subtle">
                          {conf.label}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/app/locations/${loc.id}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-1"
                      aria-label={`Editar ${loc.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {loc.isSelfService && (
                    <Badge variant="soft" dotColor="primary">
                      Autoatendimento
                    </Badge>
                  )}
                  {loc.is24h && (
                    <Badge variant="info" dotColor="info">
                      <Moon className="h-3 w-3" />
                      24h
                    </Badge>
                  )}
                  {loc.city && (
                    <Badge variant="outline">
                      <MapPin className="h-3 w-3" />
                      {loc.city}
                      {loc.state && `, ${loc.state}`}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
