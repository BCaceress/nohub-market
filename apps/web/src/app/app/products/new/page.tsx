import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { getProductCategoriesAction } from "@/features/catalog/actions/product-actions";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { ProductWizard } from "@/features/catalog/components/product-wizard";

export const metadata = { title: "Novo produto — NoHub Market" };

export default async function NewProductPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [categories, suppliers, org] = await Promise.all([
    getProductCategoriesAction(member.organizationId),
    getSuppliersAction(member.organizationId),
    prisma.organization.findUnique({
      where: { id: member.organizationId },
      select: { taxRegime: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo produto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados do produto. Use a busca inteligente para preencher com código de barras.
        </p>
      </div>
      <ProductWizard
        organizationId={member.organizationId}
        categories={categories}
        suppliers={suppliers}
        taxRegime={org?.taxRegime ?? null}
      />
    </div>
  );
}
