"use client";

import {
  AlertTriangle,
  Barcode,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  GitBranch,
  Hash,
  ImageOff,
  Layers,
  MoreVertical,
  Package,
  Pencil,
  Power,
  PowerOff,
  Scissors,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { setProductActiveAction } from "@/features/catalog/actions/product-actions";

type TypeConfigEntry = {
  label: string;
  icon: React.ReactNode;
  variant: "secondary" | "info" | "warning" | "success";
};

const TYPE_CONFIG = {
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
  CUSTOM: {
    label: "Personalizado",
    icon: <SlidersHorizontal className="h-3 w-3" />,
    variant: "info",
  },
} satisfies Record<string, TypeConfigEntry>;

type LocationPrice = {
  id: string;
  price: string;
  promoPrice: string | null;
  location: { id: string; name: string } | null;
};

type LocationStock = {
  id: string;
  quantity: string;
  minQuantity: string | null;
  location: { id: string; name: string } | null;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  productType: string;
  price: { toString(): string };
  costPrice: string | null;
  imageUrl: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  prices: LocationPrice[];
  stockEntries: LocationStock[];
  taxData: { ncm: string; cest: string | null }[];
  _count: { variants: number; taxData: number; prices: number };
};

type Category = { id: string; name: string; parentId: string | null };
type Location = { id: string; name: string };

interface Props {
  organizationId: string;
  products: Product[];
  categories: Category[];
  locations: Location[];
  total: number;
  page: number;
  take: number;
  defaultSearch?: string;
  defaultCategoryId?: string;
  defaultProductType?: string;
}

export function ProductListClient({
  organizationId,
  products,
  categories,
  locations,
  total,
  page,
  take,
  defaultSearch = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(defaultSearch);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Product | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedSearch = useRef(defaultSearch);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Global '/' shortcut → focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function toggleParam(key: string, on: boolean) {
    updateParam(key, on ? "1" : "");
  }

  function setStatus(val: "" | "active" | "inactive") {
    updateParam("status", val);
  }

  function submitSearch(val: string) {
    if (lastSubmittedSearch.current === val) return;
    lastSubmittedSearch.current = val;
    updateParam("search", val);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    submitSearch(searchInput);
  }

  function onSearchChange(v: string) {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => submitSearch(v), 350);
  }

  function clearSearch() {
    setSearchInput("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    submitSearch("");
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  async function setActive(p: Product, next: boolean) {
    const res = await setProductActiveAction(organizationId, p.id, next);
    if (res.success) {
      toast.success(next ? "Produto ativado." : "Produto inativado.");
      startTransition(() => router.refresh());
    } else {
      toast.error(res.error);
    }
  }

  async function confirmDeactivation() {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    try {
      await setActive(confirmDeactivate, false);
      setConfirmDeactivate(null);
    } finally {
      setDeactivating(false);
    }
  }

  const totalPages = Math.ceil(total / take);
  const activeType = searchParams.get("productType") ?? "";
  const activeCategoryId = searchParams.get("categoryId") ?? "";
  const activeLocationId = searchParams.get("locationId") ?? "";
  const activeSearch = searchParams.get("search") ?? "";
  const activeStatus = searchParams.get("status") ?? "";
  const activeNoFiscal = searchParams.get("noFiscal") === "1";
  const locationLabel = locations.find((l) => l.id === activeLocationId)?.name ?? activeLocationId;
  const hasFilters = !!(
    activeType ||
    activeCategoryId ||
    activeLocationId ||
    activeSearch ||
    activeStatus ||
    activeNoFiscal
  );

  function clearAll() {
    setSearchInput("");
    lastSubmittedSearch.current = "";
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => router.push(pathname));
  }

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId);

  const defaultTypeOption = { value: "", label: "Todos os tipos", icon: null };
  const typeOptions: Array<{ value: string; label: string; icon: React.ReactNode | null }> = [
    defaultTypeOption,
    { value: "SIMPLE", label: TYPE_CONFIG.SIMPLE.label, icon: TYPE_CONFIG.SIMPLE.icon },
    { value: "KIT", label: TYPE_CONFIG.KIT.label, icon: TYPE_CONFIG.KIT.icon },
    { value: "FRACTIONED", label: TYPE_CONFIG.FRACTIONED.label, icon: TYPE_CONFIG.FRACTIONED.icon },
    { value: "CUSTOM", label: TYPE_CONFIG.CUSTOM.label, icon: TYPE_CONFIG.CUSTOM.icon },
  ];
  const activeTypeOption = typeOptions.find((o) => o.value === activeType) ?? defaultTypeOption;

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const categoryLabel = activeCategory?.name ?? "Todas as categorias";

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      {/* Toolbar — single row */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-55">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="pl-9 pr-14 h-9"
            placeholder="Buscar nome, SKU, código…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchInput ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              /
            </kbd>
          )}
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-w-37.5 cursor-pointer justify-between gap-2 px-3 font-normal"
            >
              <span className="inline-flex items-center gap-1.5">
                {activeTypeOption.icon}
                {activeTypeOption.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-45">
            {typeOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value || "all"}
                onSelect={() => updateParam("productType", opt.value)}
                className="cursor-pointer gap-2 text-sm"
              >
                {opt.icon ?? <span className="h-3 w-3" />}
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-w-45 cursor-pointer justify-between gap-2 px-3 font-normal"
            >
              <span className="truncate">{categoryLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60 max-h-90 overflow-y-auto">
            <DropdownMenuItem
              onSelect={() => updateParam("categoryId", "")}
              className="cursor-pointer text-sm text-muted-foreground"
            >
              Todas as categorias
            </DropdownMenuItem>
            {rootCategories.map((root) => {
              const subs = subCategories.filter((s) => s.parentId === root.id);
              return (
                <div
                  key={root.id}
                  className="border-t border-border pt-1 mt-1 first:border-t-0 first:mt-0 first:pt-0"
                >
                  <DropdownMenuItem
                    onSelect={() => updateParam("categoryId", root.id)}
                    className="cursor-pointer text-sm font-semibold"
                  >
                    {root.name}
                  </DropdownMenuItem>
                  {subs.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={() => updateParam("categoryId", s.id)}
                      className="cursor-pointer text-sm pl-6"
                    >
                      <span className="text-muted-foreground mr-1">↳</span>
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-1.5">
          <QuickToggle
            active={activeStatus === "inactive"}
            onToggle={() => setStatus(activeStatus === "inactive" ? "" : "inactive")}
            icon={<PowerOff className="h-3.5 w-3.5" />}
            label="Inativos"
            tone="muted"
          />
          <QuickToggle
            active={activeNoFiscal}
            onToggle={() => toggleParam("noFiscal", !activeNoFiscal)}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Sem fiscal"
            tone="warning"
          />
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5 -mt-1">
          {activeSearch && <FilterChip label={`Busca: ${activeSearch}`} onRemove={clearSearch} />}
          {activeType && (
            <FilterChip
              label={`Tipo: ${activeTypeOption.label}`}
              onRemove={() => updateParam("productType", "")}
            />
          )}
          {activeCategoryId && (
            <FilterChip
              label={`Categoria: ${categoryLabel}`}
              onRemove={() => updateParam("categoryId", "")}
            />
          )}
          {activeLocationId && (
            <FilterChip
              label={`Loja: ${locationLabel}`}
              onRemove={() => updateParam("locationId", "")}
            />
          )}
          {activeStatus && (
            <FilterChip
              label={activeStatus === "inactive" ? "Inativos" : "Ativos"}
              onRemove={() => setStatus("")}
            />
          )}
          {activeNoFiscal && (
            <FilterChip label="Sem fiscal" onRemove={() => toggleParam("noFiscal", false)} />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Limpar tudo
          </button>
        </div>
      )}

      {/* Table — only this region scrolls */}
      <Table containerClassName="flex min-h-0 flex-1 flex-col [&>div]:min-h-0 [&>div]:flex-1 [&>div]:overflow-auto">
        <TableHeader>
          <TableRow className="sticky top-0 z-20 bg-surface-1">
            <TableHead className="w-14" />
            <TableHead className="font-semibold">Produto</TableHead>
            <TableHead className="font-semibold">Marca</TableHead>
            <TableHead className="font-semibold">Tipo</TableHead>
            <TableHead className="font-semibold">Categoria</TableHead>
            <TableHead className="text-right font-semibold">Venda</TableHead>
            <TableHead className="text-right font-semibold">Compra</TableHead>
            <TableHead className="text-right font-semibold">Estoque</TableHead>
            <TableHead className="font-semibold">Fiscal</TableHead>
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
                  ? "Ajuste os filtros ou limpe-os para ver todos os produtos."
                  : "Crie seu primeiro produto ou importe de um template fiscal."
              }
              action={
                hasFilters ? (
                  <Button size="sm" variant="outline" onClick={clearAll}>
                    <X className="h-3.5 w-3.5" />
                    Limpar filtros
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href="/app/products/new">
                      <Package className="h-3.5 w-3.5" />
                      Criar produto
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            products.map((p) => {
              const cfg =
                (TYPE_CONFIG as Record<string, TypeConfigEntry>)[p.productType] ??
                TYPE_CONFIG.SIMPLE;
              const hasTax = p._count.taxData > 0;
              const locPrice = activeLocationId ? (p.prices[0] ?? null) : null;
              const hasLocationPrice = !activeLocationId && p._count.prices > 0;
              const basePrice = Number(p.price.toString());
              const locPriceNum = locPrice ? Number(locPrice.price) : null;
              const locPromoNum = locPrice?.promoPrice ? Number(locPrice.promoPrice) : null;
              const displayPrice = activeLocationId
                ? locPromoNum !== null && locPriceNum !== null && locPromoNum < locPriceNum
                  ? locPromoNum
                  : (locPriceNum ?? basePrice)
                : basePrice;
              const strikePrice =
                activeLocationId &&
                locPromoNum !== null &&
                locPriceNum !== null &&
                locPromoNum < locPriceNum
                  ? locPriceNum
                  : null;
              const cost = p.costPrice ? Number(p.costPrice) : null;
              const totalStock = p.stockEntries.reduce((s, e) => s + Number(e.quantity), 0);
              const minTotal = p.stockEntries.reduce(
                (s, e) => s + (e.minQuantity ? Number(e.minQuantity) : 0),
                0,
              );
              const belowMin = minTotal > 0 && totalStock < minTotal;
              const zeroStock = totalStock <= 0;
              const stockTone = zeroStock
                ? "text-rose-500"
                : belowMin
                  ? "text-amber-500"
                  : "text-foreground";
              const imageUrl = p.imageUrl;

              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      target.closest("button") ||
                      target.closest("a") ||
                      target.closest("[role='menu']")
                    )
                      return;
                    router.push(`/app/products/${p.id}/overview`);
                  }}
                >
                  <TableCell>
                    {imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ src: imageUrl, name: p.name })}
                        className="group relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 transition-colors hover:border-primary/50"
                        aria-label={`Ver imagem de ${p.name}`}
                      >
                        {/* biome-ignore lint/performance/noImgElement: external user-provided URL */}
                        <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                          <Eye className="h-4 w-4 text-white" />
                        </span>
                      </button>
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30"
                        title="Sem imagem"
                      >
                        <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-block h-3 w-3 shrink-0 rounded-full ring-2 ${
                          p.isActive
                            ? "bg-emerald-500 ring-emerald-500/20"
                            : "bg-rose-500 ring-rose-500/20"
                        }`}
                        role="img"
                        aria-label={p.isActive ? "Ativo" : "Inativo"}
                        title={p.isActive ? "Ativo" : "Inativo"}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-snug">{p.name}</p>
                        <div className="mt-0.5 flex gap-2.5 font-mono text-xs text-muted-foreground">
                          {p.sku && (
                            <span className="inline-flex items-center gap-1" title="SKU">
                              <Hash className="h-3 w-3" />
                              {p.sku}
                            </span>
                          )}
                          {p.barcode && (
                            <span
                              className="inline-flex items-center gap-1"
                              title="Código de barras"
                            >
                              <Barcode className="h-3 w-3" />
                              {p.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.brand ? (
                      <span className="text-sm">{p.brand}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {hasLocationPrice && (
                        <span className="group/storeprice relative inline-flex">
                          <span
                            role="img"
                            aria-label={`${p._count.prices} preço(s) por loja`}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-info/15 text-info"
                          >
                            <Store className="h-2.5 w-2.5" />
                          </span>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden min-w-50 rounded-md border border-border bg-popover p-2 text-left text-xs shadow-lg group-hover/storeprice:block"
                          >
                            <span className="block px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Preços por loja
                            </span>
                            <span className="block divide-y divide-border/50">
                              {p.prices.length === 0 ? (
                                <span className="block px-1 py-1 text-muted-foreground">—</span>
                              ) : (
                                p.prices.map((lp) => {
                                  const pv = Number(lp.price);
                                  const promo = lp.promoPrice ? Number(lp.promoPrice) : null;
                                  return (
                                    <span
                                      key={lp.id}
                                      className="flex items-center justify-between gap-3 px-1 py-1"
                                    >
                                      <span className="truncate text-foreground">
                                        {lp.location?.name ?? "—"}
                                      </span>
                                      <span className="flex items-center gap-1.5 font-mono">
                                        {promo !== null && promo < pv && (
                                          <span className="text-[10px] text-muted-foreground line-through">
                                            {pv.toLocaleString("pt-BR", {
                                              style: "currency",
                                              currency: "BRL",
                                            })}
                                          </span>
                                        )}
                                        <span className="font-semibold text-foreground">
                                          {(promo !== null && promo < pv
                                            ? promo
                                            : pv
                                          ).toLocaleString("pt-BR", {
                                            style: "currency",
                                            currency: "BRL",
                                          })}
                                        </span>
                                      </span>
                                    </span>
                                  );
                                })
                              )}
                            </span>
                          </span>
                        </span>
                      )}
                      {displayPrice > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          {strikePrice !== null && (
                            <span className="font-mono text-[10px] text-muted-foreground line-through">
                              {strikePrice.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          )}
                          <span className="font-mono text-sm font-medium">
                            {displayPrice.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {cost !== null && cost > 0 ? (
                      <span className="font-mono text-sm text-muted-foreground">
                        {cost.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.stockEntries.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className="group/stockpop relative inline-flex items-center gap-1.5">
                          <span
                            className={`font-mono text-sm font-medium tabular-nums ${stockTone}`}
                          >
                            {totalStock.toLocaleString("pt-BR", {
                              maximumFractionDigits: 3,
                            })}
                          </span>
                          {(belowMin || zeroStock) && (
                            <AlertTriangle
                              className={`h-3 w-3 ${zeroStock ? "text-rose-500" : "text-amber-500"}`}
                            />
                          )}
                          {p.stockEntries.length > 1 && (
                            <span
                              role="img"
                              aria-label={`Estoque em ${p.stockEntries.length} loja(s)`}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-info/15 text-info"
                            >
                              <Boxes className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden min-w-55 rounded-md border border-border bg-popover p-2 text-left text-xs shadow-lg group-hover/stockpop:block"
                          >
                            <span className="block px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Estoque por loja
                            </span>
                            <span className="block divide-y divide-border/50">
                              {p.stockEntries.map((se) => {
                                const q = Number(se.quantity);
                                const min = se.minQuantity ? Number(se.minQuantity) : null;
                                const low = min !== null && q < min;
                                const zero = q <= 0;
                                const tone = zero
                                  ? "text-rose-500"
                                  : low
                                    ? "text-amber-500"
                                    : "text-foreground";
                                return (
                                  <span
                                    key={se.id}
                                    className="flex items-center justify-between gap-3 px-1 py-1"
                                  >
                                    <span className="truncate text-foreground">
                                      {se.location?.name ?? "—"}
                                    </span>
                                    <span className="flex items-center gap-1.5 font-mono tabular-nums">
                                      {min !== null && (
                                        <span className="text-[10px] text-muted-foreground">
                                          min{" "}
                                          {min.toLocaleString("pt-BR", {
                                            maximumFractionDigits: 3,
                                          })}
                                        </span>
                                      )}
                                      <span className={`font-semibold ${tone}`}>
                                        {q.toLocaleString("pt-BR", {
                                          maximumFractionDigits: 3,
                                        })}
                                      </span>
                                    </span>
                                  </span>
                                );
                              })}
                            </span>
                          </span>
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {hasTax ? (
                      <span className="group/fiscal relative inline-flex">
                        <span
                          role="img"
                          aria-label="Fiscal OK"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </span>
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 hidden w-max min-w-30 rounded-md border border-border bg-popover p-2 text-left text-xs shadow-lg group-hover/fiscal:block"
                        >
                          {p.taxData.map((tx) => (
                            <span
                              key={`${tx.ncm}-${tx.cest ?? "sem-cest"}`}
                              className="block space-y-0.5 py-0.5"
                            >
                              <span className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  NCM
                                </span>
                                <span className="font-mono text-foreground">{tx.ncm}</span>
                              </span>
                              <span className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  CEST
                                </span>
                                <span className="font-mono text-foreground">{tx.cest || "—"}</span>
                              </span>
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={`/app/products/${p.id}?tab=fiscal`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex"
                        title="Sem dados fiscais — aplicar template"
                        aria-label="Sem dados fiscais"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-warning/15 text-warning transition-opacity hover:opacity-80">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label="Ações"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-40 rounded-lg border-border bg-popover p-1 shadow-lg"
                      >
                        <DropdownMenuItem asChild className="cursor-pointer rounded-md text-[13px]">
                          <Link href={`/app/products/${p.id}/overview`}>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            Ver detalhes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer rounded-md text-[13px]">
                          <Link href={`/app/products/${p.id}`}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer rounded-md text-[13px]"
                          onSelect={() => {
                            if (p.isActive) {
                              setConfirmDeactivate(p);
                            } else {
                              setActive(p, true);
                            }
                          }}
                        >
                          {p.isActive ? (
                            <>
                              <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                              Inativar
                            </>
                          ) : (
                            <>
                              <Power className="h-3.5 w-3.5 text-muted-foreground" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Lightbox */}
      {lightbox && (
        <dialog
          open
          aria-modal="true"
          aria-label={`Imagem de ${lightbox.name}`}
          className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-black/80 p-6 backdrop:bg-transparent backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="Fechar imagem"
            onClick={() => setLightbox(null)}
            className="absolute inset-0 h-full w-full"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative z-10 flex h-full items-center justify-center">
            {/* biome-ignore lint/performance/noImgElement: external user-provided URL */}
            <img
              src={lightbox.src}
              alt={lightbox.name}
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            />
          </div>
        </dialog>
      )}

      {/* Confirm inactivation */}
      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(o) => !o && !deactivating && setConfirmDeactivate(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Inativar produto?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{confirmDeactivate?.name}</span> ficará
              oculto da venda e dos canais. Você pode reativá-lo a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={deactivating}
              onClick={() => setConfirmDeactivate(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deactivating}
              onClick={confirmDeactivation}
            >
              <PowerOff className="h-3.5 w-3.5" />
              {deactivating ? "Inativando…" : "Inativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
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

function QuickToggle({
  active,
  onToggle,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "muted" | "warning";
}) {
  const activeCls =
    tone === "warning"
      ? "bg-warning/15 border-warning/40 text-warning"
      : "bg-muted border-border text-foreground";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        active
          ? activeCls
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-foreground">
      <span className="truncate max-w-45">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
