import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect, notFound } from "next/navigation";
import { getInventoryCountDetailAction } from "@/features/inventory/actions/inventory-count-actions";
import { Badge } from "@/components/ui/badge";
import { CountSessionClient } from "./count-session-client";

export const metadata = { title: "Contagem Física — NoHub Market" };

export default async function CountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const count = await getInventoryCountDetailAction(member.organizationId, id);
  if (!count) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/app/inventory/count"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Contagens
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">
                Contagem — {count.location.name}
              </h1>
              {count.status === "CLOSED" && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Encerrada
                </Badge>
              )}
              {count.status === "IN_PROGRESS" && (
                <Badge variant="warning">Em andamento</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Iniciada em{" "}
              {new Date(count.startedAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {count.note && ` · ${count.note}`}
            </p>
          </div>
        </div>
      </div>

      <CountSessionClient
        organizationId={member.organizationId}
        count={count}
        isClosed={count.status === "CLOSED"}
      />
    </div>
  );
}
