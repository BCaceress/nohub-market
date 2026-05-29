import { prisma } from "@nohub/db";
import { ArrowLeft, CheckCircle, ClipboardList, Clock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getInventoryCountsAction } from "@/features/inventory/actions/inventory-count-actions";
import { getLocationsAction } from "@/features/inventory/actions/transfer-actions";
import { getSession } from "@/lib/auth-server";
import { StartCountButton } from "./start-count-button";

export const metadata = { title: "Contagens de Estoque — NoHub Market" };

const STATUS_CONFIG = {
  DRAFT: { label: "Rascunho", variant: "secondary" as const, icon: <Clock className="h-3 w-3" /> },
  IN_PROGRESS: {
    label: "Em andamento",
    variant: "warning" as const,
    icon: <Clock className="h-3 w-3" />,
  },
  CLOSED: {
    label: "Encerrada",
    variant: "success" as const,
    icon: <CheckCircle className="h-3 w-3" />,
  },
};

export default async function CountPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [counts, locations] = await Promise.all([
    getInventoryCountsAction(member.organizationId),
    getLocationsAction(member.organizationId),
  ]);

  const countedItems = (items: { countedQuantity: unknown }[]) =>
    items.filter((i) => i.countedQuantity !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/app/inventory"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Estoque
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contagens físicas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inventário físico com ajuste automático de divergências (RN-E13).
            </p>
          </div>
          <StartCountButton organizationId={member.organizationId} locations={locations} />
        </div>
      </div>

      {counts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Nenhuma contagem realizada</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inicie uma contagem física para auditar e ajustar seus saldos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {counts.map((count, i) => {
            const cfg = STATUS_CONFIG[count.status] ?? STATUS_CONFIG.DRAFT;
            const counted = countedItems(count.items);
            const total = count.items.length;

            return (
              <Link
                key={count.id}
                href={`/app/inventory/count/${count.id}`}
                className={`flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/30 ${
                  i !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{count.location.name}</p>
                    <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(count.startedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    {counted}/{total} itens contados
                    {count.closedAt && (
                      <> · Encerrada em {new Date(count.closedAt).toLocaleDateString("pt-BR")}</>
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
