import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getProductCategoriesAction,
  getProductsAction,
} from "@/features/catalog/actions/product-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { Download, Filter, FolderOpen, Package, Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductListClient } from "./product-list-client";

export const metadata = { title: "Produtos — NoHub Market" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    productType?: string;
    page?: string;
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

  const [{ total, products }, categories] = await Promise.all([
    getProductsAction(member.organizationId, {
      search: sp.search,
      categoryId: sp.categoryId,
      productType: sp.productType,
      take,
      skip: (page - 1) * take,
    }),
    getProductCategoriesAction(member.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} produto{total !== 1 ? "s" : ""} cadastrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/products/categories">
              <FolderOpen className="h-4 w-4" />
              Categorias
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/products/import">
              <Download className="h-4 w-4" />
              Importar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/app/products/new">
              <Plus className="h-4 w-4" />
              Novo produto
            </Link>
          </Button>
        </div>
      </div>

      <ProductListClient
        products={products.map((p) => ({
          ...p,
          price: p.price.toString(),
          costPrice: p.costPrice?.toString() ?? null,
          conversionFactor: p.conversionFactor.toString(),
          weight: p.weight?.toString() ?? null,
        }))}
        categories={categories}
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
