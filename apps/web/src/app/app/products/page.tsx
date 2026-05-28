import { PageHeader } from "@/components/page-header";
import { getLocationsAction } from "@/features/app/actions/location-actions";
import {
  getProductCategoriesAction,
  getProductsAction,
} from "@/features/catalog/actions/product-actions";
import { getFiscalTemplatesAction } from "@/features/catalog/actions/tax-actions";
import { BrandSheetTrigger } from "@/features/catalog/components/brand-sheet";
import { CategorySheetTrigger } from "@/features/catalog/components/category-sheet";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { Package } from "lucide-react";
import { redirect } from "next/navigation";
import { ImportModalButton } from "./import-modal-button";
import { NewProductDropdown } from "./new-product-dropdown";
import { ProductListClient } from "./product-list-client";

export const metadata = { title: "Produtos — NoHub Market" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    productType?: string;
    locationId?: string;
    page?: string;
    status?: string;
    noFiscal?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10));
  const take = 50;

  const isActive = sp.status === "inactive" ? false : sp.status === "active" ? true : undefined;

  const [{ total, products }, categories, templates, locations] = await Promise.all([
    getProductsAction(member.organizationId, {
      search: sp.search,
      categoryId: sp.categoryId,
      productType: sp.productType,
      locationId: sp.locationId,
      isActive,
      noFiscal: sp.noFiscal === "1",
      take,
      skip: (page - 1) * take,
    }),
    getProductCategoriesAction(member.organizationId),
    getFiscalTemplatesAction(),
    getLocationsAction(member.organizationId),
  ]);

  const isFiltered = !!(
    sp.search ||
    sp.categoryId ||
    sp.productType ||
    sp.locationId ||
    sp.status ||
    sp.noFiscal
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        icon={<Package className="h-5 w-5" />}
        iconTone="primary"
        title="Catálogo de produtos"
        description={
          isFiltered
            ? `${total} resultado${total !== 1 ? "s" : ""} para o filtro atual.`
            : `${total} produto${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""} · ${categories.length} categoria${categories.length !== 1 ? "s" : ""}.`
        }
        actions={
          <>
            <CategorySheetTrigger organizationId={member.organizationId} />
            <BrandSheetTrigger organizationId={member.organizationId} />
            <div className="w-px h-4 bg-border self-center shrink-0" />
            <ImportModalButton organizationId={member.organizationId} templates={templates} />
            <NewProductDropdown />
          </>
        }
      />

      <ProductListClient
        organizationId={member.organizationId}
        products={products.map((p) => ({
          ...p,
          price: p.price.toString(),
          costPrice: p.costPrice?.toString() ?? null,
          conversionFactor: p.conversionFactor.toString(),
          weight: p.weight?.toString() ?? null,
          prices: p.prices.map((pr) => ({
            id: pr.id,
            price: pr.price.toString(),
            promoPrice: pr.promoPrice?.toString() ?? null,
            location: pr.location ? { id: pr.location.id, name: pr.location.name } : null,
          })),
          stockEntries: p.stockEntries.map((se) => ({
            id: se.id,
            quantity: se.quantity.toString(),
            minQuantity: se.minQuantity?.toString() ?? null,
            location: se.location ? { id: se.location.id, name: se.location.name } : null,
          })),
        }))}
        categories={categories}
        locations={locations
          .filter((l) => l.type !== "DC")
          .map((l) => ({ id: l.id, name: l.name }))}
        total={total}
        page={page}
        take={take}
        defaultSearch={sp.search}
        defaultCategoryId={sp.categoryId}
        defaultProductType={sp.productType}
      />
    </div>
  );
}
