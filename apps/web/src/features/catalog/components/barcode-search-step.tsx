"use client";

import { Camera, Cloud, Loader2, PackageSearch, PenLine, ScanLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CatalogMatch,
  findProductByBarcodeAction,
  searchCatalogAction,
} from "@/features/catalog/actions/product-actions";
import { BarcodeScanner } from "@/features/catalog/components/barcode-scanner";
import {
  lookupProductByBarcodeAction,
  type OnlineProductCandidate,
  type OpenFoodFactsProduct,
  searchProductsByNameAction,
} from "@/features/inventory/actions/ai-product-actions";
import { cn } from "@/lib/utils";

interface Props {
  organizationId: string;
  /** Produto encontrado online/IA — aplicar e ir para o formulário */
  onUse: (product: OpenFoodFactsProduct) => void;
  /** Cadastrar manualmente com este EAN (pode ser vazio) */
  onManual: (barcode: string) => void;
  /** Produto já existe — abrir ficha */
  onOpenExisting: (id: string) => void;
}

const isBarcodeQuery = (q: string) => {
  const digits = q.replace(/\D/g, "");
  return digits.length >= 8 && digits.length === q.trim().length;
};

export function BarcodeSearchStep({ organizationId, onUse, onManual, onOpenExisting }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrichingBc, setEnrichingBc] = useState<string | null>(null);
  const [found, setFound] = useState<OpenFoodFactsProduct | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [catalog, setCatalog] = useState<CatalogMatch[]>([]);
  const [online, setOnline] = useState<OnlineProductCandidate[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search — barcode vs name
  // biome-ignore lint/correctness/useExhaustiveDependencies: dispara ao digitar
  useEffect(() => {
    const q = query.trim();
    setFound(null);
    setDuplicate(null);
    setNotFound(false);
    if (q.length < 2) {
      setCatalog([]);
      setOnline([]);
      return;
    }
    const t = setTimeout(() => {
      if (isBarcodeQuery(q)) {
        runBarcodeLookup(q.replace(/\D/g, ""));
      } else {
        runNameSearch(q);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  async function runBarcodeLookup(code: string) {
    setLoading(true);
    setCatalog([]);
    setOnline([]);
    try {
      const existing = await findProductByBarcodeAction(organizationId, code);
      if (existing) {
        setDuplicate({ id: existing.id, name: existing.name });
        return;
      }
      const res = await lookupProductByBarcodeAction(code, organizationId);
      if (res.success) {
        setFound(res.data);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function runNameSearch(q: string) {
    setLoading(true);
    try {
      const [cat, on] = await Promise.all([
        searchCatalogAction(organizationId, q),
        q.length >= 3 ? searchProductsByNameAction(q) : Promise.resolve(null),
      ]);
      setCatalog(cat);
      setOnline(on?.success ? on.data : []);
    } finally {
      setLoading(false);
    }
  }

  async function enrichCandidate(c: OnlineProductCandidate) {
    // Evita duplicado antes de enriquecer
    const existing = await findProductByBarcodeAction(organizationId, c.barcode);
    if (existing) {
      setDuplicate({ id: existing.id, name: existing.name });
      return;
    }
    setEnrichingBc(c.barcode);
    try {
      const res = await lookupProductByBarcodeAction(c.barcode, organizationId);
      if (res.success) onUse(res.data);
      else toast.error("Falha ao buscar dados do produto.");
    } finally {
      setEnrichingBc(null);
    }
  }

  const showDropdown =
    !found && !duplicate && (catalog.length > 0 || online.length > 0 || query.trim().length >= 2);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PackageSearch className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Buscar produto</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Escaneie ou digite o código de barras. Também dá pra buscar pelo nome — preenchemos o
          cadastro automaticamente.
        </p>
      </div>

      {/* Search input */}
      <div className="relative w-full">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <ScanLine className="h-5 w-5 text-muted-foreground/60" />
              )}
            </span>
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="EAN ou nome do produto…"
              autoComplete="off"
              className="h-14 pl-11 text-base"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-14 w-14 shrink-0"
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear com a câmera"
          >
            <Camera className="h-5 w-5" />
          </Button>
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {/* Catálogo (anti-duplicado) */}
            {catalog.length > 0 && (
              <div className="border-b border-border">
                <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Já no seu catálogo
                </p>
                {catalog.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenExisting(p.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-1"
                  >
                    <Thumb url={p.imageUrl ?? undefined} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.brand, p.categoryName, p.sku].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-primary">Abrir</span>
                  </button>
                ))}
              </div>
            )}

            {/* Online (Cosmos) */}
            {online.length > 0 && (
              <div className="border-b border-border">
                <p className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Cloud className="h-3 w-3" /> Buscar online
                </p>
                {online.map((c) => (
                  <button
                    key={c.barcode}
                    type="button"
                    disabled={enrichingBc !== null}
                    onClick={() => enrichCandidate(c)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-1 disabled:opacity-50"
                  >
                    <Thumb url={c.imageUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.brand, c.barcode].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {enrichingBc === c.barcode ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Manual fallback */}
            <button
              type="button"
              onClick={() => onManual(isBarcodeQuery(query) ? query.replace(/\D/g, "") : "")}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:bg-surface-1"
            >
              <PenLine className="h-4 w-4" />
              Cadastrar manualmente
              {!loading &&
                catalog.length === 0 &&
                online.length === 0 &&
                query.trim().length >= 2 && (
                  <span className="text-xs text-muted-foreground/60">— nada encontrado</span>
                )}
            </button>
          </div>
        )}
      </div>

      {/* Duplicate banner */}
      {duplicate && (
        <div className="flex w-full items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Produto já cadastrado</p>
            <p className="truncate text-sm text-muted-foreground">{duplicate.name}</p>
          </div>
          <Button type="button" size="sm" onClick={() => onOpenExisting(duplicate.id)}>
            Abrir ficha
          </Button>
        </div>
      )}

      {/* Found card (EAN) */}
      {found && (
        <div className="flex w-full flex-col gap-4 rounded-xl border border-success/40 bg-success-soft/30 p-4">
          <div className="flex items-center gap-3">
            <Thumb url={found.imageUrl} big />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">{found.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {[found.brand, found.category].filter(Boolean).join(" · ")}
              </p>
              <FoundChips p={found} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" className="flex-1 gap-1.5" onClick={() => onUse(found)}>
              <Sparkles className="h-4 w-4" /> Usar e revisar
            </Button>
            <Button type="button" variant="outline" onClick={() => onManual(found.barcode)}>
              Editar do zero
            </Button>
          </div>
        </div>
      )}

      {/* Not found (EAN) */}
      {notFound && (
        <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-1/40 p-4">
          <div className="min-w-0 flex-1 text-sm text-muted-foreground">
            Nenhum dado encontrado para este código. Cadastre manualmente.
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onManual(query.replace(/\D/g, ""))}
          >
            Cadastrar manual
          </Button>
        </div>
      )}

      {/* Always-available manual entry */}
      <button
        type="button"
        onClick={() => onManual("")}
        className="text-sm text-muted-foreground transition hover:text-foreground hover:underline"
      >
        Pular e cadastrar manualmente
      </button>

      {scannerOpen && (
        <BarcodeScanner
          onScanned={(code) => {
            setScannerOpen(false);
            setQuery(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

function Thumb({ url, big }: { url?: string; big?: boolean }) {
  const size = big ? "h-14 w-14" : "h-9 w-9";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        className={cn(size, "shrink-0 rounded-md border border-border bg-white object-contain")}
      />
    );
  }
  return (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground/40",
      )}
    >
      <PackageSearch className="h-4 w-4" />
    </div>
  );
}

function FoundChips({ p }: { p: OpenFoodFactsProduct }) {
  const chips = [
    p.ncm && "NCM",
    p.packagingLevels?.length && `${p.packagingLevels.length} embalagem(ns)`,
    p.suggestedPrice && "preço",
    p.storageTemperature && p.storageTemperature !== "AMBIENTE" && "refrigerado",
    p.minimumAge && p.minimumAge >= 18 && "+18",
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success-foreground"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
