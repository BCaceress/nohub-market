"use client";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  Copy,
  FileText,
  FolderPlus,
  ImagePlus,
  Layers,
  Loader2,
  type LucideIcon,
  Package,
  Plus,
  PlusCircle,
  Receipt,
  RefreshCw,
  Scale,
  ScanLine,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrandsAction, upsertBrandAction } from "@/features/catalog/actions/brand-actions";
import { createCategoryAction } from "@/features/catalog/actions/category-actions";
import { setKitComponentsAction } from "@/features/catalog/actions/kit-actions";
import {
  deleteProductPackageAction,
  type ProductPackage,
  upsertProductPackageAction,
} from "@/features/catalog/actions/package-actions";
import {
  createProductAction,
  findProductByBarcodeAction,
  generateNextSkuAction,
  generateSkuAction,
  searchProductsForKitAction,
  setProductSuppliersAction,
  updateProductAction,
} from "@/features/catalog/actions/product-actions";
import { setProductTaxAction } from "@/features/catalog/actions/tax-actions";
import { BarcodeScanner } from "@/features/catalog/components/barcode-scanner";
import { BarcodeSearchStep } from "@/features/catalog/components/barcode-search-step";
import {
  type CategoryLite,
  calcMargin,
  type InheritedBadgeKind,
  inheritedBadges,
  normalizeBrandName,
  resolveInheritedProfile,
} from "@/features/catalog/lib/product-helpers";
import type { ProductInput } from "@/features/catalog/schemas";
import {
  lookupProductByBarcodeAction,
  type OpenFoodFactsProduct,
} from "@/features/inventory/actions/ai-product-actions";
import { isCloudinaryConfigured, MAX_IMAGE_BYTES, uploadImageToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

interface Props {
  organizationId: string;
  categories: CategoryLite[];
  initialSku?: string;
  /** Tipo escolhido no dropdown de entrada (SIMPLE | KIT | FRACTIONED). */
  initialType?: string;
  suppliers: { id: string; name: string }[];
  taxRegime: string | null;
  product?: ExistingProduct;
  initialPackages?: ProductPackage[];
  /** Abas extras (ex.: Variantes, Composição) na edição — evita aba-sobre-aba. */
  extraTabs?: {
    value: string;
    label: string;
    badge?: number;
    content: React.ReactNode;
  }[];
}

type ExistingTaxData = {
  ncm: string;
  cest: string | null;
  cfopInternal: string | null;
  cfopInterstate: string | null;
  origin: string;
  icmsCst: string | null;
  icmsCsosn: string | null;
  icmsRate: { toString(): string } | null;
  pisCst: string | null;
  pisRate: { toString(): string } | null;
  cofinsCst: string | null;
  cofinsRate: { toString(): string } | null;
};

type ExistingProduct = {
  id: string;
  name: string;
  posName: string | null;
  description: string | null;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  tags?: string[];
  productType: string;
  unit: string;
  saleUnit: string;
  conversionFactor: { toString(): string };
  packUnit: string | null;
  packSize: number | null;
  price: { toString(): string };
  costPrice: { toString(): string } | null;
  imageUrl: string | null;
  weight: { toString(): string } | null;
  height: { toString(): string } | null;
  width: { toString(): string } | null;
  length: { toString(): string } | null;
  stockMin: { toString(): string } | null;
  stockIdeal: { toString(): string } | null;
  location: string | null;
  isActive: boolean;
  categoryId: string | null;
  supplierId: string | null;
  hasAgeRestriction: boolean;
  minAge: number | null;
  storageTemperature: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
  taxData?: ExistingTaxData[];
  kitComponents?: {
    componentProductId: string;
    quantity: { toString(): string };
    componentProduct: { id: string; name: string; unit: string };
  }[];
};

// Componente de combo selecionado no form (criação)
type KitItem = {
  componentProductId: string;
  name: string;
  unit: string;
  quantity: string;
};

const PRODUCT_TYPE_OPTIONS: {
  value: ProductInput["productType"];
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    value: "SIMPLE",
    label: "Simples",
    hint: "Produto unitário padrão",
    icon: Package,
  },
  {
    value: "FRACTIONED",
    label: "Fracionado",
    hint: "Vendido por peso/volume",
    icon: Scale,
  },
  {
    value: "KIT",
    label: "Combo / Kit",
    hint: "Baixa estoque dos componentes",
    icon: Layers,
  },
  {
    value: "CUSTOM",
    label: "Personalizado",
    hint: "Itens fixos + opções escolhidas na venda",
    icon: SlidersHorizontal,
  },
];

const UNIT_SELECT = [
  { value: "UN", label: "Unidade (un)" },
  { value: "KG", label: "Quilograma (kg)" },
  { value: "G", label: "Grama (g)" },
  { value: "L", label: "Litro (l)" },
  { value: "ML", label: "Mililitro (ml)" },
  { value: "CX", label: "Caixa (cx)" },
  { value: "PCT", label: "Pacote (pct)" },
  { value: "FARDO", label: "Fardo (fd)" },
  { value: "DZ", label: "Dúzia (dz)" },
  { value: "BANDEJA", label: "Bandeja" },
  { value: "CENTO", label: "Cento" },
] as const;

const ICMS_CST_OPTIONS = [
  { value: "00", label: "00 — Tributado integralmente" },
  { value: "10", label: "10 — Tributado + ST" },
  { value: "20", label: "20 — Com redução de BC" },
  { value: "40", label: "40 — Isento" },
  { value: "41", label: "41 — Não tributado" },
  { value: "60", label: "60 — ICMS cobrado ant. por ST" },
  { value: "90", label: "90 — Outros" },
];

const ICMS_CSOSN_OPTIONS = [
  { value: "101", label: "101 — Tributado com crédito" },
  { value: "102", label: "102 — Tributado sem crédito" },
  { value: "103", label: "103 — Isenção por faixa de receita" },
  { value: "300", label: "300 — Imune" },
  { value: "400", label: "400 — Não tributado" },
  { value: "500", label: "500 — ICMS cobrado ant. por ST" },
  { value: "900", label: "900 — Outros" },
];

const PIS_COFINS_CST_OPTIONS = [
  { value: "01", label: "01 — Alíquota básica" },
  { value: "04", label: "04 — Monofásica" },
  { value: "06", label: "06 — Alíquota zero" },
  { value: "07", label: "07 — Isenta" },
  { value: "08", label: "08 — Sem incidência" },
  { value: "49", label: "49 — Outras saídas" },
];

const TAX_ORIGIN_OPTIONS = [
  { value: "NACIONAL", label: "0 — Nacional" },
  { value: "IMPORTADO_DIRETO", label: "1 — Importado direto" },
  { value: "IMPORTADO_NACIONAL", label: "2 — Importado, nacional" },
  {
    value: "NACIONAL_MAIS_40_IMPORTADO",
    label: "3 — Nacional, > 40% importado",
  },
  {
    value: "NACIONAL_MENOS_40_IMPORTADO",
    label: "4 — Nacional, ≤ 40% importado",
  },
  { value: "NACIONAL_SEM_SIMILAR", label: "5 — Nacional, sem similar" },
  { value: "ESTRANGEIRO_DIRETO", label: "6 — Estrangeiro direto" },
  { value: "ESTRANGEIRO_NACIONAL", label: "7 — Estrangeiro, mercado interno" },
  {
    value: "NACIONAL_MENOS_70_IMPORTADO",
    label: "8 — Nacional, > 70% importado",
  },
];

type TaxForm = {
  ncm: string;
  cest: string;
  cfopInternal: string;
  cfopInterstate: string;
  origin: string;
  icmsCst: string;
  icmsCsosn: string;
  icmsRate: string;
  pisCst: string;
  pisRate: string;
  cofinsCst: string;
  cofinsRate: string;
};

const EMPTY_TAX: TaxForm = {
  ncm: "",
  cest: "",
  cfopInternal: "",
  cfopInterstate: "",
  origin: "NACIONAL",
  icmsCst: "",
  icmsCsosn: "",
  icmsRate: "",
  pisCst: "",
  pisRate: "",
  cofinsCst: "",
  cofinsRate: "",
};

const BADGE_ICON: Record<InheritedBadgeKind, LucideIcon> = {
  expiry: CalendarClock,
  lot: Boxes,
};

const TEMP_PRODUCT_OPTIONS: {
  value: "AMBIENTE" | "REFRIGERADO" | "CONGELADO";
  label: string;
  emoji: string;
}[] = [
  { value: "AMBIENTE", label: "Ambiente", emoji: "🌡️" },
  { value: "REFRIGERADO", label: "Refrigerado", emoji: "❄️" },
  { value: "CONGELADO", label: "Congelado", emoji: "🧊" },
];

type Form = {
  sku: string;
  productType: ProductInput["productType"];
  barcode: string;
  name: string;
  shortName: string;
  subcategoryId: string;
  brand: string;
  costPrice: string;
  price: string;
  imageUrl: string;
  // estoque / logística
  unit: string;
  saleUnit: string;
  conversionFactor: string;
  packUnit: string;
  packSize: string;
  stockMin: string;
  stockIdeal: string;
  location: string;
  weight: string;
  height: string;
  width: string;
  length: string;
  // mais
  description: string;
  isActive: boolean;
  hasAgeRestriction: boolean;
  storageTemperature: "" | "AMBIENTE" | "REFRIGERADO" | "CONGELADO";
};

const EMPTY: Omit<Form, "sku"> = {
  productType: "SIMPLE",
  barcode: "",
  name: "",
  shortName: "",
  subcategoryId: "",
  brand: "",
  costPrice: "",
  price: "",
  imageUrl: "",
  unit: "UN",
  saleUnit: "UN",
  conversionFactor: "1",
  packUnit: "",
  packSize: "",
  stockMin: "",
  stockIdeal: "",
  location: "",
  weight: "",
  height: "",
  width: "",
  length: "",
  description: "",
  isActive: true,
  hasAgeRestriction: false,
  storageTemperature: "",
};

/* ── Money input (digits → R$) ──────────────────────────────── */

function MoneyInput({
  value,
  onChange,
  id,
  ...rest
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  const display =
    value === ""
      ? ""
      : (Math.round((Number(value) || 0) * 100) / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        {...rest}
        id={id}
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? (Number(digits) / 100).toFixed(2) : "");
        }}
        className="pl-9 text-right font-mono tabular-nums"
      />
    </div>
  );
}

/* ── Section divider ────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ── Sticky product header (modo página única) ──────────────── */

function ProductHeader({
  name,
  brand,
  barcode,
  imageUrl,
  price,
  margin,
}: {
  name: string;
  brand: string;
  barcode: string;
  imageUrl: string;
  price: number;
  margin: number | null;
}) {
  const priceLabel =
    price > 0 ? price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ —";
  return (
    <div className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name.trim() || "Novo produto"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[brand.trim(), barcode.replace(/\D/g, "")].filter(Boolean).join(" · ") || "Sem EAN"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right">
        <span className="text-sm font-semibold tabular-nums">{priceLabel}</span>
        {margin !== null && (
          <Badge variant={margin < 0 ? "destructive" : "success"} className="hidden sm:inline-flex">
            {margin.toFixed(0)}%
          </Badge>
        )}
      </div>
    </div>
  );
}

/* ── Heading de seção (modo página única, substitui a aba) ──── */

function StackHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold leading-none">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/* ── Image card ─────────────────────────────────────────────── */

function ImageCard({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imgError, setImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cloudOn = isCloudinaryConfigured();

  // biome-ignore lint/correctness/useExhaustiveDependencies: reseta erro ao trocar imagem
  useEffect(() => {
    setImgError(false);
  }, [value]);

  async function handleFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Arquivo não é uma imagem.");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("Imagem acima de 5 MB.");
    setUploading(true);
    try {
      onChange(await uploadImageToCloudinary(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  const hasImage = Boolean(value) && !imgError;

  return (
    <div className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: dropzone com botão interno acessível */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dropzone com botão interno acessível */}
      <div
        onClick={() => cloudOn && !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          if (cloudOn) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!cloudOn) return;
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-1/40 transition-colors",
          dragOver && "border-primary bg-primary/5",
          cloudOn && !hasImage && "cursor-pointer hover:border-primary/50",
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Enviando…</span>
          </div>
        ) : hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Pré-visualização do produto"
              onError={() => setImgError(true)}
              className="h-full w-full object-contain p-4"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Remover imagem"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground">
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm font-medium text-foreground/80">Adicionar imagem</span>
            <span className="text-xs">
              {cloudOn ? "Arraste, cole ou clique" : "Upload indisponível"}
            </span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {hasImage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Trocar imagem
        </Button>
      )}
    </div>
  );
}

/* ── Brand combobox (autocomplete + cria nova) ──────────────── */

function BrandCombobox({
  value,
  onChange,
  organizationId,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  organizationId: string;
  id: string;
}) {
  const [brands, setBrands] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBrandsAction(organizationId).then((rows) => setBrands(rows.map((b) => b.name)));
  }, [organizationId]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const q = value.trim().toLowerCase();
  const matches = q ? brands.filter((b) => b.toLowerCase().includes(q)) : brands;
  const exact = brands.some((b) => b.toLowerCase() === q);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Ex: Fruki"
          autoComplete="off"
          className="pr-9"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
      </div>

      {open && (matches.length > 0 || (q && !exact)) && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {matches.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                onChange(b);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-1"
            >
              {b}
              {b.toLowerCase() === q && <Check className="h-3.5 w-3.5 text-success" />}
            </button>
          ))}
          {q && !exact && (
            <button
              type="button"
              onClick={() => {
                onChange(normalizeBrandName(value));
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-surface-1"
            >
              <span>Criar marca</span>
              <span className="font-medium text-foreground">“{normalizeBrandName(value)}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────── */

type BcStatus = "idle" | "loading" | "found" | "duplicate" | "not_found";

type PackLevel = {
  id: string;
  packageId?: string;
  label: string;
  barcode: string;
  qtyPerParent: string;
};

const PACK_LABEL_SUGGESTIONS = ["Fardo", "Caixa", "Pallet"];

function productToForm(product: ExistingProduct, fallbackSku: string): Form {
  return {
    sku: product.sku ?? fallbackSku,
    productType: (product.productType as Form["productType"]) ?? "SIMPLE",
    barcode: product.barcode ?? "",
    name: product.name,
    shortName: product.posName ?? "",
    subcategoryId: product.categoryId ?? "",
    brand: product.brand ?? "",
    costPrice: product.costPrice?.toString() ?? "",
    price: product.price?.toString() ?? "",
    imageUrl: product.imageUrl ?? "",
    unit: product.unit,
    saleUnit: product.saleUnit,
    conversionFactor: product.conversionFactor?.toString() ?? "1",
    packUnit: product.packUnit ?? "",
    packSize: product.packSize?.toString() ?? "",
    stockMin: product.stockMin?.toString() ?? "",
    stockIdeal: product.stockIdeal?.toString() ?? "",
    location: product.location ?? "",
    weight: product.weight?.toString() ?? "",
    height: product.height?.toString() ?? "",
    width: product.width?.toString() ?? "",
    length: product.length?.toString() ?? "",
    description: product.description ?? "",
    isActive: product.isActive,
    hasAgeRestriction: product.hasAgeRestriction,
    storageTemperature: product.storageTemperature ?? "",
  };
}

function taxDataToForm(taxData?: ExistingTaxData[]): TaxForm {
  const tax = taxData?.[0];
  if (!tax) return EMPTY_TAX;
  return {
    ncm: tax.ncm ?? "",
    cest: tax.cest ?? "",
    cfopInternal: tax.cfopInternal ?? "",
    cfopInterstate: tax.cfopInterstate ?? "",
    origin: tax.origin ?? "NACIONAL",
    icmsCst: tax.icmsCst ?? "",
    icmsCsosn: tax.icmsCsosn ?? "",
    icmsRate: tax.icmsRate?.toString() ?? "",
    pisCst: tax.pisCst ?? "",
    pisRate: tax.pisRate?.toString() ?? "",
    cofinsCst: tax.cofinsCst ?? "",
    cofinsRate: tax.cofinsRate?.toString() ?? "",
  };
}

function packagesToLevels(packages: ProductPackage[], unitBarcode?: string | null): PackLevel[] {
  let previousFactor = 1;
  return packages
    .filter((pkg) => pkg.factor > 1 || pkg.barcode !== unitBarcode)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.factor - b.factor)
    .map((pkg, index) => {
      const qty = pkg.factor > 0 ? pkg.factor / previousFactor : 0;
      previousFactor = pkg.factor || previousFactor;
      return {
        id: pkg.id,
        packageId: pkg.id,
        label: pkg.label ?? PACK_LABEL_SUGGESTIONS[index] ?? "Embalagem",
        barcode: pkg.barcode,
        qtyPerParent: Number.isFinite(qty) && qty > 0 ? String(qty) : "",
      };
    });
}

export function ProductQuickCreate({
  organizationId,
  categories: initialCategories,
  initialSku,
  initialType,
  suppliers,
  taxRegime,
  product,
  initialPackages = [],
  extraTabs = [],
}: Props) {
  const router = useRouter();
  const ids = useId();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(product);
  // Tipo vem do dropdown de entrada; o seletor some da tela (apenas selo visual).
  const creationType = (
    ["SIMPLE", "KIT", "FRACTIONED", "CUSTOM"].includes(initialType ?? "") ? initialType : "SIMPLE"
  ) as Form["productType"];
  const [categories, setCategories] = useState<CategoryLite[]>(initialCategories);
  const [form, setForm] = useState<Form>(() =>
    product
      ? productToForm(product, initialSku ?? "")
      : { sku: "", ...EMPTY, productType: creationType },
  );
  const [tax, setTax] = useState<TaxForm>(() => taxDataToForm(product?.taxData));
  const [supplierIds, setSupplierIds] = useState<string[]>(() =>
    product?.supplierId ? [product.supplierId] : [],
  );
  const [packLevels, setPackLevels] = useState<PackLevel[]>(() =>
    packagesToLevels(initialPackages, product?.barcode),
  );
  const [tab, setTab] = useState("basico");
  // Modo página única (criação): revela Fiscal + Mais sob demanda.
  const [showMore, setShowMore] = useState(false);
  // Produto simples controla por UN; select de unidade fica escondido até pedir.
  const [showUnitSelect, setShowUnitSelect] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [bcStatus, setBcStatus] = useState<BcStatus>("idle");
  const [bcSuggest, setBcSuggest] = useState<OpenFoodFactsProduct | null>(null);
  const [tags, setTags] = useState<string[]>(() => product?.tags ?? []);
  // Etapa 1 = busca scan-first; Etapa 2 = formulário. Edição entra direto no form.
  const [step, setStep] = useState<"search" | "form">(isEdit ? "form" : "search");
  const [scannerOpen, setScannerOpen] = useState(false);
  // Componentes do combo (apenas criação — na edição usa a aba "Composição")
  const [kitItems, setKitItems] = useState<KitItem[]>(() =>
    (product?.kitComponents ?? []).map((c) => ({
      componentProductId: c.componentProductId,
      name: c.componentProduct.name,
      unit: c.componentProduct.unit,
      quantity: c.quantity.toString(),
    })),
  );
  const [kitQuery, setKitQuery] = useState("");
  const [kitResults, setKitResults] = useState<Array<{ id: string; name: string; unit: string }>>(
    [],
  );
  const [kitSearching, setKitSearching] = useState(false);

  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI" || !taxRegime;

  function setTaxField<K extends keyof TaxForm>(k: K, v: TaxForm[K]) {
    setTax((t) => ({ ...t, [k]: v }));
  }

  function toggleSupplier(id: string) {
    setSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function addPackLevel() {
    setPackLevels((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        label: PACK_LABEL_SUGGESTIONS[prev.length] ?? "Embalagem",
        barcode: "",
        qtyPerParent: "",
      },
    ]);
  }

  function updatePackLevel(id: string, patch: Partial<PackLevel>) {
    setPackLevels((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removePackLevel(id: string) {
    setPackLevels((prev) => prev.filter((l) => l.id !== id));
  }

  // Fator (unidades base) acumulado até o nível i. Unidade = 1.
  function levelFactor(i: number): number {
    let f = 1;
    for (let j = 0; j <= i; j++) f *= Number(packLevels[j]?.qtyPerParent) || 0;
    return f;
  }

  // Maior embalagem cadastrada → para exibir estoque equivalente (ex.: "≈ 10 caixas").
  const topPackIndex = packLevels.length - 1;
  const topPackFactor = topPackIndex >= 0 ? levelFactor(topPackIndex) : 0;
  const topPackLabel = topPackIndex >= 0 ? packLevels[topPackIndex]?.label?.trim() || "" : "";
  function packEquivalent(value: string): string | null {
    const n = Number(value);
    if (!n || !topPackLabel || topPackFactor <= 1) return null;
    const qty = n / topPackFactor;
    const label = topPackLabel.toLowerCase();
    const qtyStr = Number.isInteger(qty)
      ? String(qty)
      : qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    return `≈ ${qtyStr} ${label}${qty === 1 ? "" : "s"}`;
  }

  // Cadastro inline de subcategoria
  const [subcatDialogOpen, setSubcatDialogOpen] = useState(false);
  const [newSubcatParent, setNewSubcatParent] = useState("");
  const [newSubcatName, setNewSubcatName] = useState("");
  const [creatingSubcat, setCreatingSubcat] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /* ── tipo de produto ── */
  const isKit = form.productType === "KIT";
  const isFractioned = form.productType === "FRACTIONED";
  // VARIANT_PARENT é editado via aba própria; aqui tratamos os 3 tipos cadastráveis.
  const unitShort = (form.unit || "UN").toLowerCase();

  /* ── combo/kit: componentes ── */
  function addKitItem(p: { id: string; name: string; unit: string }) {
    setKitItems((prev) =>
      prev.some((it) => it.componentProductId === p.id)
        ? prev
        : [
            ...prev,
            {
              componentProductId: p.id,
              name: p.name,
              unit: p.unit,
              quantity: "1",
            },
          ],
    );
    setKitQuery("");
    setKitResults([]);
  }
  function removeKitItem(id: string) {
    setKitItems((prev) => prev.filter((it) => it.componentProductId !== id));
  }
  function updateKitQty(id: string, quantity: string) {
    setKitItems((prev) =>
      prev.map((it) => (it.componentProductId === id ? { ...it, quantity } : it)),
    );
  }

  // Busca de componentes (debounce simples)
  useEffect(() => {
    if (!isKit) return;
    const q = kitQuery.trim();
    if (q.length < 2) {
      setKitResults([]);
      return;
    }
    let cancelled = false;
    setKitSearching(true);
    const t = setTimeout(() => {
      searchProductsForKitAction(organizationId, q).then((rows) => {
        if (cancelled) return;
        setKitSearching(false);
        setKitResults(rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit })));
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kitQuery, isKit, organizationId]);

  /* ── derived ── */
  const roots = categories.filter((c) => !c.parentId);
  const cost = Number(form.costPrice) || 0;
  const price = Number(form.price) || 0;
  const margin = calcMargin(cost, price);
  const badges = form.subcategoryId
    ? inheritedBadges(resolveInheritedProfile(categories, form.subcategoryId))
    : [];

  /* ── barcode (lookup manual via botão; busca automática vive na Etapa 1) ── */
  const cleanBarcode = form.barcode.replace(/\D/g, "");

  /* ── SKU ao trocar subcategoria (temp/+18 não herdam mais) ── */
  // biome-ignore lint/correctness/useExhaustiveDependencies: regenera ao trocar subcategoria
  useEffect(() => {
    if (!form.subcategoryId) return;
    let cancelled = false;

    if (!isEdit) {
      setSkuLoading(true);
      generateSkuAction(organizationId, form.subcategoryId).then((r) => {
        if (cancelled) return;
        setSkuLoading(false);
        if (r.success) set("sku", r.sku);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [form.subcategoryId]);

  async function doLookup(code: string) {
    setBcStatus("loading");
    setBcSuggest(null);
    const existing = await findProductByBarcodeAction(organizationId, code);
    console.log("[barcode] DB check:", existing);
    if (existing && existing.id !== product?.id) {
      setBcStatus("duplicate");
      toast.error(`Já cadastrado: ${existing.name}`, {
        action: {
          label: "Abrir",
          onClick: () => router.push(`/app/products/${existing.id}`),
        },
      });
      return;
    }
    if (existing && existing.id === product?.id) {
      setBcStatus("idle");
      return;
    }
    const res = await lookupProductByBarcodeAction(code, organizationId);
    console.log("[barcode] API/AI result:", res);
    if (res.success) {
      setBcSuggest(res.data);
      setBcStatus("found");
    } else {
      setBcStatus("not_found");
      nameRef.current?.focus();
    }
  }

  function applySuggestion(p: OpenFoodFactsProduct) {
    // Peso: Cosmos retorna gramas (peso líquido). Form usa kg.
    const weightKg =
      p.weight && p.weight > 0 ? (p.weight / 1000).toFixed(3).replace(/\.?0+$/, "") : undefined;

    setForm((f) => ({
      ...f,
      name: p.name || f.name,
      shortName: p.shortName || f.shortName,
      brand: p.brand ?? f.brand,
      imageUrl: p.imageUrl ?? f.imageUrl,
      subcategoryId: p.categoryId || f.subcategoryId,
      description: p.description || f.description,
      // estoque / embalagem de compra
      unit: p.suggestedUnit || f.unit,
      packUnit: p.suggestedPackUnit || f.packUnit,
      packSize: p.suggestedPackSize ? String(p.suggestedPackSize) : f.packSize,
      weight: weightKg ?? f.weight,
      // preço de venda sugerido (média de mercado) — só se vazio
      price: f.price || (p.suggestedPrice ? p.suggestedPrice.toFixed(2) : f.price),
    }));

    // Embalagens de compra (fardo/caixa) → níveis com EAN + qtd
    if (p.packagingLevels?.length) {
      let prevTotal = 1;
      const levels: PackLevel[] = p.packagingLevels.map((lvl) => {
        const qty = prevTotal > 0 ? Math.round(lvl.totalUnits / prevTotal) : lvl.totalUnits;
        prevTotal = lvl.totalUnits;
        return {
          id: Math.random().toString(36).slice(2),
          label: lvl.label,
          barcode: lvl.barcode,
          qtyPerParent: qty > 0 ? String(qty) : "",
        };
      });
      setPackLevels(levels);
    }

    // Fiscal: NCM/CEST/CFOP/origem/CST — só preenche campos vazios ou vindos da busca
    setTax((t) => ({
      ...t,
      ncm: (p.ncm ?? "").replace(/\D/g, "").slice(0, 8) || t.ncm,
      cest: (p.cest ?? "").replace(/\D/g, "").slice(0, 7) || t.cest,
      cfopInternal: (p.cfopInternal ?? "").replace(/\D/g, "").slice(0, 4) || t.cfopInternal,
      cfopInterstate: (p.cfopInterstate ?? "").replace(/\D/g, "").slice(0, 4) || t.cfopInterstate,
      origin: p.origin || t.origin,
      // respeita regime: Simples → CSOSN, Normal → CST
      icmsCsosn: isSimples ? p.icmsCsosn || t.icmsCsosn : t.icmsCsosn,
      icmsCst: isSimples ? t.icmsCst : p.icmsCst || t.icmsCst,
      pisCst: p.pisCst || t.pisCst,
      cofinsCst: p.cofinsCst || t.cofinsCst,
    }));

    // Regras de venda / armazenagem derivadas (agora campos do próprio produto)
    if (p.minimumAge && p.minimumAge >= 18) set("hasAgeRestriction", true);
    if (p.storageTemperature) set("storageTemperature", p.storageTemperature);

    // Tags: existentes sugeridas + novas + atributos derivados (sabor)
    const derived = [
      ...(p.tags ?? []),
      p.flavor,
      // Só marca "Alcoólico" quando relevante — "Não Alcoólico" virava ruído em todo produto.
      p.containsAlcohol === true ? "Alcoólico" : undefined,
    ].filter((t): t is string => Boolean(t?.trim()));
    if (derived.length) {
      setTags((prev) => Array.from(new Set([...prev, ...derived])));
    }

    setBcSuggest(null);
    setBcStatus("idle");
    const extras = [
      p.ncm && "fiscal",
      p.packagingLevels?.length && "embalagens",
      p.suggestedPrice && "preço",
      tags.length && "tags",
    ].filter(Boolean);
    toast.success(
      extras.length
        ? `Preenchido (incl. ${extras.join(", ")}). Revise antes de salvar.`
        : "Preenchido pela busca. Revise antes de salvar.",
    );
  }

  async function regenerateSku() {
    setSkuLoading(true);
    const r = form.subcategoryId
      ? await generateSkuAction(organizationId, form.subcategoryId)
      : await generateNextSkuAction(organizationId);
    setSkuLoading(false);
    if (r.success) set("sku", r.sku);
  }

  function openSubcatDialog() {
    const root = categories.find((c) => c.id === form.subcategoryId)?.parentId ?? "";
    setNewSubcatParent(root || roots[0]?.id || "");
    setNewSubcatName("");
    setSubcatDialogOpen(true);
  }

  async function createSubcategory() {
    if (!newSubcatParent) return toast.error("Selecione a categoria.");
    if (!newSubcatName.trim()) return toast.error("Informe o nome da subcategoria.");
    setCreatingSubcat(true);
    try {
      const res = await createCategoryAction(organizationId, {
        name: newSubcatName.trim(),
        parentId: newSubcatParent,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const created: CategoryLite = {
        id: res.data.id,
        name: newSubcatName.trim(),
        parentId: newSubcatParent,
      };
      setCategories((prev) => [...prev, created]);
      set("subcategoryId", created.id);
      setSubcatDialogOpen(false);
      toast.success("Subcategoria criada.");
    } finally {
      setCreatingSubcat(false);
    }
  }

  /* ── validation ── */
  function validate(): string | null {
    // Combo pode não ter EAN; demais tipos exigem código de barras.
    if (!isKit && cleanBarcode.length < 8)
      return "Informe um código de barras válido (mín. 8 dígitos).";
    if (!form.name.trim()) return "Informe o nome do produto.";
    if (!form.subcategoryId) return "Selecione a subcategoria.";
    if (price <= 0) return "Informe o preço de venda.";
    if (isFractioned && (Number(form.conversionFactor) || 0) <= 0)
      return "Fator de conversão deve ser maior que zero.";
    if (isKit && !isEdit && kitItems.length === 0)
      return "Adicione ao menos um componente ao combo.";
    return null;
  }

  /* ── submit ── */
  function submit(mode: "list" | "ficha" | "new") {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const brand = form.brand.trim() ? normalizeBrandName(form.brand) : "";
    startTransition(async () => {
      // Grava a marca no catálogo (cria se não existir)
      if (brand) await upsertBrandAction(organizationId, brand);

      let sku = form.sku;
      // Tipo é imutável na edição; na criação vem do seletor.
      const productType = (
        isEdit ? (product?.productType ?? form.productType) : form.productType
      ) as ProductInput["productType"];
      const fractioned = productType === "FRACTIONED";
      const build = (s: string): ProductInput => ({
        name: form.name.trim(),
        posName: form.shortName.trim() || undefined,
        brand: brand || undefined,
        sku: s || undefined,
        barcode: cleanBarcode,
        tags,
        productType,
        unit: form.unit as ProductInput["unit"],
        // Não-fracionado vende na própria unidade de estoque (fator 1).
        saleUnit: (fractioned ? form.saleUnit : form.unit) as ProductInput["saleUnit"],
        conversionFactor: fractioned ? Number(form.conversionFactor) || 1 : 1,
        packUnit: (form.packUnit || undefined) as ProductInput["packUnit"],
        packSize: form.packSize ? Number(form.packSize) : undefined,
        price,
        costPrice: cost > 0 ? cost : undefined,
        imageUrl: form.imageUrl || undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        height: form.height ? Number(form.height) : undefined,
        width: form.width ? Number(form.width) : undefined,
        length: form.length ? Number(form.length) : undefined,
        stockMin: form.stockMin ? Number(form.stockMin) : undefined,
        stockIdeal: form.stockIdeal ? Number(form.stockIdeal) : undefined,
        location: form.location || undefined,
        description: form.description || undefined,
        categoryId: form.subcategoryId,
        supplierId: supplierIds[0] || undefined,
        isActive: form.isActive,
        hasAgeRestriction: form.hasAgeRestriction,
        minAge: form.hasAgeRestriction ? 18 : undefined,
        storageTemperature: form.storageTemperature || undefined,
      });

      let res = isEdit
        ? await updateProductAction(organizationId, product?.id ?? "", build(sku))
        : await createProductAction(organizationId, build(sku));
      // SKU colidiu (corrida) → regenera e tenta 1×
      if (!isEdit && !res.success && /SKU/i.test(res.error)) {
        const r = form.subcategoryId
          ? await generateSkuAction(organizationId, form.subcategoryId)
          : await generateNextSkuAction(organizationId);
        if (r.success) {
          sku = r.sku;
          res = await createProductAction(organizationId, build(sku));
        }
      }
      if (!res.success) {
        toast.error(res.error);
        return;
      }

      // Fiscal opcional — só grava se NCM (8 dígitos) preenchido
      const productId = isEdit ? (product?.id ?? "") : (res.data?.id ?? "");

      // Combo: grava composição na criação (edição usa a aba "Composição")
      if (productType === "KIT" && !isEdit && kitItems.length > 0) {
        const kres = await setKitComponentsAction(
          organizationId,
          productId,
          kitItems.map((it, i) => ({
            componentProductId: it.componentProductId,
            quantity: Number(it.quantity) || 1,
            position: i,
          })),
        );
        if (!kres.success) {
          toast.error(`Produto criado, mas a composição falhou: ${kres.error}`);
        }
      }

      const ncmDigits = tax.ncm.replace(/\D/g, "");
      if (ncmDigits.length === 8) {
        const tres = await setProductTaxAction(organizationId, {
          productId,
          ncm: ncmDigits,
          cest: tax.cest || undefined,
          cfopInternal: tax.cfopInternal || undefined,
          cfopInterstate: tax.cfopInterstate || undefined,
          origin: tax.origin as never,
          icmsCst: (isSimples ? undefined : tax.icmsCst || undefined) as never,
          icmsCsosn: (isSimples ? tax.icmsCsosn || undefined : undefined) as never,
          icmsRate: tax.icmsRate ? Number(tax.icmsRate) : undefined,
          pisCst: tax.pisCst || undefined,
          pisRate: tax.pisRate ? Number(tax.pisRate) : undefined,
          cofinsCst: tax.cofinsCst || undefined,
          cofinsRate: tax.cofinsRate ? Number(tax.cofinsRate) : undefined,
          unitTaxable: true,
        });
        if (!tres.success) {
          toast.error(`Produto criado, mas o fiscal falhou: ${tres.error}`);
        }
      }

      // Fornecedores (multi) — 1º vira o principal
      if (supplierIds.length > 0) {
        await setProductSuppliersAction(organizationId, productId, supplierIds, {
          code: sku || cleanBarcode,
          name: form.name.trim(),
        });
      }

      // Embalagens (níveis acima da unidade) → ProductBarcode com fator acumulado
      let cumulative = 1;
      for (let i = 0; i < packLevels.length; i++) {
        const lvl = packLevels[i];
        if (!lvl) continue;
        const qty = Number(lvl.qtyPerParent) || 0;
        const bc = lvl.barcode.replace(/\D/g, "");
        cumulative *= qty;
        if (qty > 0 && bc.length >= 8 && cumulative > 0) {
          await upsertProductPackageAction(organizationId, productId, {
            id: lvl.packageId,
            barcode: bc,
            label: lvl.label.trim() || `Nível ${i + 1}`,
            factor: cumulative,
            sortOrder: i + 1,
          });
        }
      }

      if (isEdit) {
        const keptPackageIds = new Set(packLevels.map((lvl) => lvl.packageId).filter(Boolean));
        for (const pkg of initialPackages) {
          const isUnitBarcode = pkg.factor <= 1 && pkg.barcode === product?.barcode;
          if (!isUnitBarcode && !keptPackageIds.has(pkg.id)) {
            await deleteProductPackageAction(pkg.id);
          }
        }

        toast.success("Produto atualizado.");
        router.refresh();
        return;
      }

      toast.success("Produto criado.");
      if (mode === "ficha") {
        router.push(`/app/products/${productId}`);
        return;
      }
      if (mode === "new") {
        const next = await generateNextSkuAction(organizationId);
        setForm({
          sku: next.success ? next.sku : "",
          ...EMPTY,
          productType: creationType,
        });
        setTax(EMPTY_TAX);
        setTags([]);
        setSupplierIds([]);
        setPackLevels([]);
        setKitItems([]);
        setKitQuery("");
        setKitResults([]);
        setTab("basico");
        setBcStatus("idle");
        setBcSuggest(null);
        setStep("search");
        return;
      }
      router.push("/app/products");
    });
  }

  const isLoading = bcStatus === "loading";

  /* ── Etapa 1: busca scan-first ── */
  if (step === "search") {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/app/products")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Voltar para produtos"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="flex-1 text-lg font-semibold tracking-tight">Novo Produto</h1>
        </div>

        <BarcodeSearchStep
          organizationId={organizationId}
          onOpenExisting={(id) => router.push(`/app/products/${id}`)}
          onUse={(p) => {
            set("barcode", p.barcode);
            applySuggestion(p);
            setStep("form");
            setTab("basico");
          }}
          onManual={(bc) => {
            if (bc) set("barcode", bc);
            setStep("form");
            setTab("basico");
            setTimeout(() => nameRef.current?.focus(), 50);
          }}
        />
      </div>
    );
  }

  /* ── Etapa 2: formulário (revisão) ── */
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(isEdit ? "ficha" : "list");
      }}
      className="mx-auto flex w-full max-w-7xl flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (isEdit) router.push("/app/products");
            else setStep("search");
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isEdit ? "Voltar para produtos" : "Voltar para a busca"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-lg font-semibold tracking-tight">
          {isEdit ? "Editar Produto" : "Novo Produto"}
        </h1>
      </div>

      {!isEdit && (
        <ProductHeader
          name={form.name}
          brand={form.brand}
          barcode={form.barcode}
          imageUrl={form.imageUrl}
          price={price}
          margin={margin}
        />
      )}

      <Tabs
        value={tab}
        onValueChange={setTab}
        expandAll={!isEdit}
        className={isEdit ? "gap-0" : "gap-12"}
      >
        {isEdit && (
          <TabsList variant="underline">
            <TabsTrigger value="basico" variant="underline">
              Básico
            </TabsTrigger>
            <TabsTrigger
              value="estoque"
              variant="underline"
              icon={<Package className="h-3.5 w-3.5" />}
            >
              Estoque
            </TabsTrigger>
            <TabsTrigger
              value="fiscal"
              variant="underline"
              icon={<Receipt className="h-3.5 w-3.5" />}
            >
              Fiscal
            </TabsTrigger>
            <TabsTrigger value="mais" variant="underline">
              Mais
            </TabsTrigger>
            {extraTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} variant="underline" badge={t.badge}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        <TabsContent value="basico" className="pt-6">
          {/* Body: 2 columns */}
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-[minmax(0,1fr)_340px]">
            {/* Left: form */}
            <div className="flex flex-col gap-8">
              {/* Identificação */}
              <section className="flex flex-col gap-5">
                <SectionTitle>Identificação</SectionTitle>

                {/* EAN — primeiro input */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-ean`}>
                    Código de barras (EAN) <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id={`${ids}-ean`}
                        inputMode="numeric"
                        value={form.barcode}
                        onChange={(e) => {
                          set("barcode", e.target.value);
                          if (bcStatus !== "idle") {
                            setBcStatus("idle");
                            setBcSuggest(null);
                          }
                        }}
                        placeholder="Escaneie ou digite o EAN"
                        aria-describedby={`${ids}-ean-status`}
                        className={cn(
                          "pr-9 font-mono",
                          bcStatus === "found" && "border-success",
                          bcStatus === "duplicate" && "border-warning",
                        )}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <ScanLine className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setScannerOpen(true)}
                      aria-label="Escanear com a câmera"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={cleanBarcode.length < 8 || isLoading}
                      onClick={() => doLookup(cleanBarcode)}
                      aria-label="Buscar dados pelo EAN"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                  <p id={`${ids}-ean-status`} className="min-h-4 text-xs text-muted-foreground">
                    {isLoading && "Consultando catálogo…"}
                    {bcStatus === "not_found" && "Não encontrado — preencha manualmente."}
                  </p>

                  {bcStatus === "found" && bcSuggest && (
                    <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-soft/40 p-3">
                      {bcSuggest.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bcSuggest.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-md border border-border bg-white object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 text-muted-foreground/50">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{bcSuggest.name}</p>
                        {bcSuggest.brand && (
                          <p className="truncate text-xs text-muted-foreground">
                            {bcSuggest.brand}
                          </p>
                        )}
                        {bcSuggest.category && (
                          <p className="truncate text-xs text-muted-foreground/70">
                            {bcSuggest.category}
                          </p>
                        )}
                      </div>
                      <Button type="button" size="sm" onClick={() => applySuggestion(bcSuggest)}>
                        Usar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Nome + Marca — mesma linha */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-name`}>
                      Nome do produto <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      ref={nameRef}
                      id={`${ids}-name`}
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Ex: Coca-Cola Lata 350ml"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-brand`}>Marca</Label>
                    <BrandCombobox
                      id={`${ids}-brand`}
                      organizationId={organizationId}
                      value={form.brand}
                      onChange={(v) => set("brand", v)}
                    />
                  </div>
                </div>

                {/* Nome curto (PDV / cupom) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${ids}-shortname`}>Nome curto (PDV / cupom)</Label>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        form.shortName.length > 40
                          ? "text-destructive"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {form.shortName.length}/40
                    </span>
                  </div>
                  <Input
                    id={`${ids}-shortname`}
                    value={form.shortName}
                    onChange={(e) => set("shortName", e.target.value.slice(0, 40))}
                    placeholder="Ex: COCA-COLA LT 350ML"
                    autoComplete="off"
                    maxLength={40}
                    className="font-mono uppercase"
                  />
                </div>

                {/* Subcategoria + SKU — mesma linha */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Subcategoria — único select, agrupado por categoria */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${ids}-subcat`}>
                        Subcategoria <span className="text-destructive">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={openSubcatDialog}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition hover:underline"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        Nova subcategoria
                      </button>
                    </div>
                    <Select
                      id={`${ids}-subcat`}
                      value={form.subcategoryId}
                      onChange={(e) => set("subcategoryId", e.target.value)}
                    >
                      <option value="">Selecione a subcategoria…</option>
                      {roots.map((root) => {
                        const kids = categories.filter((c) => c.parentId === root.id);
                        if (kids.length === 0) return null;
                        return (
                          <optgroup key={root.id} label={root.name}>
                            {kids.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </Select>
                  </div>

                  {/* SKU — gerado automaticamente, editável */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-sku`}>SKU</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`${ids}-sku`}
                          value={form.sku}
                          onChange={(e) => set("sku", e.target.value)}
                          placeholder="Gerado automaticamente"
                          autoComplete="off"
                          className="pr-9 font-mono"
                        />
                        {skuLoading && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={regenerateSku}
                        disabled={skuLoading}
                        aria-label="Gerar novo SKU"
                        title="Gerar novo SKU"
                      >
                        <RefreshCw className={cn("h-4 w-4", skuLoading && "animate-spin")} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard?.writeText(form.sku);
                          toast.success("SKU copiado.");
                        }}
                        aria-label="Copiar SKU"
                        title="Copiar SKU"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Inherited badges */}
                {badges.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Herdado da subcategoria:</span>
                    {badges.map((b) => {
                      const Icon = BADGE_ICON[b.kind];
                      return (
                        <Badge key={b.kind} variant="secondary" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {b.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Precificação */}
              <section className="flex flex-col gap-5">
                <SectionTitle>Precificação</SectionTitle>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-cost`}>Preço de compra</Label>
                    <MoneyInput
                      id={`${ids}-cost`}
                      value={form.costPrice}
                      onChange={(v) => set("costPrice", v)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${ids}-price`}>
                        Preço de venda <span className="text-destructive">*</span>
                      </Label>
                      {margin !== null && (
                        <Badge variant={margin < 0 ? "destructive" : "success"}>
                          Margem {margin.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <MoneyInput
                      id={`${ids}-price`}
                      value={form.price}
                      onChange={(v) => set("price", v)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Right: image */}
            <aside className="flex flex-col gap-2 md:sticky md:top-6 md:self-start">
              <span className="text-xs font-medium text-muted-foreground">Imagem do produto</span>
              <ImageCard value={form.imageUrl} onChange={(v) => set("imageUrl", v)} />
              {/* Tipo do cadastro — apenas visual (definido no dropdown de entrada) */}
              {(() => {
                const typeOpt = PRODUCT_TYPE_OPTIONS.find((o) => o.value === form.productType);
                if (!typeOpt) return null;
                const TypeIcon = typeOpt.icon;
                return (
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-1/40 px-3 py-2 text-xs text-muted-foreground">
                    <TypeIcon className="h-3.5 w-3.5" />
                    <span>
                      Tipo de cadastro:{" "}
                      <span className="font-medium text-foreground">{typeOpt.label}</span>
                    </span>
                  </div>
                );
              })()}
            </aside>
          </div>
        </TabsContent>

        {/* ── ESTOQUE ─────────────────────────────────────────── */}
        <TabsContent value="estoque" className="flex flex-col gap-8 pt-6">
          {!isEdit && <StackHeading icon={Package} title="Estoque e embalagens" />}
          {isKit ? (
            <section className="flex flex-col gap-4">
              <SectionTitle>Composição do combo</SectionTitle>
              <p className="text-xs text-muted-foreground">
                O combo não tem estoque próprio. Ao vender, baixa o estoque de cada componente
                (RN-C03). Componentes não podem ser outros combos (RN-C04).
              </p>

              {isEdit ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  {kitItems.length > 0
                    ? `${kitItems.length} componente${kitItems.length !== 1 ? "s" : ""} — gerencie na aba “Composição”.`
                    : "Gerencie os componentes na aba “Composição”."}
                </div>
              ) : (
                <>
                  {/* Busca de produtos para compor o combo */}
                  <div className="relative w-full sm:max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={kitQuery}
                      onChange={(e) => setKitQuery(e.target.value)}
                      placeholder="Buscar produto por nome, SKU ou EAN…"
                      className="pl-9"
                    />
                    {(kitResults.length > 0 || kitSearching) && kitQuery.trim().length >= 2 && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card shadow-md">
                        {kitSearching && kitResults.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
                        ) : (
                          kitResults.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => addKitItem(r)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-1"
                            >
                              <span className="truncate">{r.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {r.unit.toLowerCase()}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Componentes selecionados */}
                  {kitItems.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-border">
                      {kitItems.map((it, i) => (
                        <div
                          key={it.componentProductId}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3",
                            i !== 0 && "border-t border-border",
                          )}
                        >
                          <Layers className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{it.name}</p>
                          </div>
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={it.quantity}
                            onChange={(e) => updateKitQty(it.componentProductId, e.target.value)}
                            className="h-8 w-20 text-right font-mono text-sm"
                          />
                          <span className="w-8 shrink-0 text-xs text-muted-foreground">
                            {it.unit.toLowerCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeKitItem(it.componentProductId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-1 hover:text-destructive"
                            aria-label="Remover componente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
                      <Layers className="mb-3 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">Combo vazio</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Busque acima e adicione os produtos que compõem este combo.
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <>
              <section className="flex flex-col gap-5">
                <SectionTitle>Unidade de controle</SectionTitle>

                {/* Produto simples: controle em UN. Select só aparece se pedir (ou fracionado/edição). */}
                {(isFractioned || isEdit || showUnitSelect) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${ids}-unit`}>Unidade de estoque</Label>
                      <Select
                        id={`${ids}-unit`}
                        value={form.unit}
                        onChange={(e) => set("unit", e.target.value)}
                      >
                        {UNIT_SELECT.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Unidade base de controle do estoque — normalmente a menor unidade de
                        venda/consumo (ex.: UN). Fardos e caixas de compra são configurados em
                        “Embalagens” abaixo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Destaque permanente da unidade de controle */}
                <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3">
                  <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 text-xs">
                    <p className="font-medium text-foreground">
                      Vendido e controlado por{" "}
                      <span className="font-mono uppercase">{form.unit || "UN"}</span>
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Estoque, mínimo, ideal, relatórios e alertas usam{" "}
                      <span className="font-mono uppercase">{form.unit || "UN"}</span>. Como você{" "}
                      <strong>compra</strong> (fardo, caixa…) vai em “Embalagens” abaixo e é
                      convertido automaticamente.
                    </p>
                  </div>
                  {!isFractioned && !isEdit && !showUnitSelect && (
                    <button
                      type="button"
                      onClick={() => setShowUnitSelect(true)}
                      className="shrink-0 text-xs font-medium text-primary transition hover:underline"
                    >
                      Alterar unidade
                    </button>
                  )}
                </div>

                {isFractioned && (
                  <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-xs text-muted-foreground">
                      Produto fracionado: estoque em uma unidade, venda em outra. Ex.: estoque em
                      KG, vendido em gramas (fator = 0,001).
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${ids}-saleunit`}>Unidade de venda</Label>
                        <Select
                          id={`${ids}-saleunit`}
                          value={form.saleUnit}
                          onChange={(e) => set("saleUnit", e.target.value)}
                        >
                          {UNIT_SELECT.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${ids}-factor`}>Fator de conversão</Label>
                        <Input
                          id={`${ids}-factor`}
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={form.conversionFactor}
                          onChange={(e) => set("conversionFactor", e.target.value)}
                          placeholder="1"
                        />
                        <p className="text-xs text-muted-foreground">estoque = venda × fator</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Embalagens — níveis (Unidade → Fardo → Caixa…) com código + qtd */}
              <section className="flex flex-col gap-3">
                <SectionTitle>Como você compra (embalagens)</SectionTitle>
                <p className="text-xs text-muted-foreground">
                  Fardo, caixa, pacote… Cada nível tem seu código de barras (se houver) e quantos
                  itens do nível abaixo cabem nele. A última coluna mostra a equivalência na unidade
                  de controle (<span className="font-mono uppercase">{form.unit || "UN"}</span>
                  ), convertida automaticamente em compras, vendas e movimentações.
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[1.1fr_1.6fr_0.9fr_0.8fr_auto] gap-2 bg-surface-1/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Embalagem</span>
                    <span>Código de barras</span>
                    <span>Contém</span>
                    <span className="text-right">= {(form.unit || "UN").toUpperCase()}</span>
                    <span />
                  </div>

                  {/* Unidade — fixa, usa o EAN do produto */}
                  <div className="grid grid-cols-[1.1fr_1.6fr_0.9fr_0.8fr_auto] items-center gap-2 border-t border-border px-3 py-2 text-sm">
                    <span className="font-medium">Unidade</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {cleanBarcode || "— informe o EAN na aba Básico"}
                    </span>
                    <span className="text-muted-foreground">1</span>
                    <span className="text-right tabular-nums">1</span>
                    <span />
                  </div>

                  {packLevels.map((lvl, i) => {
                    const factor = levelFactor(i);
                    const belowLabel =
                      i === 0 ? "un" : (packLevels[i - 1]?.label.toLowerCase() ?? "un");
                    return (
                      <div
                        key={lvl.id}
                        className="grid grid-cols-[1.1fr_1.6fr_0.9fr_0.8fr_auto] items-center gap-2 border-t border-border px-3 py-2"
                      >
                        <Input
                          value={lvl.label}
                          onChange={(e) => updatePackLevel(lvl.id, { label: e.target.value })}
                          placeholder="Fardo"
                          className="h-9"
                        />
                        <Input
                          value={lvl.barcode}
                          onChange={(e) =>
                            updatePackLevel(lvl.id, {
                              barcode: e.target.value.replace(/\D/g, "").slice(0, 14),
                            })
                          }
                          placeholder="Código de barras"
                          inputMode="numeric"
                          className="h-9 font-mono"
                        />
                        <Input
                          value={lvl.qtyPerParent}
                          onChange={(e) =>
                            updatePackLevel(lvl.id, {
                              qtyPerParent: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          placeholder={`${belowLabel}`}
                          inputMode="numeric"
                          className="h-9"
                          title={`Quantos ${belowLabel} cabem em 1 ${lvl.label || "embalagem"}`}
                        />
                        <span className="text-right text-sm tabular-nums">
                          {factor > 0 ? factor : "—"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePackLevel(lvl.id)}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-1 hover:text-destructive"
                          aria-label="Remover nível"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit cursor-pointer gap-1.5"
                  onClick={addPackLevel}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar embalagem
                </Button>
              </section>

              <section className="flex flex-col gap-5">
                <SectionTitle>Controle de estoque</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-stockmin`}>Estoque mínimo ({unitShort})</Label>
                    <Input
                      id={`${ids}-stockmin`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={form.stockMin}
                      onChange={(e) => set("stockMin", e.target.value)}
                      placeholder="Ponto de reposição"
                    />
                    {packEquivalent(form.stockMin) && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {packEquivalent(form.stockMin)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-stockideal`}>Estoque ideal ({unitShort})</Label>
                    <Input
                      id={`${ids}-stockideal`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={form.stockIdeal}
                      onChange={(e) => set("stockIdeal", e.target.value)}
                      placeholder="Nível alvo de reposição"
                    />
                    {packEquivalent(form.stockIdeal) && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {packEquivalent(form.stockIdeal)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-location`}>Localização</Label>
                    <Input
                      id={`${ids}-location`}
                      value={form.location}
                      onChange={(e) => set("location", e.target.value)}
                      placeholder="Corredor / prateleira"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo (ponto de reposição) e ideal (nível alvo) sempre na unidade base de estoque
                  ({unitShort}), nunca em caixas/fardos.
                </p>
              </section>
            </>
          )}

          {suppliers.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>Fornecedores</SectionTitle>
              <p className="text-xs text-muted-foreground">
                Marque um ou mais. O primeiro selecionado vira o fornecedor principal.
              </p>
              <div className="flex flex-wrap gap-2">
                {suppliers.map((s) => {
                  const active = supplierIds.includes(s.id);
                  const order = supplierIds.indexOf(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSupplier(s.id)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 font-medium text-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                      )}
                    >
                      {active && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          {order + 1}
                        </span>
                      )}
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-5">
            <SectionTitle>Logística</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-weight`}>Peso (kg)</Label>
                <Input
                  id={`${ids}-weight`}
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.weight}
                  onChange={(e) => set("weight", e.target.value)}
                  placeholder="0.000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-height`}>Altura (cm)</Label>
                <Input
                  id={`${ids}-height`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.height}
                  onChange={(e) => set("height", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-width`}>Largura (cm)</Label>
                <Input
                  id={`${ids}-width`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.width}
                  onChange={(e) => set("width", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-length`}>Comprimento (cm)</Label>
                <Input
                  id={`${ids}-length`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.length}
                  onChange={(e) => set("length", e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </section>
        </TabsContent>

        {!isEdit && !showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-border bg-surface-1/30 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-surface-1/60"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Receipt className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">Mais opções (opcional)</span>
                <span className="block text-xs text-muted-foreground">
                  Fiscal, descrição, tags, armazenagem e regras de venda
                </span>
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {(isEdit || showMore) && (
          <>
            {!isEdit && (
              <StackHeading
                icon={Receipt}
                title="Fiscal"
                hint="Em geral já vem preenchido pela busca. Opcional — só grava com NCM válido (8 dígitos)."
              />
            )}

            {/* ── FISCAL ──────────────────────────────────────────── */}
            <TabsContent value="fiscal" className="flex flex-col gap-6 pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-ncm`}>NCM (8 dígitos)</Label>
                  <Input
                    id={`${ids}-ncm`}
                    value={tax.ncm}
                    onChange={(e) =>
                      setTaxField("ncm", e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    placeholder="Informe o NCM (8 dígitos)"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-cest`}>CEST (7 dígitos)</Label>
                  <Input
                    id={`${ids}-cest`}
                    value={tax.cest}
                    onChange={(e) =>
                      setTaxField("cest", e.target.value.replace(/\D/g, "").slice(0, 7))
                    }
                    placeholder="7 dígitos (opcional)"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-cfop-int`}>CFOP interno</Label>
                  <Input
                    id={`${ids}-cfop-int`}
                    value={tax.cfopInternal}
                    onChange={(e) =>
                      setTaxField("cfopInternal", e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="4 dígitos (mesma UF)"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-cfop-est`}>CFOP interestadual</Label>
                  <Input
                    id={`${ids}-cfop-est`}
                    value={tax.cfopInterstate}
                    onChange={(e) =>
                      setTaxField("cfopInterstate", e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="4 dígitos (outra UF)"
                    inputMode="numeric"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-origin`}>Origem</Label>
                <Select
                  id={`${ids}-origin`}
                  value={tax.origin}
                  onChange={(e) => setTaxField("origin", e.target.value)}
                >
                  {TAX_ORIGIN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-icms-cst`}>{isSimples ? "ICMS CSOSN" : "ICMS CST"}</Label>
                  <Select
                    id={`${ids}-icms-cst`}
                    value={isSimples ? tax.icmsCsosn : tax.icmsCst}
                    onChange={(e) =>
                      isSimples
                        ? setTaxField("icmsCsosn", e.target.value)
                        : setTaxField("icmsCst", e.target.value)
                    }
                  >
                    <option value="">Selecionar…</option>
                    {(isSimples ? ICMS_CSOSN_OPTIONS : ICMS_CST_OPTIONS).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-icms-rate`}>Alíquota ICMS (%)</Label>
                  <Input
                    id={`${ids}-icms-rate`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={tax.icmsRate}
                    onChange={(e) => setTaxField("icmsRate", e.target.value)}
                    placeholder="% — ex. 18"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-pis-cst`}>PIS CST</Label>
                  <Select
                    id={`${ids}-pis-cst`}
                    value={tax.pisCst}
                    onChange={(e) => setTaxField("pisCst", e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {PIS_COFINS_CST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-pis-rate`}>Alíquota PIS (%)</Label>
                  <Input
                    id={`${ids}-pis-rate`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    value={tax.pisRate}
                    onChange={(e) => setTaxField("pisRate", e.target.value)}
                    placeholder="% — ex. 0,65"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-cofins-cst`}>COFINS CST</Label>
                  <Select
                    id={`${ids}-cofins-cst`}
                    value={tax.cofinsCst}
                    onChange={(e) => setTaxField("cofinsCst", e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {PIS_COFINS_CST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${ids}-cofins-rate`}>Alíquota COFINS (%)</Label>
                  <Input
                    id={`${ids}-cofins-rate`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.0001"
                    value={tax.cofinsRate}
                    onChange={(e) => setTaxField("cofinsRate", e.target.value)}
                    placeholder="% — ex. 3,00"
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── MAIS ────────────────────────────────────────────── */}
            <TabsContent value="mais" className="flex flex-col gap-8 pt-6">
              <section className="flex flex-col gap-5">
                <SectionTitle>Descrição</SectionTitle>
                <textarea
                  id={`${ids}-desc`}
                  rows={4}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Descrição opcional do produto…"
                  className="flex w-full resize-none rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </section>

              <section className="flex flex-col gap-3">
                <SectionTitle>Tags</SectionTitle>
                <p className="text-xs text-muted-foreground">
                  Usadas em busca, filtros e promoções. A busca por EAN sugere automaticamente.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-sm"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label={`Remover tag ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    id={`${ids}-tag`}
                    placeholder="Adicionar tag + Enter"
                    autoComplete="off"
                    className="h-8 w-44"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = e.currentTarget.value.trim();
                        if (v) setTags((prev) => Array.from(new Set([...prev, v])));
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <SectionTitle>Armazenagem</SectionTitle>
                <p className="text-xs text-muted-foreground">
                  Temperatura própria do produto (preenchida pela busca, editável).
                </p>
                <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                  {TEMP_PRODUCT_OPTIONS.map((opt) => {
                    const active = form.storageTemperature === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("storageTemperature", active ? "" : opt.value)}
                        className={cn(
                          "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 font-medium text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        <span>{opt.emoji}</span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="flex flex-col gap-5">
                <SectionTitle>Regras de venda</SectionTitle>
                <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 transition-colors hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={form.hasAgeRestriction}
                    onChange={(e) => set("hasAgeRestriction", e.target.checked)}
                    className="h-4 w-4 rounded border border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Restrição de idade (+18)</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Exige verificação de maioridade na venda
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 transition-colors hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set("isActive", e.target.checked)}
                    className="h-4 w-4 rounded border border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Produto ativo</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Produto inativo não aparece nas vendas
                    </p>
                  </div>
                </label>
              </section>
            </TabsContent>
          </>
        )}

        {extraTabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="pt-6">
            {t.content}
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer */}
      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/85 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push("/app/products")}
        >
          Cancelar
        </Button>

        {/* Split-button: ação primária + dropdown com alternativas */}
        <div className="flex items-stretch">
          <Button
            type="submit"
            disabled={isPending}
            className={cn("gap-1.5", !isEdit && "rounded-r-none")}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isEdit ? "Salvar alterações" : "Salvar produto"}
          </Button>
          {!isEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  disabled={isPending}
                  aria-label="Mais opções de salvamento"
                  className="rounded-l-none border-l border-primary-foreground/20 px-2"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => submit("ficha")} className="cursor-pointer gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>Salvar e abrir ficha completa</span>
                    <span className="text-xs text-muted-foreground">
                      Estoque, fiscal, fornecedor e mais
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => submit("new")} className="cursor-pointer gap-2">
                  <PlusCircle className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>Salvar e cadastrar outro</span>
                    <span className="text-xs text-muted-foreground">
                      Limpa o formulário e gera novo SKU
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onScanned={(code) => {
            setScannerOpen(false);
            set("barcode", code);
            doLookup(code.replace(/\D/g, ""));
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <Dialog
        open={subcatDialogOpen}
        onOpenChange={(o) => !creatingSubcat && setSubcatDialogOpen(o)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova subcategoria</DialogTitle>
            <DialogDescription>
              Cadastre uma subcategoria dentro de uma categoria existente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-newsubcat-parent`}>
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Select
                id={`${ids}-newsubcat-parent`}
                value={newSubcatParent}
                onChange={(e) => setNewSubcatParent(e.target.value)}
              >
                <option value="">Selecione a categoria…</option>
                {roots.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-newsubcat-name`}>
                Nome da subcategoria <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${ids}-newsubcat-name`}
                value={newSubcatName}
                onChange={(e) => setNewSubcatName(e.target.value)}
                placeholder="Ex: Refrigerantes"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createSubcategory();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={creatingSubcat}
              onClick={() => setSubcatDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creatingSubcat}
              className="gap-1.5"
              onClick={createSubcategory}
            >
              {creatingSubcat ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              Criar subcategoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
