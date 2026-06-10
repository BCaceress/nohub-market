import { prisma } from "@nohub/db";
import { Package } from "lucide-react";
import { redirect } from "next/navigation";
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
import { ImportModalButton } from "./import-modal-button";
import { NewProductDropdown } from "./new-product-dropdown";
import { ProductListClient } from "./product-list-client";

export const metadata = { title: "Produtos — NoHub Market" };

type BalanceRow = {
  id: string;
  quantityOnHand: { toString(): string };
  minQuantity: { toString(): string } | null;
  locationId: string;
  location: { id: string; name: string } | null;
};

/** Soma os saldos materializados (StockBalance) por loja → linha única por local. */
function aggregateBalancesByLocation(balances: BalanceRow[]) {
  const byLocation = new Map<
    string,
    {
      id: string;
      quantity: number;
      min: number;
      hasMin: boolean;
      location: { id: string; name: string } | null;
    }
  >();
  for (const b of balances) {
    const acc = byLocation.get(b.locationId) ?? {
      id: b.id,
      quantity: 0,
      min: 0,
      hasMin: false,
      location: b.location,
    };
    acc.quantity += Number(b.quantityOnHand);
    if (b.minQuantity != null) {
      acc.min += Number(b.minQuantity);
      acc.hasMin = true;
    }
    byLocation.set(b.locationId, acc);
  }
  return Array.from(byLocation.values()).map((e) => ({
    id: e.id,
    quantity: String(e.quantity),
    minQuantity: e.hasMin ? String(e.min) : null,
    location: e.location,
  }));
}

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
          height: p.height?.toString() ?? null,
          width: p.width?.toString() ?? null,
          length: p.length?.toString() ?? null,
          stockMin: p.stockMin?.toString() ?? null,
          stockIdeal: p.stockIdeal?.toString() ?? null,
          prices: p.prices.map((pr) => ({
            id: pr.id,
            price: pr.price.toString(),
            promoPrice: pr.promoPrice?.toString() ?? null,
            location: pr.location ? { id: pr.location.id, name: pr.location.name } : null,
          })),
          stockBalances: [],
          stockEntries: aggregateBalancesByLocation(p.stockBalances),
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
