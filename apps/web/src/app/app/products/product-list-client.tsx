"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableEmpty,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, ChevronLeft, ChevronRight, Package,
  Pencil, Layers, GitBranch, Scissors,
} from "lucide-react";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: "secondary" | "info" | "warning" | "success" }> = {
  SIMPLE:         { label: "Simples",   icon: <Package className="h-3 w-3" />,    variant: "secondary" },
  VARIANT_PARENT: { label: "Variantes", icon: <GitBranch className="h-3 w-3" />,  variant: "info" },
  KIT:            { label: "Kit/Combo", icon: <Layers className="h-3 w-3" />,     variant: "warning" },
  FRACTIONED:     { label: "Fracionado",icon: <Scissors className="h-3 w-3" />,   variant: "success" },
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
  products, categories, total, page, take,
  defaultSearch = "", defaultCategoryId = "", defaultProductType = "",
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

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const totalPages = Math.ceil(total / take);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar nome, SKU, código…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>

        <select
          value={searchParams.get("categoryId") ?? ""}
          onChange={(e) => updateParam("categoryId", e.target.value)}
          className="flex h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={searchParams.get("productType") ?? ""}
          onChange={(e) => updateParam("productType", e.target.value)}
          className="flex h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <option value="">Todos os tipos</option>
          <option value="SIMPLE">Simples</option>
          <option value="VARIANT_PARENT">Com variantes</option>
          <option value="KIT">Kit / Combo</option>
          <option value="FRACTIONED">Fracionado</option>
        </select>

        <span className="flex items-center text-sm text-muted-foreground ml-auto">
          {total} produto{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Preço base</TableHead>
            <TableHead>Fiscal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableEmpty
              icon={<Package className="h-5 w-5 text-muted-foreground" />}
              title="Nenhum produto encontrado"
              description="Crie seu primeiro produto ou importe de um template fiscal."
              action={
                <Button asChild size="sm">
                  <Link href="/app/products/new">
                    <Package className="h-3.5 w-3.5" />
                    Criar produto
                  </Link>
                </Button>
              }
            />
          ) : (
            products.map((p) => {
              const cfg = TYPE_CONFIG[p.productType] ?? TYPE_CONFIG.SIMPLE!;
              const hasTax = p._count.taxData > 0;
              const price = Number(p.price.toString());

              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <div className="flex gap-2 mt-0.5 text-xs text-muted-foreground">
                        {p.sku && <span>SKU: {p.sku}</span>}
                        {p.brand && <span>{p.brand}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cfg.variant} className="gap-1">
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
                  <TableCell className="text-right font-mono text-sm">
                    {price > 0
                      ? price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : <span className="text-muted-foreground text-xs">Sem preço</span>}
                  </TableCell>
                  <TableCell>
                    {hasTax ? (
                      <Badge variant="success">Fiscal OK</Badge>
                    ) : (
                      <Badge variant="warning">Sem fiscal</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "secondary"}>
                      {p.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild className="h-7 w-7">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
