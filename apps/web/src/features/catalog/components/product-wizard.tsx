"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiProductLookup } from "@/features/catalog/ai-product-lookup";
import type { OpenFoodFactsProduct } from "@/features/inventory/actions/ai-product-actions";
import {
  Image as ImageIcon,
  Package,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createProductAction,
  generateSkuAction,
  updateProductAction,
} from "../actions/product-actions";
import { setProductTagsAction } from "../actions/tag-actions";
import type { ProductInput } from "../schemas";

/* ── Constants ──────────────────────────────────────────────── */

type TagData = { id: string; name: string; group: string; color: string | null };
type TagEntry = {
  tagId: string;
  source: "category" | "manual";
  name: string;
  group: string;
  color: string | null;
};
type Category = {
  id: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  defaultTags?: { tag: TagData }[];
};
type Supplier = { id: string; name: string };

const PRODUCT_TYPES = [
  { value: "SIMPLE", label: "Simples", desc: "Produto unitário padrão" },
  { value: "VARIANT_PARENT", label: "Variantes", desc: "Tem variações (tamanho, sabor…)" },
  { value: "KIT", label: "Kit/Combo", desc: "Conjunto de produtos" },
  { value: "FRACTIONED", label: "Fracionado", desc: "Vendido por peso ou volume" },
];

// Unidades base (contagem / peso / volume)
const BASE_UNITS = [
  { value: "UN", label: "Unidade (un)" },
  { value: "KG", label: "Quilograma (kg)" },
  { value: "G", label: "Grama (g)" },
  { value: "L", label: "Litro (l)" },
  { value: "ML", label: "Mililitro (ml)" },
];

// Unidades de embalagem / compra
const PACK_UNITS = [
  { value: "CX", label: "Caixa (cx)" },
  { value: "PCT", label: "Pacote (pct)" },
  { value: "FARDO", label: "Fardo" },
  { value: "DZ", label: "Dúzia (dz)" },
  { value: "BANDEJA", label: "Bandeja" },
  { value: "CENTO", label: "Cento" },
];

const ALL_UNITS = [...BASE_UNITS, ...PACK_UNITS];

/* ── Image preview widget ───────────────────────────────────── */

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [inputVal, setInputVal] = useState(value);
  const [error, setError] = useState(false);

  // sync when value changes externally (e.g. AI fill)
  useEffect(() => {
    setInputVal(value);
    setError(false);
  }, [value]);

  function commit() {
    onChange(inputVal.trim());
    setError(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Preview */}
      {value && !error ? (
        <div className="relative w-full h-40 rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="max-h-full max-w-full object-contain p-2"
            onError={() => setError(true)}
          />
          <button
            type="button"
            onClick={() => {
              onChange("");
              setInputVal("");
            }}
            className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background shadow"
            title="Remover imagem"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="w-full h-24 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center text-muted-foreground/40">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}

      {/* URL input */}
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://…/imagem.jpg"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className="flex-1 text-xs"
        />
        {inputVal !== value && (
          <Button type="button" size="sm" variant="outline" onClick={commit}>
            OK
          </Button>
        )}
        {value && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              onChange("");
              setInputVal("");
            }}
            title="Remover"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive">
          Não foi possível carregar a imagem. Verifique a URL.
        </p>
      )}
    </div>
  );
}

/* ── Category selector (hierárquico) ───────────────────────── */

function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  const roots = categories.filter((c) => !c.parentId);

  // Build grouped list: pai → filhos
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <option value="">Sem categoria</option>
      {roots.map((root) => {
        const children = categories.filter((c) => c.parentId === root.id);
        const rootLabel = `${root.icon ? `${root.icon} ` : ""}${root.name}`;

        if (children.length === 0) {
          return (
            <option key={root.id} value={root.id}>
              {rootLabel}
            </option>
          );
        }

        return (
          <optgroup key={root.id} label={rootLabel}>
            {/* Opção para a categoria raiz em si */}
            <option value={root.id}>{rootLabel} (geral)</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.icon ? `${child.icon} ` : "↳ "}
                {child.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

/* ── Pack size section ──────────────────────────────────────── */

function PackSizeSection({
  stockUnit,
  packUnit,
  packSize,
  onChange,
}: {
  stockUnit: string;
  packUnit: string;
  packSize: string;
  onChange: (v: { packUnit?: string; packSize?: string }) => void;
}) {
  const unitLabel = ALL_UNITS.find((u) => u.value === stockUnit)?.label ?? stockUnit;
  const enabled = !!packUnit;

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Embalagem de compra</span>
        </div>
        <button
          type="button"
          onClick={() =>
            enabled
              ? onChange({ packUnit: "", packSize: "" })
              : onChange({ packUnit: "FARDO", packSize: "1" })
          }
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {enabled ? (
            <ToggleRight className="h-6 w-6 text-green-500" />
          ) : (
            <ToggleLeft className="h-6 w-6" />
          )}
        </button>
      </div>

      {enabled && (
        <>
          <p className="text-xs text-muted-foreground">
            Define quantas <strong>{unitLabel}</strong> cabem em uma unidade de embalagem maior (ex:
            1 Fardo = 8 unidades).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Unidade de embalagem</Label>
              <select
                value={packUnit}
                onChange={(e) => onChange({ packUnit: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {PACK_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                Qtd de {unitLabel} por{" "}
                {PACK_UNITS.find((u) => u.value === packUnit)?.label ?? packUnit}
              </Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={packSize}
                onChange={(e) => onChange({ packSize: e.target.value })}
                placeholder="Ex: 8"
              />
            </div>
          </div>
          {packUnit && packSize && Number(packSize) > 0 && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
              1 {PACK_UNITS.find((u) => u.value === packUnit)?.label ?? packUnit} = {packSize}{" "}
              {unitLabel}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Existing product type ──────────────────────────────────── */

type ExistingProduct = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  productType: string;
  unit: string;
  saleUnit: string;
  conversionFactor: { toString(): string };
  packUnit?: string | null;
  packSize?: number | null;
  price: { toString(): string };
  costPrice: { toString(): string } | null;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string | null;
  supplierId: string | null;
  hasAgeRestriction: boolean;
  minAge: number | null;
  expiryDays: number | null;
  productTags?: { tag: TagData }[];
};

interface Props {
  organizationId: string;
  categories: Category[];
  suppliers: Supplier[];
  allTags?: TagData[];
  taxRegime: string | null;
  product?: ExistingProduct;
}

type FormState = {
  name: string;
  description: string;
  brand: string;
  sku: string;
  barcode: string;
  productType: string;
  unit: string;
  saleUnit: string;
  conversionFactor: string;
  packUnit: string;
  packSize: string;
  price: string;
  costPrice: string;
  imageUrl: string;
  categoryId: string;
  supplierId: string;
  isActive: boolean;
  hasAgeRestriction: boolean;
  minAge: string;
  expiryDays: string;
};

/* ── Main component ─────────────────────────────────────────── */

export function ProductWizard({
  organizationId,
  categories,
  suppliers,
  allTags = [],
  taxRegime,
  product,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<string>(product ? "manual" : "ai");
  const [formKey, setFormKey] = useState(0);
  const [skuLoading, setSkuLoading] = useState(false);
  const isEdit = !!product;

  // Smart tags state
  const [tagSearch, setTagSearch] = useState("");
  const [productTags, setProductTags] = useState<TagEntry[]>(() => {
    if (!product?.productTags) return [];
    return product.productTags.map((pt) => ({
      tagId: pt.tag.id,
      source: "manual" as const,
      name: pt.tag.name,
      group: pt.tag.group,
      color: pt.tag.color,
    }));
  });

  const [form, setForm] = useState<FormState>({
    name: product?.name ?? "",
    description: product?.description ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    productType: product?.productType ?? "SIMPLE",
    unit: product?.unit ?? "UN",
    saleUnit: product?.saleUnit ?? "UN",
    conversionFactor: product?.conversionFactor?.toString() ?? "1",
    packUnit: product?.packUnit ?? "",
    packSize: product?.packSize?.toString() ?? "",
    price: product?.price?.toString() ?? "",
    costPrice: product?.costPrice?.toString() ?? "",
    imageUrl: product?.imageUrl ?? "",
    categoryId: product?.categoryId ?? "",
    supplierId: product?.supplierId ?? "",
    isActive: product?.isActive ?? true,
    hasAgeRestriction: product?.hasAgeRestriction ?? false,
    minAge: product?.minAge?.toString() ?? "18",
    expiryDays: product?.expiryDays?.toString() ?? "",
  });

  function set(partial: Partial<FormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  /* ── SKU auto-generation when category changes ─────────────── */
  async function handleCategoryChange(categoryId: string) {
    set({ categoryId });

    // Load category default tags (replace old category tags, keep manual)
    const cat = categories.find((c) => c.id === categoryId);
    const catTags: TagEntry[] = (cat?.defaultTags ?? []).map((dt) => ({
      tagId: dt.tag.id,
      source: "category" as const,
      name: dt.tag.name,
      group: dt.tag.group,
      color: dt.tag.color,
    }));
    setProductTags((prev) => {
      const manual = prev.filter((t) => t.source === "manual");
      // avoid duplicates between category tags and manual tags
      const manualIds = new Set(manual.map((t) => t.tagId));
      const newCatTags = catTags.filter((t) => !manualIds.has(t.tagId));
      return [...newCatTags, ...manual];
    });

    // Only auto-generate if SKU is still blank and creating a new product
    if (!isEdit && !form.sku && categoryId) {
      setSkuLoading(true);
      const res = await generateSkuAction(organizationId, categoryId);
      setSkuLoading(false);
      if (res.success) {
        set({ sku: res.sku });
        toast.info(`SKU sugerido: ${res.sku}`);
      }
    }
  }

  function handleAiFound(p: OpenFoodFactsProduct) {
    setForm((f) => ({
      ...f,
      name: p.name,
      brand: p.brand ?? f.brand,
      barcode: p.barcode,
      imageUrl: p.imageUrl ?? f.imageUrl,
    }));
    setFormKey((k) => k + 1);
    setTab("manual");
    toast.success("Dados preenchidos! Revise antes de salvar.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input: ProductInput = {
        name: form.name,
        description: form.description || undefined,
        brand: form.brand || undefined,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        tags: [],
        productType: form.productType as ProductInput["productType"],
        unit: form.unit as ProductInput["unit"],
        saleUnit: form.saleUnit as ProductInput["saleUnit"],
        conversionFactor: Number(form.conversionFactor) || 1,
        packUnit: (form.packUnit || undefined) as ProductInput["packUnit"],
        packSize: form.packSize ? Number(form.packSize) : undefined,
        price: Number(form.price) || 0,
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        imageUrl: form.imageUrl || undefined,
        categoryId: form.categoryId || undefined,
        supplierId: form.supplierId || undefined,
        isActive: form.isActive,
        hasAgeRestriction: form.hasAgeRestriction,
        minAge: form.hasAgeRestriction ? Number(form.minAge) || 18 : undefined,
        expiryDays: form.expiryDays ? Number(form.expiryDays) : undefined,
      };

      const result = isEdit
        ? await updateProductAction(organizationId, product?.id ?? "", input)
        : await createProductAction(organizationId, input);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const productId = isEdit
        ? (product?.id ?? "")
        : (result as { success: true; data: { id: string } }).data.id;
      if (productId) {
        await setProductTagsAction(
          organizationId,
          productId,
          productTags.map((t) => t.tagId),
        );
      }

      toast.success(isEdit ? "Produto atualizado!" : "Produto criado!");
      if (!isEdit && productId) router.push(`/app/products/${productId}`);
    });
  }

  const isFractioned = form.productType === "FRACTIONED";

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-0">
      {!isEdit && (
        <TabsList variant="pills" className="w-fit mb-5">
          <TabsTrigger value="ai" variant="pills" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Busca inteligente
          </TabsTrigger>
          <TabsTrigger value="manual" variant="pills" icon={<PencilLine className="h-3.5 w-3.5" />}>
            Manual
          </TabsTrigger>
        </TabsList>
      )}

      {!isEdit && (
        <TabsContent value="ai">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium mb-1">Busca por código de barras</p>
            <p className="text-xs text-muted-foreground mb-4">
              Digite o EAN do produto. Os dados (nome, marca, imagem) serão preenchidos
              automaticamente.
            </p>
            <AiProductLookup onFound={handleAiFound} />
          </div>
        </TabsContent>
      )}

      <TabsContent value="manual">
        <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Tipo */}
          {!isEdit && (
            <div className="flex flex-col gap-2">
              <Label>Tipo do produto</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRODUCT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set({ productType: t.value })}
                    className={`rounded-lg border p-3 text-left transition-all text-sm ${
                      form.productType === t.value
                        ? "border-ring bg-accent/5 ring-1 ring-ring"
                        : "border-border hover:border-ring/50 hover:bg-muted/30"
                    }`}
                  >
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Imagem do produto */}
          <div className="flex flex-col gap-1.5">
            <Label>Imagem do produto</Label>
            <ImageField value={form.imageUrl} onChange={(v) => set({ imageUrl: v })} />
          </div>

          {/* Identificação */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="p-name">Nome *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Ex: Coca-Cola 350ml Lata"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-brand">Marca</Label>
              <Input
                id="p-brand"
                value={form.brand}
                onChange={(e) => set({ brand: e.target.value })}
                placeholder="Ex: Coca-Cola"
              />
            </div>

            {/* Categoria — com seletor hierárquico e geração de SKU */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-category">Categoria</Label>
              <CategorySelect
                categories={categories}
                value={form.categoryId}
                onChange={handleCategoryChange}
              />
            </div>

            {/* SKU com botão de regerar */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-sku">SKU (código interno)</Label>
              <div className="flex gap-2">
                <Input
                  id="p-sku"
                  value={skuLoading ? "Gerando…" : form.sku}
                  onChange={(e) => set({ sku: e.target.value })}
                  placeholder="Selecione a categoria para gerar automaticamente"
                  disabled={skuLoading}
                  className="flex-1"
                />
                {form.categoryId && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 shrink-0"
                    title="Regerar SKU"
                    disabled={skuLoading}
                    onClick={async () => {
                      setSkuLoading(true);
                      const res = await generateSkuAction(organizationId, form.categoryId);
                      setSkuLoading(false);
                      if (res.success) set({ sku: res.sku });
                    }}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${skuLoading ? "animate-spin" : ""}`} />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Gerado automaticamente ao escolher a categoria. Pode ser editado.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-barcode">Código de barras (EAN)</Label>
              <Input
                id="p-barcode"
                value={form.barcode}
                onChange={(e) => set({ barcode: e.target.value })}
                inputMode="numeric"
                placeholder="7894900011517"
              />
            </div>

            {suppliers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-supplier">Fornecedor</Label>
                <select
                  id="p-supplier"
                  value={form.supplierId}
                  onChange={(e) => set({ supplierId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">Nenhum</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="p-desc">Descrição</Label>
              <textarea
                id="p-desc"
                rows={2}
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Descrição opcional…"
                className="flex w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 resize-none"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-2">
            <Label>Tags do produto</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Tags da categoria são carregadas automaticamente. Você pode adicionar ou remover
              qualquer tag.
            </p>

            {/* Chips de tags ativas */}
            {productTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {productTags.map((t) => (
                  <span
                    key={t.tagId}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border"
                    style={
                      t.color
                        ? {
                            backgroundColor: `${t.color}20`,
                            borderColor: `${t.color}50`,
                            color: t.color,
                          }
                        : {
                            backgroundColor: "hsl(var(--muted))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--foreground))",
                          }
                    }
                  >
                    {t.source === "category" && (
                      <span className="opacity-50 text-[9px] uppercase tracking-wider mr-0.5">
                        auto
                      </span>
                    )}
                    {t.name}
                    <button
                      type="button"
                      onClick={() =>
                        setProductTags((prev) => prev.filter((x) => x.tagId !== t.tagId))
                      }
                      className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Busca + adicionar tags */}
            {allTags.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Buscar e adicionar tags…"
                    className="w-full rounded-md border border-input bg-card pl-8 pr-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                  {allTags
                    .filter(
                      (t) =>
                        !productTags.some((pt) => pt.tagId === t.id) &&
                        (tagSearch === "" ||
                          t.name.toLowerCase().includes(tagSearch.toLowerCase()) ||
                          t.group.toLowerCase().includes(tagSearch.toLowerCase())),
                    )
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setProductTags((prev) => [
                            ...prev,
                            {
                              tagId: tag.id,
                              source: "manual",
                              name: tag.name,
                              group: tag.group,
                              color: tag.color,
                            },
                          ]);
                          setTagSearch("");
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all hover:opacity-80"
                        style={
                          tag.color
                            ? {
                                backgroundColor: `${tag.color}15`,
                                borderColor: `${tag.color}30`,
                                color: tag.color,
                              }
                            : {
                                backgroundColor: "hsl(var(--muted))",
                                borderColor: "hsl(var(--border))",
                              }
                        }
                      >
                        <Plus className="h-2.5 w-2.5 opacity-50" />
                        {tag.name}
                      </button>
                    ))}
                  {allTags.filter(
                    (t) =>
                      !productTags.some((pt) => pt.tagId === t.id) &&
                      (tagSearch === "" ||
                        t.name.toLowerCase().includes(tagSearch.toLowerCase()) ||
                        t.group.toLowerCase().includes(tagSearch.toLowerCase())),
                  ).length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-1">
                      {productTags.length === allTags.length
                        ? "Todas as tags já adicionadas."
                        : "Nenhuma tag encontrada."}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preço e unidade de estoque */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-price">Preço de venda (R$) *</Label>
              <Input
                id="p-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-cost">Custo (R$)</Label>
              <Input
                id="p-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => set({ costPrice: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-unit">Unidade de estoque</Label>
              <select
                id="p-unit"
                value={form.unit}
                onChange={(e) => set({ unit: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <optgroup label="Base">
                  {BASE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Embalagem">
                  {PACK_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Produto fracionado */}
          {isFractioned && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 p-4">
              <p className="sm:col-span-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                Produto fracionado — configure a unidade de venda e o fator de conversão
              </p>
              <div className="flex flex-col gap-1.5">
                <Label>Unidade de venda</Label>
                <select
                  value={form.saleUnit}
                  onChange={(e) => set({ saleUnit: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {ALL_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-factor">Fator de conversão</Label>
                <Input
                  id="p-factor"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={form.conversionFactor}
                  onChange={(e) => set({ conversionFactor: e.target.value })}
                  placeholder="Ex: 0.001 (g→kg)"
                />
                <p className="text-xs text-muted-foreground">
                  stockQty = saleQty × fator. Ex: presunto em kg, venda em g → fator 0.001
                </p>
              </div>
            </div>
          )}

          {/* Embalagem de compra */}
          <PackSizeSection
            stockUnit={form.unit}
            packUnit={form.packUnit}
            packSize={form.packSize}
            onChange={(v) => set({ ...v })}
          />

          {/* Status */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Produto ativo</p>
              <p className="text-xs text-muted-foreground">
                Produto inativo não aparece nas vendas
              </p>
            </div>
            <button
              type="button"
              onClick={() => set({ isActive: !form.isActive })}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {form.isActive ? (
                <ToggleRight className="h-6 w-6 text-green-500" />
              ) : (
                <ToggleLeft className="h-6 w-6" />
              )}
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar produto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/app/products")}>
              Cancelar
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
