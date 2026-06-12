import { prisma } from "@nohub/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getKitComponentOptionsAction } from "@/features/catalog/actions/kit-product-actions";
import { getOptionGroupsAction } from "@/features/catalog/actions/option-group-actions";
import { listProductPackagesAction } from "@/features/catalog/actions/package-actions";
import {
  getProductAction,
  getProductCategoriesAction,
} from "@/features/catalog/actions/product-actions";
import { CustomProductForm } from "@/features/catalog/components/custom-product-form";
import { KitProductForm } from "@/features/catalog/components/kit-product-form";
import { OptionGroupEditor } from "@/features/catalog/components/option-group-editor";
import { ProductQuickCreate } from "@/features/catalog/components/product-quick-create";
import { VariantEditor } from "@/features/catalog/components/variant-editor";
import { listProductSuppliersAction } from "@/features/purchasing/actions/purchasing-actions";
import { ProductSuppliersManager } from "@/features/purchasing/components/product-suppliers-manager";
import { getSession } from "@/lib/auth-server";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [product, categories, suppliers, org, allProducts, packages, productSuppliers] =
    await Promise.all([
      getProductAction(id, member.organizationId),
      getProductCategoriesAction(member.organizationId),
      getSuppliersAction(member.organizationId),
      prisma.organization.findUnique({
        where: { id: member.organizationId },
        select: { taxRegime: true },
      }),
      // Componentes de kit/personalizado só podem ser produtos do cadastro simples
      prisma.product.findMany({
        where: {
          organizationId: member.organizationId,
          deletedAt: null,
          isActive: true,
          productType: { in: ["SIMPLE", "FRACTIONED"] }, // RN-C04 + insumos reais
          id: { not: id },
        },
        select: { id: true, name: true, sku: true, unit: true, productType: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
      listProductPackagesAction(member.organizationId, id),
      listProductSuppliersAction(id),
    ]);

  if (!product) notFound();

  const isKit = product.productType === "KIT";
  const isCustom = product.productType === "CUSTOM";
  const isVariant = product.productType === "VARIANT_PARENT";

  // Grupos de opção só fazem sentido em produto CUSTOM
  const optionGroups = isCustom
    ? await getOptionGroupsAction(product.id, member.organizationId)
    : [];

  // Personalizado tem tela própria (cadastro/edição unificado)
  if (isCustom) {
    return (
      <>
        <OverviewLink id={id} />
        <CustomProductForm
          organizationId={member.organizationId}
          availableProducts={allProducts.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
          }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            price: Number(product.price),
            isActive: product.isActive,
            categoryId: product.categoryId,
            sku: product.sku,
            imageUrl: product.imageUrl,
            fixedComponents: product.kitComponents.map((c) => ({
              componentProductId: c.componentProductId,
              quantity: Number(c.quantity),
            })),
            groups: optionGroups.map((g) => ({
              name: g.name,
              unit: g.unit,
              required: g.required,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              options: g.options.map((o) => ({
                name: o.name,
                componentProductId: o.componentProductId,
                quantity: Number(o.quantity),
                priceDelta: Number(o.priceDelta),
                isDefault: o.isDefault,
              })),
            })),
          }}
        />
      </>
    );
  }

  // Kit/Combo tem tela própria — composição em tabela, custo/margem e estoque calculado
  if (isKit) {
    const availableProducts = await getKitComponentOptionsAction(member.organizationId, product.id);
    return (
      <>
        <OverviewLink id={id} />
        <KitProductForm
          organizationId={member.organizationId}
          availableProducts={availableProducts}
          categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))}
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            sku: product.sku,
            price: Number(product.price),
            isActive: product.isActive,
            categoryId: product.categoryId,
            imageUrl: product.imageUrl,
            components: product.kitComponents.map((c) => ({
              componentProductId: c.componentProductId,
              quantity: Number(c.quantity),
            })),
          }}
        />
      </>
    );
  }

  // Abas extras só quando fazem sentido — fiscal/embalagens já vivem dentro do
  // ProductQuickCreate, então nada de aba-sobre-aba nem informação duplicada.
  const extraTabs: { value: string; label: string; badge?: number; content: ReactNode }[] = [];
  if (isVariant) {
    extraTabs.push({
      value: "variantes",
      label: "Variantes",
      badge: product.variants.length || undefined,
      content: (
        <VariantEditor
          organizationId={member.organizationId}
          productId={product.id}
          variants={product.variants as never}
        />
      ),
    });
  }
  if (isCustom) {
    extraTabs.push({
      value: "opcoes",
      label: "Opções",
      badge: optionGroups.length || undefined,
      content: (
        <OptionGroupEditor
          organizationId={member.organizationId}
          productId={product.id}
          groups={optionGroups as never}
          availableProducts={allProducts}
        />
      ),
    });
  }

  return (
    <>
      <OverviewLink id={id} />
      <ProductQuickCreate
        organizationId={member.organizationId}
        categories={categories as never}
        suppliers={suppliers}
        taxRegime={org?.taxRegime ?? null}
        product={product as never}
        initialPackages={packages}
        extraTabs={extraTabs}
      />

      {/* Seção sempre visível — não escondida atrás de aba (RN-P12) */}
      <section className="mx-auto mt-10 flex w-full max-w-7xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fornecedores
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>
        <ProductSuppliersManager
          productId={product.id}
          suppliers={suppliers as never}
          initialMappings={productSuppliers}
        />
      </section>
    </>
  );
}

function OverviewLink({ id }: { id: string }) {
  return (
    <div className="flex justify-end mb-2 px-1">
      <Link
        href={`/app/products/${id}/overview`}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
      >
        Ver detalhes / histórico →
      </Link>
    </div>
  );
}
