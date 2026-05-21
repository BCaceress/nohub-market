import { getCategoriesAction } from "@/features/catalog/actions/category-actions";
import { getTagsAction } from "@/features/catalog/actions/tag-actions";
import { CategoryEditor } from "@/features/catalog/components/category-editor";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { ArrowLeft, FolderOpen, Info } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Categorias — NoHub Market" };

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [categories, allTags, org] = await Promise.all([
    getCategoriesAction(member.organizationId),
    getTagsAction(member.organizationId),
    prisma.organization.findUnique({
      where: { id: member.organizationId },
      select: { taxRegime: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Organize produtos e configure dados fiscais padrão por categoria.
              </p>
            </div>
          </div>

          {/* Regime fiscal badge */}
          {org?.taxRegime && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground shrink-0">
              <Info className="h-3 w-3" />
              Regime:{" "}
              <strong className="text-foreground font-medium">
                {org.taxRegime === "SIMPLES_NACIONAL"
                  ? "Simples Nacional"
                  : org.taxRegime === "MEI"
                    ? "MEI"
                    : org.taxRegime === "LUCRO_PRESUMIDO"
                      ? "Lucro Presumido"
                      : org.taxRegime === "LUCRO_REAL"
                        ? "Lucro Real"
                        : org.taxRegime}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Layout: editor principal */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Coluna principal */}
        <div className="flex flex-col gap-4">
          <CategoryEditor
            organizationId={member.organizationId}
            categories={categories as never}
            allTags={allTags.map((t) => ({
              id: t.id,
              name: t.name,
              group: t.group,
              color: t.color,
            }))}
            taxRegime={org?.taxRegime ?? null}
          />
        </div>

        {/* Coluna de dicas */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold">Como funcionam</p>
            <ul className="flex flex-col gap-2.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                Cada categoria pode ter um ícone e cor para identificação rápida.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                Subcategorias herdam o ícone da categoria pai automaticamente.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                Configure o fiscal padrão (NCM, ICMS, PIS, COFINS) para aplicar automaticamente aos
                produtos sem configuração própria.
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                Produtos com fiscal próprio ignoram o padrão da categoria (RN-C13).
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
            <p className="text-sm font-semibold">Estrutura</p>
            <p className="text-xs text-muted-foreground">
              Organize em até dois níveis: <strong>Categoria → Subcategoria</strong>. Categorias com
              subcategorias não aceitam mais subdivisões.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
