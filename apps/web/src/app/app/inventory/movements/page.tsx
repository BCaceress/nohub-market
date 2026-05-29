import { prisma } from "@nohub/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMovementsAction } from "@/features/inventory/actions/inventory-actions";
import { getLocationsAction } from "@/features/inventory/actions/transfer-actions";
import { MovementLogExtended } from "@/features/inventory/components/movement-log-extended";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Movimentações — NoHub Market" };

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const take = 50;
  const skip = (page - 1) * take;

  const [{ total, movements }, locations] = await Promise.all([
    getMovementsAction(member.organizationId, {
      locationId: sp.locationId,
      type: sp.type,
      take,
      skip,
    }),
    getLocationsAction(member.organizationId),
  ]);

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
        <h1 className="text-2xl font-bold tracking-tight">Movimentações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Extrato completo e imutável de todas as movimentações de estoque.
        </p>
      </div>

      <MovementLogExtended
        movements={movements as never}
        locations={locations}
        total={total}
        page={page}
        take={take}
      />
    </div>
  );
}
