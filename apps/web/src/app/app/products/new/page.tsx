import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getKitComponentOptionsAction } from "@/features/catalog/actions/kit-product-actions";
import {
  generateNextSkuAction,
  getProductCategoriesAction,
} from "@/features/catalog/actions/product-actions";
import { CustomProductForm } from "@/features/catalog/components/custom-product-form";
import { KitProductForm } from "@/features/catalog/components/kit-product-form";
import { ProductQuickCreate } from "@/features/catalog/components/product-quick-create";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Novo produto — NoHub Market" };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; kind?: string }>;
}) {
  const { type, kind } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  // Personalizado tem tela própria — sem busca por código de barras
  if (type === "CUSTOM") {
    const [categories, availableProducts] = await Promise.all([
      getProductCategoriesAction(member.organizationId),
      prisma.product.findMany({
        where: {
          organizationId: member.organizationId,
          deletedAt: null,
          isActive: true,
          productType: { in: ["SIMPLE", "FRACTIONED"] },
        },
        select: { id: true, name: true, sku: true, unit: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
    ]);
    return (
      <CustomProductForm
        organizationId={member.organizationId}
        availableProducts={availableProducts}
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}
      />
    );
  }

  // Kit/Combo tem tela própria — composição em tabela, custo/margem e estoque calculado
  if (type === "KIT") {
    const [categories, availableProducts] = await Promise.all([
      getProductCategoriesAction(member.organizationId),
      getKitComponentOptionsAction(member.organizationId),
    ]);
    return (
      <KitProductForm
        organizationId={member.organizationId}
        availableProducts={availableProducts}
        categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}
        initialKind={kind === "RECIPE" ? "RECIPE" : "COMBO"}
      />
    );
  }

  const [categories, skuResult, suppliers, org] = await Promise.all([
    getProductCategoriesAction(member.organizationId),
    generateNextSkuAction(member.organizationId),
    getSuppliersAction(member.organizationId),
    prisma.organization.findUnique({
      where: { id: member.organizationId },
      select: { taxRegime: true },
    }),
  ]);

  return (
    <ProductQuickCreate
      organizationId={member.organizationId}
      categories={categories as never}
      initialSku={skuResult.success ? skuResult.sku : "PRD-000001"}
      initialType={type}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      taxRegime={org?.taxRegime ?? null}
    />
  );
}
