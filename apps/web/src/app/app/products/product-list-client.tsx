"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Layers,
  Package,
  Pencil,
  Scissors,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const TYPE_FILTERS = [
  { value: "", label: "Todos" },
  {
    value: "SIMPLE",
    label: "Simples",
    icon: <Package className="h-3 w-3" />,
    variant: "secondary" as const,
  },
  {
    value: "VARIANT_PARENT",
    label: "Variantes",
    icon: <GitBranch className="h-3 w-3" />,
    variant: "info" as const,
  },
  {
    value: "KIT",
    label: "Kit/Combo",
    icon: <Layers className="h-3 w-3" />,
    variant: "warning" as const,
  },
  {
    value: "FRACTIONED",
    label: "Fracionado",
    icon: <Scissors className="h-3 w-3" />,
    variant: "success" as const,
  },
] as const;

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    variant: "secondary" | "info" | "warning" | "success";
  }
> = {
  SIMPLE: { label: "Simples", icon: <Package className="h-3 w-3" />, variant: "secondary" },
  VARIANT_PARENT: {
    label: "Variantes",
    icon: <GitBranch className="h-3 w-3" />,
    variant: "info",
  },
  KIT: { label: "Kit/Combo", icon: <Layers className="h-3 w-3" />, variant: "warning" },
  FRACTIONED: {
    label: "Fracionado",
    icon: <Scissors className="h-3 w-3" />,
    variant: "success",
  },
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  productType: string;
  price: { toString(): string };
  isActive: boolean;
  category: { id: string; name: string } | null;
  _count: { variants: number; taxData: number };
};

type Category = { id: string; name: string; parentId: string | null };

interface Props {
  products: Product[];
  categories: Category[];
  total: number;
  page: number;
  take: number;
  defaultSearch?: string;
  defaultCategoryId?: string;
  defaultProductType?: string;
}

export function ProductListClient({
  products,
  categories,
  total,
  page,
  take,
  defaultSearch = "",
  defaultCategoryId = "",
  defaultProductType = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(defaultSearch);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    value ? params.set(key, value) : params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam("search", searchInput);
  }

  function clearSearch() {
    setSearchInput("");
    updateParam("search", "");
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const totalPages = Math.ceil(total / take);
  const activeType = searchParams.get("productType") ?? "";
  const activeCategoryId = searchParams.get("categoryId") ?? "";
  const activeSearch = searchParams.get("search") ?? "";
  const hasFilters = !!(activeType || activeCategoryId || activeSearch);

  // Separar raízes e subs para o select de categorias
  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
        {/* Linha 1: busca + filtro categoria */}
        <div className="flex flex-wrap gap-2">
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9 h-9"
              placeholder="Buscar por nome, SKU, código de barras…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <select
            value={activeCategoryId}
            onChange={(e) => updateParam("categoryId", e.target.value)}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 min-w-[160px]"
          >
            <option value="">Todas as categorias</option>
            {rootCategories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name}</option>
                {subCategories
                  .filter((s) => s.parentId === c.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {"  "}↳ {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
            {/* Categorias sem pai nem filhas no grupo */}
            {categories
              .filter(
                (c) =>
                  !c.parentId &&
                  !subCategories.some((s) => s.parentId === c.id) &&
                  !rootCategories.some((r) => r.id === c.id),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        {/* Linha 2: filtro por tipo (pills) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateParam("productType", f.value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeType === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {"icon" in f && f.icon}
              {f.label}
            </button>
          ))}

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                const params = new URLSearchParams();
                startTransition(() => router.push(pathname));
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-auto"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-semibold">Produto</TableHead>
              <TableHead className="font-semibold">Tipo</TableHead>
              <TableHead className="font-semibold">Categoria</TableHead>
              <TableHead className="text-right font-semibold">Preço base</TableHead>
              <TableHead className="font-semibold">Fiscal</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableEmpty
                icon={<Package className="h-5 w-5 text-muted-foreground" />}
                title={hasFilters ? "Nenhum produto encontrado" : "Catálogo vazio"}
                description={
                  hasFilters
                    ? "Tente ajustar os filtros de busca."
                    : "Crie seu primeiro produto ou importe de um template fiscal."
                }
                action={
                  !hasFilters ? (
                    <Button asChild size="sm">
                      <Link href="/app/products/new">
                        <Package className="h-3.5 w-3.5" />
                        Criar produto
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              products.map((p) => {
                const cfg =
                  TYPE_CONFIG[p.productType] ??
                  (TYPE_CONFIG.SIMPLE as NonNullable<typeof TYPE_CONFIG.SIMPLE>);
                const hasTax = p._count.taxData > 0;
                const price = Number(p.price.toString());

                return (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm leading-snug">{p.name}</p>
                        <div className="flex gap-2.5 mt-0.5 text-xs text-muted-foreground">
                          {p.sku && <span className="font-mono">SKU: {p.sku}</span>}
                          {p.barcode && <span className="font-mono opacity-70">{p.barcode}</span>}
                          {p.brand && <span>{p.brand}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="gap-1 whitespace-nowrap">
                        {cfg.icon}
                        {cfg.label}
                        {p._count.variants > 0 && (
                          <span className="opacity-70">({p._count.variants})</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.category ? (
                        <span className="text-sm">{p.category.name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {price > 0 ? (
                        <span className="font-mono text-sm font-medium">
                          {price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem preço</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasTax ? (
                        <Badge variant="success" className="text-xs">
                          Fiscal OK
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">
                          Sem fiscal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "success" : "secondary"} className="text-xs">
                        {p.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Link href={`/app/products/${p.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages} · {total} produto{total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
