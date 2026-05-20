import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { getCategoriesAction } from "@/features/catalog/actions/category-actions";
import { CategoryEditor } from "@/features/catalog/components/category-editor";

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

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organize seus produtos e defina dados fiscais padrão herdados por categoria.
        </p>
      </div>

      <CategoryEditor
        organizationId={member.organizationId}
        categories={categories as never}
        taxRegime={org?.taxRegime ?? null}
      />
    </div>
  );
}
