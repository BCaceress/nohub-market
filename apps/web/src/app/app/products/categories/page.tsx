import { getCategoriesAction } from "@/features/catalog/actions/category-actions";
import { CategoriesPageClient } from "@/features/catalog/components/categories-page-client";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Categorias — NoHub Market" };

const TAX_REGIME_LABELS: Record<string, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  MEI: "MEI",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
};

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [categories, org] = await Promise.all([
    getCategoriesAction(member.organizationId),
    prisma.organization.findUnique({
      where: { id: member.organizationId },
      select: { taxRegime: true },
    }),
  ]);

  const regimeLabel = org?.taxRegime ? (TAX_REGIME_LABELS[org.taxRegime] ?? org.taxRegime) : null;

  return (
    <CategoriesPageClient
      organizationId={member.organizationId}
      categories={categories as never}
      taxRegime={org?.taxRegime ?? null}
      regimeLabel={regimeLabel}
    />
  );
}
