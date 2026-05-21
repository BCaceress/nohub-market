import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getProductCategoriesAction,
  getProductsAction,
} from "@/features/catalog/actions/product-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { Download, FolderOpen, Package, Plus, Tag } from "lucide-react";
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

  const isFiltered = !!(sp.search || sp.categoryId || sp.productType);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Produtos</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              {isFiltered ? (
                <>
                  <span className="font-medium text-foreground">{total}</span> resultado
                  {total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{total}</span> produto
                  {total !== 1 ? "s" : ""} cadastrado{total !== 1 ? "s" : ""}
                </>
              )}
            </p>
            {categories.length > 0 && (
              <>
                <span className="text-border text-xs">•</span>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{categories.length}</span> categoria
                  {categories.length !== 1 ? "s" : ""}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/products/tags">
              <Tag className="h-4 w-4" />
              Tags
            </Link>
          </Button>
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
          <Button asChild size="sm">
            <Link href="/app/products/new">
              <Plus className="h-4 w-4" />
              Novo produto
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat chips — apenas quando sem filtro ativo */}
      {!isFiltered && total > 0 && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { type: "SIMPLE", label: "Simples", variant: "secondary" },
              { type: "VARIANT_PARENT", label: "Variantes", variant: "info" },
              { type: "KIT", label: "Kit/Combo", variant: "warning" },
              { type: "FRACTIONED", label: "Fracionado", variant: "success" },
            ] as const
          ).map(({ type, label, variant }) => {
            const count = products.filter((p) => p.productType === type).length;
            if (count === 0) return null;
            return (
              <Badge key={type} variant={variant} className="gap-1.5 text-xs px-2.5 py-1">
                <Package className="h-3 w-3" />
                {label}: {count}
              </Badge>
            );
          })}
        </div>
      )}

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
