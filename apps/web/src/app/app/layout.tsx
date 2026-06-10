import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { NavSidebar } from "@/components/nav-sidebar";
import { CapabilitiesProvider } from "@/features/app/capabilities-provider";
import { getSession } from "@/lib/auth-server";
import { getCapabilities } from "@/lib/capabilities";

function getInitials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/app");
  if (!session.user.emailVerified)
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  if (!member?.organization.onboardingCompleted) {
    redirect("/onboarding");
  }

  const caps = await getCapabilities(member.organizationId);
  const capsObject = Object.fromEntries(caps);
  const orgName = member.organization.tradeName ?? member.organization.legalName;

  const orgId = member.organizationId;
  const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // próximas 72h

  const [onlinePending, openCashSession, nfeIssues, payablesDue, lowStockRows, fiscalConfig] =
    await Promise.all([
      // Pedidos online aguardando ação (confirmados/pagos, canais digitais).
      prisma.order.count({
        where: {
          organizationId: orgId,
          channel: { notIn: ["POS", "SELF_SERVICE"] },
          status: { in: ["CONFIRMED", "PAID"] },
        },
      }),
      // Caixa aberto (qualquer local do operador).
      prisma.cashSession.findFirst({
        where: { organizationId: orgId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
        select: { id: true, openedAt: true, location: { select: { name: true } } },
      }),
      // Notas rejeitadas/denegadas — exigem correção.
      prisma.invoice.count({
        where: { organizationId: orgId, status: { in: ["REJECTED", "DENIED"] } },
      }),
      // Contas a pagar vencendo (até 72h) ou vencidas.
      prisma.accountPayable.count({
        where: {
          organizationId: orgId,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          dueDate: { lte: dueSoon },
        },
      }),
      // Itens abaixo do ponto de reposição (comparação entre colunas → raw).
      prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM "StockBalance"
      WHERE "organizationId" = ${orgId}
        AND "minQuantity" IS NOT NULL
        AND "quantityOnHand" <= "minQuantity"
    `,
      prisma.fiscalConfig.findUnique({
        where: { organizationId: orgId },
        select: { environment: true, promotedAt: true },
      }),
    ]);

  const lowStock = Number(lowStockRows[0]?.count ?? 0);

  const notifications = {
    lowStock,
    onlinePending,
    nfeIssues,
    payablesDue,
    total: lowStock + onlinePending + nfeIssues + payablesDue,
  };

  // Saúde fiscal: erro se há rejeições; aviso se ainda em homologação; ok em produção.
  const fiscalLevel: "ok" | "warn" | "error" =
    nfeIssues > 0 ? "error" : fiscalConfig?.environment !== "PRODUCTION" ? "warn" : "ok";

  const cash = openCashSession
    ? {
        open: true as const,
        locationName: openCashSession.location.name,
        openedAt: openCashSession.openedAt.toISOString(),
      }
    : { open: false as const };

  const initials = getInitials(session.user.name, session.user.email);

  return (
    <CapabilitiesProvider value={capsObject}>
      <div className="flex h-screen overflow-hidden bg-background">
        <NavSidebar orgName={orgName} role={member.role} onlineBadge={onlinePending} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar
            userName={session.user.name ?? session.user.email}
            userEmail={session.user.email}
            userInitials={initials}
            cash={cash}
            notifications={notifications}
            fiscalLevel={fiscalLevel}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto h-full w-full max-w-[1680px] px-4 py-5 md:px-6 md:py-6 2xl:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CapabilitiesProvider>
  );
}
