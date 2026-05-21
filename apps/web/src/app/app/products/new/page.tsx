import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getProductCategoriesAction } from "@/features/catalog/actions/product-actions";
import { getTagsAction } from "@/features/catalog/actions/tag-actions";
import { ProductWizard } from "@/features/catalog/components/product-wizard";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { GitBranch, Layers, Package, Scissors } from "lucide-react";
import { redirect } from "next/navigation";

export const metadata = { title: "Novo produto — NoHub Market" };

type ProductTypeMeta = { label: string; desc: string; icon: React.ReactNode };
const TYPE_META = {
  SIMPLE: {
    label: "Produto Simples",
    desc: "Preencha os dados ou use a câmera para ler o código de barras e auto-completar.",
    icon: <Package className="h-5 w-5" />,
  },
  KIT: {
    label: "Kit / Combo",
    desc: "Crie um conjunto de produtos vendidos juntos. Após salvar, adicione os componentes.",
    icon: <Layers className="h-5 w-5 text-amber-500" />,
  },
  FRACTIONED: {
    label: "Produto Fracionado",
    desc: "Produto vendido por peso ou volume. Configure o fator de conversão abaixo.",
    icon: <Scissors className="h-5 w-5 text-green-500" />,
  },
  VARIANT_PARENT: {
    label: "Produto com Variantes",
    desc: "Após salvar, adicione as variações (tamanho, sabor, cor…) na aba Variantes.",
    icon: <GitBranch className="h-5 w-5 text-blue-500" />,
  },
} satisfies Record<string, ProductTypeMeta>;

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [categories, suppliers, allTags, org] = await Promise.all([
    getProductCategoriesAction(member.organizationId),
    getSuppliersAction(member.organizationId),
    getTagsAction(member.organizationId),
    prisma.organization.findUnique({
      where: { id: member.organizationId },
      select: { taxRegime: true },
    }),
  ]);

  const validTypes = ["SIMPLE", "KIT", "FRACTIONED", "VARIANT_PARENT"] as const;
  type ValidType = keyof typeof TYPE_META;
  const defaultType: ValidType = (validTypes as readonly string[]).includes(sp.type ?? "")
    ? (sp.type as ValidType)
    : "SIMPLE";
  const meta: ProductTypeMeta = TYPE_META[defaultType];

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          {meta.icon}
          <h1 className="text-2xl font-bold tracking-tight">{meta.label}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
      </div>
      <ProductWizard
        organizationId={member.organizationId}
        categories={categories as never}
        suppliers={suppliers}
        allTags={allTags.map((t) => ({
          id: t.id,
          name: t.name,
          group: t.group,
          color: t.color,
          scope: t.scope as "SUBCATEGORY" | "PRODUCT",
        }))}
        taxRegime={org?.taxRegime ?? null}
        defaultType={defaultType}
      />
    </div>
  );
}
