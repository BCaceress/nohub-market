import { prisma } from "@nohub/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocationsAction } from "@/features/inventory/actions/transfer-actions";
import { TransferForm } from "@/features/inventory/components/transfer-form";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Transferência de Estoque — NoHub Market" };

export default async function TransferPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  if (member.role === "viewer") redirect("/app/inventory");

  const [locations, products] = await Promise.all([
    getLocationsAction(member.organizationId),
    prisma.product.findMany({
      where: {
        organizationId: member.organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  if (locations.length < 2) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/app/inventory"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Estoque
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Transferência</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Você precisa de pelo menos 2 locais cadastrados para realizar transferências.{" "}
          <Link href="/app/locations" className="underline">
            Cadastrar locais →
          </Link>
        </p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold tracking-tight">Transferência entre locais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mova estoque de um local para outro. A operação é atômica — ambos os saldos são
          atualizados simultaneamente ou nenhum é alterado.
        </p>
      </div>

      <TransferForm
        organizationId={member.organizationId}
        products={products}
        locations={locations}
      />
    </div>
  );
}
