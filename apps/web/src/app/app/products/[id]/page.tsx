import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { notFound, redirect } from "next/navigation";
import { getProductAction, getProductCategoriesAction } from "@/features/catalog/actions/product-actions";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { ProductWizard } from "@/features/catalog/components/product-wizard";
import { VariantEditor } from "@/features/catalog/components/variant-editor";
import { KitEditor } from "@/features/catalog/components/kit-editor";
import { TaxEditor } from "@/features/catalog/components/tax-editor";
import { ProductTabs } from "./product-tabs";
import { Badge } from "@/components/ui/badge";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [product, categories, suppliers, org, allProducts] = await Promise.all([
    getProductAction(id, member.organizationId),
    getProductCategoriesAction(member.organizationId),
    getSuppliersAction(member.organizationId),
    prisma.organization.findUnique({
      where: { id: member.organizationId },
      select: { taxRegime: true },
    }),
    // For kit component picker
    prisma.product.findMany({
      where: {
        organizationId: member.organizationId,
        deletedAt: null,
        isActive: true,
        productType: { not: "KIT" }, // RN-C04
        id: { not: id },
      },
      select: { id: true, name: true, unit: true, productType: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  if (!product) notFound();

  const isKit = product.productType === "KIT";
  const isVariant = product.productType === "VARIANT_PARENT";

  // Infer tax source label
  const taxSource =
    product.taxData.length > 0
      ? "Fiscal próprio"
      : product.category
        ? "Herdado da categoria"
        : "Não configurado";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>
        <div className="flex items-start gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <Badge variant={product.isActive ? "success" : "secondary"} className="mt-1">
            {product.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        {product.sku && (
          <p className="mt-1 text-sm text-muted-foreground">SKU: {product.sku}</p>
        )}
      </div>

      <ProductTabs
        isVariant={isVariant}
        isKit={isKit}
        variantCount={product.variants.length}
        kitCount={product.kitComponents.length}
        hasTaxData={product.taxData.length > 0}
        dadosContent={
          <ProductWizard
            organizationId={member.organizationId}
            categories={categories}
            suppliers={suppliers}
            taxRegime={org?.taxRegime ?? null}
            product={product as never}
          />
        }
        variantesContent={isVariant ? (
          <VariantEditor
            organizationId={member.organizationId}
            productId={product.id}
            variants={product.variants as never}
          />
        ) : undefined}
        kitContent={isKit ? (
          <KitEditor
            organizationId={member.organizationId}
            kitProductId={product.id}
            components={product.kitComponents as never}
            availableProducts={allProducts}
          />
        ) : undefined}
        fiscalContent={
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Fonte atual:</span>
              <Badge variant={product.taxData.length > 0 ? "success" : product.category ? "info" : "warning"}>
                {taxSource}
              </Badge>
              {product.taxData.length === 0 && product.category && (
                <span className="text-xs">(herdado de &quot;{product.category.name}&quot; — clique para sobrescrever)</span>
              )}
            </div>
            <TaxEditor
              organizationId={member.organizationId}
              productId={product.id}
              taxData={product.taxData[0] as never ?? null}
              taxRegime={org?.taxRegime ?? null}
            />
          </div>
        }
      />
    </div>
  );
}
