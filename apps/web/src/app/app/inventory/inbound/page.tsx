import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { getLocationsAction } from "@/features/inventory/actions/transfer-actions";
import { InboundForm } from "@/features/inventory/components/inbound-form";

export const metadata = { title: "Entrada de Estoque — NoHub Market" };

export default async function InboundPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [locations, products] = await Promise.all([
    getLocationsAction(member.organizationId),
    prisma.product.findMany({
      where: {
        organizationId: member.organizationId,
        deletedAt: null,
        isActive: true,
        productType: { in: ["SIMPLE", "FRACTIONED"] },
      },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
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
        <h1 className="text-2xl font-bold tracking-tight">Entrada manual</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre recebimento de mercadorias, devoluções ou saldo inicial.
        </p>
      </div>

      <InboundForm
        organizationId={member.organizationId}
        products={products}
        locations={locations}
      />
    </div>
  );
}
