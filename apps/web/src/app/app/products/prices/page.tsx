import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { getProductPricesAction } from "@/features/catalog/actions/price-actions";
import { PriceMatrix } from "@/features/catalog/components/price-matrix";

export default async function PricesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [prices, products, locations] = await Promise.all([
    getProductPricesAction(member.organizationId),
    prisma.product.findMany({
      where: { organizationId: member.organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.location.findMany({
      where: { organizationId: member.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Matriz de preços</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie preços por canal, unidade e promoção. A resolução em cascata busca do mais específico ao mais geral (RN-C08).
        </p>
      </div>

      <PriceMatrix
        organizationId={member.organizationId}
        prices={prices as never}
        products={products}
        locations={locations}
      />
    </div>
  );
}
