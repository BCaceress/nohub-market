import { prisma } from "@nohub/db";
import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";
import { ReportsClient } from "@/features/reports/components/reports-client";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Relatórios — NoHub Market" };

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  // Relatórios financeiros são de gestão (RBAC reforçado nas server actions).
  if (!["owner", "admin", "manager"].includes(member.role)) {
    redirect("/app");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="page-gradient relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-sm ring-1 ring-primary/15">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Relatórios</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Relatórios fixos, personalizados e gerados por IA.
            </p>
          </div>
        </div>
      </div>
      <ReportsClient />
    </div>
  );
}
