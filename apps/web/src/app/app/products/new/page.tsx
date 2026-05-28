import {
  generateNextSkuAction,
  getProductCategoriesAction,
} from "@/features/catalog/actions/product-actions";
import { ProductQuickCreate } from "@/features/catalog/components/product-quick-create";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Novo produto — NoHub Market" };

export default async function NewProductPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [categories, skuResult] = await Promise.all([
    getProductCategoriesAction(member.organizationId),
    generateNextSkuAction(member.organizationId),
  ]);

  return (
    <ProductQuickCreate
      organizationId={member.organizationId}
      categories={categories as never}
      initialSku={skuResult.success ? skuResult.sku : "PRD-000001"}
    />
  );
}
