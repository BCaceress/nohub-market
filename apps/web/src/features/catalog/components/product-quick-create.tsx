"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createProductAction,
  findProductByBarcodeAction,
  generateNextSkuAction,
} from "@/features/catalog/actions/product-actions";
import { BarcodeScanner } from "@/features/catalog/components/barcode-scanner";
import {
  type CategoryLite,
  type InheritedBadgeKind,
  calcMargin,
  inheritedBadges,
  resolveInheritedProfile,
} from "@/features/catalog/lib/product-helpers";
import type { ProductInput } from "@/features/catalog/schemas";
import {
  type OpenFoodFactsProduct,
  lookupProductByBarcodeAction,
} from "@/features/inventory/actions/ai-product-actions";
import { MAX_IMAGE_BYTES, isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  Camera,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  type LucideIcon,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Thermometer,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

interface Props {
  organizationId: string;
  categories: CategoryLite[];
  initialSku: string;
}

const BADGE_ICON: Record<InheritedBadgeKind, LucideIcon> = {
  age: ShieldAlert,
  ambiente: Thermometer,
  refrigerado: Snowflake,
  congelado: Snowflake,
  expiry: CalendarClock,
  lot: Boxes,
};

type Form = {
  sku: string;
  barcode: string;
  name: string;
  categoryRootId: string;
  subcategoryId: string;
  brand: string;
  costPrice: string;
  price: string;
  imageUrl: string;
};

const EMPTY: Omit<Form, "sku"> = {
  barcode: "",
  name: "",
  categoryRootId: "",
  subcategoryId: "",
  brand: "",
  costPrice: "",
  price: "",
  imageUrl: "",
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

/* ── Image card ─────────────────────────────────────────────── */

function ImageCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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

/* ── Main ───────────────────────────────────────────────────── */

type BcStatus = "idle" | "loading" | "found" | "duplicate" | "not_found";

export function ProductQuickCreate({ organizationId, categories, initialSku }: Props) {
  const router = useRouter();
  const ids = useId();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>({ sku: initialSku, ...EMPTY });
  const [skuLoading, setSkuLoading] = useState(false);
  const [bcStatus, setBcStatus] = useState<BcStatus>("idle");
  const [bcSuggest, setBcSuggest] = useState<OpenFoodFactsProduct | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /* ── derived ── */
  const roots = categories.filter((c) => !c.parentId);
  const subcategories = form.categoryRootId
    ? categories.filter((c) => c.parentId === form.categoryRootId)
    : [];
  const cost = Number(form.costPrice) || 0;
  const price = Number(form.price) || 0;
  const margin = calcMargin(cost, price);
  const badges = form.subcategoryId
    ? inheritedBadges(resolveInheritedProfile(categories, form.subcategoryId))
    : [];

  /* ── barcode lookup (debounced) ── */
  const cleanBarcode = form.barcode.replace(/\D/g, "");
  // biome-ignore lint/correctness/useExhaustiveDependencies: dispara apenas ao digitar o código
  useEffect(() => {
    if (cleanBarcode.length < 8 || cleanBarcode.length > 14) return;
    if (bcStatus === "found" || bcStatus === "duplicate") return;
    const t = setTimeout(() => doLookup(cleanBarcode), 600);
    return () => clearTimeout(t);
  }, [form.barcode]);

  async function doLookup(code: string) {
    setBcStatus("loading");
    setBcSuggest(null);
    const existing = await findProductByBarcodeAction(organizationId, code);
    if (existing) {
      setBcStatus("duplicate");
      toast.error(`Já cadastrado: ${existing.name}`, {
        action: { label: "Abrir", onClick: () => router.push(`/app/products/${existing.id}`) },
      });
      return;
    }
    const res = await lookupProductByBarcodeAction(code, organizationId);
    if (res.success) {
      setBcSuggest(res.data);
      setBcStatus("found");
    } else {
      setBcStatus("not_found");
      nameRef.current?.focus();
    }
  }

  function applySuggestion(p: OpenFoodFactsProduct) {
    setForm((f) => ({
      ...f,
      name: p.name || f.name,
      brand: p.brand ?? f.brand,
      imageUrl: p.imageUrl ?? f.imageUrl,
    }));
    setBcSuggest(null);
    setBcStatus("idle");
    toast.success("Preenchido pela busca. Revise antes de salvar.");
  }

  async function regenerateSku() {
    setSkuLoading(true);
    const r = await generateNextSkuAction(organizationId);
    setSkuLoading(false);
    if (r.success) set("sku", r.sku);
  }

  /* ── validation ── */
  function validate(): string | null {
    if (cleanBarcode.length < 8) return "Informe um código de barras válido (mín. 8 dígitos).";
    if (!form.name.trim()) return "Informe o nome do produto.";
    if (!form.subcategoryId) return "Selecione a subcategoria.";
    if (price <= 0) return "Informe o preço de venda.";
    return null;
  }

  /* ── submit ── */
  function submit(mode: "save" | "ficha") {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      let sku = form.sku;
      const build = (s: string): ProductInput => ({
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        sku: s || undefined,
        barcode: cleanBarcode,
        tags: [],
        productType: "SIMPLE",
        unit: "UN",
        saleUnit: "UN",
        conversionFactor: 1,
        price,
        costPrice: cost > 0 ? cost : undefined,
        imageUrl: form.imageUrl || undefined,
        categoryId: form.subcategoryId,
        isActive: true,
        hasAgeRestriction: false,
      });

      let res = await createProductAction(organizationId, build(sku));
      // SKU colidiu (corrida) → regenera e tenta 1×
      if (!res.success && /SKU/i.test(res.error)) {
        const r = await generateNextSkuAction(organizationId);
        if (r.success) {
          sku = r.sku;
          res = await createProductAction(organizationId, build(sku));
        }
      }
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Produto criado.");
      router.push(mode === "ficha" ? `/app/products/${res.data.id}` : "/app/products");
    });
  }

  const isLoading = bcStatus === "loading";

  /* ── render ── */
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit("save");
      }}
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* Header */}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => submit("ficha")}
        >
          Ficha completa
        </Button>
      </div>

      {/* Body: 2 columns */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: form */}
        <div className="flex flex-col gap-8">
          {/* Identificação */}
          <section className="flex flex-col gap-5">
            <SectionTitle>Identificação</SectionTitle>

            {/* SKU badge */}
            <div className="flex items-center gap-2">
              <Badge variant="soft" className="px-2.5 py-1 font-mono text-xs">
                SKU: {form.sku || "—"}
              </Badge>
              <button
                type="button"
                onClick={regenerateSku}
                disabled={skuLoading}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Gerar novo SKU"
                title="Gerar novo SKU"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", skuLoading && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(form.sku);
                  toast.success("SKU copiado.");
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Copiar SKU"
                title="Copiar SKU"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-muted-foreground">Gerado automaticamente</span>
            </div>

            {/* EAN */}
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
                      <p className="truncate text-xs text-muted-foreground">{bcSuggest.brand}</p>
                    )}
                  </div>
                  <Button type="button" size="sm" onClick={() => applySuggestion(bcSuggest)}>
                    Usar
                  </Button>
                </div>
              )}
            </div>

            {/* Nome */}
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

            {/* Categoria + Subcategoria */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-cat`}>Categoria</Label>
                <Select
                  id={`${ids}-cat`}
                  value={form.categoryRootId}
                  onChange={(e) => {
                    set("categoryRootId", e.target.value);
                    set("subcategoryId", "");
                  }}
                >
                  <option value="">Selecione…</option>
                  {roots.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-subcat`}>
                  Subcategoria <span className="text-destructive">*</span>
                </Label>
                <Select
                  id={`${ids}-subcat`}
                  value={form.subcategoryId}
                  onChange={(e) => set("subcategoryId", e.target.value)}
                  disabled={!form.categoryRootId}
                >
                  <option value="">
                    {!form.categoryRootId
                      ? "Escolha a categoria"
                      : subcategories.length === 0
                        ? "Sem subcategorias"
                        : "Selecione…"}
                  </option>
                  {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
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

            {/* Marca */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${ids}-brand`}>Marca</Label>
              <Input
                id={`${ids}-brand`}
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
                placeholder="Ex: Coca-Cola"
                autoComplete="off"
              />
            </div>
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
        </aside>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => router.push("/app/products")}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending} className="gap-1.5">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar produto
        </Button>
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
    </form>
  );
}
