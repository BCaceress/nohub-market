"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertBrandAction } from "@/features/catalog/actions/brand-actions";
import { createCategoryAction } from "@/features/catalog/actions/category-actions";
import { setProductPriceAction } from "@/features/catalog/actions/price-actions";
import {
  createProductAction,
  findProductByBarcodeAction,
  generateSkuAction,
} from "@/features/catalog/actions/product-actions";
import { setProductTaxAction } from "@/features/catalog/actions/tax-actions";
import { BarcodeScanner } from "@/features/catalog/components/barcode-scanner";
import type { ProductInput } from "@/features/catalog/schemas";
import {
  type OpenFoodFactsProduct,
  lookupProductByBarcodeAction,
} from "@/features/inventory/actions/ai-product-actions";
import { MAX_IMAGE_BYTES, isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Barcode,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  Command as CommandIcon,
  CornerDownLeft,
  FolderPlus,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

/* ─────────────── types ─────────────── */

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  hasAgeRestriction?: boolean;
  storageTemperature?: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
  controlsExpiry?: boolean;
  controlsLot?: boolean;
};

type Supplier = { id: string; name: string };
type Location = { id: string; name: string };

const UNIT_OPTS = [
  { value: "UN", label: "Unidade (un)" },
  { value: "KG", label: "Quilograma (kg)" },
  { value: "G", label: "Grama (g)" },
  { value: "L", label: "Litro (l)" },
  { value: "ML", label: "Mililitro (ml)" },
  { value: "CX", label: "Caixa (cx)" },
  { value: "PCT", label: "Pacote (pct)" },
  { value: "FARDO", label: "Fardo" },
  { value: "DZ", label: "Dúzia (dz)" },
  { value: "BANDEJA", label: "Bandeja" },
  { value: "CENTO", label: "Cento" },
];

const TEMP_BADGE: Record<string, string> = {
  AMBIENTE: "🌡️ Ambiente",
  REFRIGERADO: "❄️ Refrigerado",
  CONGELADO: "🧊 Congelado",
};

/** Resolve o perfil herdável efetivo subindo a árvore de categorias. */
function resolveInheritedProfile(categories: Category[], categoryId: string) {
  const chain: Category[] = [];
  let current = categories.find((c) => c.id === categoryId);
  for (let i = 0; current && i < 10; i++) {
    chain.push(current);
    const parentId = current.parentId;
    current = parentId ? categories.find((c) => c.id === parentId) : undefined;
  }
  const firstDefined = <T,>(get: (c: Category) => T | null | undefined) => {
    for (const c of chain) {
      const v = get(c);
      if (v != null) return v;
    }
    return null;
  };
  return {
    hasAgeRestriction: chain.some((c) => c.hasAgeRestriction),
    storageTemperature: firstDefined((c) => c.storageTemperature),
    controlsExpiry: firstDefined((c) => c.controlsExpiry) ?? false,
    controlsLot: firstDefined((c) => c.controlsLot) ?? false,
  };
}

type Form = {
  name: string;
  barcode: string;
  categoryId: string;
  imageUrl: string;
  price: string;
  cost: string;
  margin: string;
  brand: string;
  brandId: string;
  unit: string;
  // layer 2
  promoPrice: string;
  // layer 3
  sku: string;
  supplierId: string;
  stockMin: string;
  stockIdeal: string;
  location: string;
  weight: string;
  height: string;
  width: string;
  length: string;
};

const EMPTY: Form = {
  name: "",
  barcode: "",
  categoryId: "",
  imageUrl: "",
  price: "",
  cost: "",
  margin: "",
  brand: "",
  brandId: "",
  unit: "UN",
  promoPrice: "",
  sku: "",
  supplierId: "",
  stockMin: "",
  stockIdeal: "",
  location: "",
  weight: "",
  height: "",
  width: "",
  length: "",
};

type LayerId = "commercial" | "stock" | "fiscal";

type TaxForm = {
  ncm: string;
  ncmDescription: string;
  cest: string;
  cfopInternal: string;
  cfopInterstate: string;
  origin: string;
  icmsCst: string;
  icmsCsosn: string;
  pisCst: string;
  cofinsCst: string;
};

const EMPTY_TAX: TaxForm = {
  ncm: "",
  ncmDescription: "",
  cest: "",
  cfopInternal: "",
  cfopInterstate: "",
  origin: "NACIONAL",
  icmsCst: "",
  icmsCsosn: "",
  pisCst: "",
  cofinsCst: "",
};

const ORIGIN_OPTS = [
  { value: "NACIONAL", label: "0 — Nacional" },
  { value: "ESTRANGEIRO_DIRETO", label: "1 — Estrangeiro (importação direta)" },
  { value: "ESTRANGEIRO_NACIONAL", label: "2 — Estrangeiro (mercado interno)" },
  { value: "NACIONAL_MAIS_40_IMPORTADO", label: "3 — Nacional > 40% importado" },
  { value: "NACIONAL_SEM_SIMILAR", label: "5 — Nacional sem similar" },
];

const ICMS_CST_OPTS = ["00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90"];
const ICMS_CSOSN_OPTS = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "instantes";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function eanOk(c: string): boolean {
  if (!/^\d+$/.test(c)) return false;
  if (![8, 12, 13, 14].includes(c.length)) return false;
  const ds = c.split("").map(Number);
  const chk = ds.pop() as number;
  ds.reverse();
  let s = 0;
  for (let i = 0; i < ds.length; i++) s += (ds[i] ?? 0) * (i % 2 === 0 ? 3 : 1);
  return (10 - (s % 10)) % 10 === chk;
}

/* ─────────────── draft persistence ─────────────── */

const DRAFT_KEY = "nohub:product-canvas:draft:v1";
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type Draft = {
  ts: number;
  form: Form;
  tax: TaxForm;
  openLayers: LayerId[];
  priceMode: "global" | "perStore";
  locationPrices: Record<string, string>;
};

/* ─────────────── command palette ─────────────── */

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Sparkles;
  keywords?: string[];
  shortcut?: string[];
  run: () => void;
};

function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q.trim()) return commands;
    const qq = q.toLowerCase();
    return commands.filter((c) => {
      if (c.label.toLowerCase().includes(qq)) return true;
      if (c.hint?.toLowerCase().includes(qq)) return true;
      if (c.keywords?.some((k) => k.toLowerCase().includes(qq))) return true;
      return false;
    });
  }, [commands, q]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset índice ao mudar query
  useEffect(() => {
    setIdx(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[idx];
        if (cmd) {
          onClose();
          cmd.run();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, idx, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-4 sm:px-4 sm:pt-[10vh] animate-in fade-in-0 duration-150"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      // biome-ignore lint/a11y/useSemanticElements: overlay de paleta de comandos custom
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
      <div
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/40 animate-in zoom-in-95 slide-in-from-top-2 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            // biome-ignore lint/a11y/noAutofocus: foco inicial intencional na busca da paleta
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ação ou comando…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="rounded border border-border/60 bg-surface-1/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1 sm:max-h-[50vh]">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhuma ação encontrada.
            </p>
          ) : (
            filtered.map((c, i) => {
              const Icon = c.icon;
              const active = i === idx;
              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    onClose();
                    c.run();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    active && "bg-surface-1",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-surface-2/40 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.label}</p>
                    {c.hint && (
                      <p className="truncate text-[11px] text-muted-foreground">{c.hint}</p>
                    )}
                  </div>
                  {c.shortcut && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {c.shortcut.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border/60 bg-surface-1/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  )}
                  {active && !c.shortcut && (
                    <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="hidden items-center justify-between gap-3 border-t border-border/60 bg-surface-1/20 px-4 py-2 text-[10px] text-muted-foreground sm:flex">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-card px-1 py-0.5 font-mono">
                ↑↓
              </kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-card px-1 py-0.5 font-mono">↵</kbd>
              executar
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <CommandIcon className="h-3 w-3" />
            <kbd className="font-mono">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── robot searching SVG ─────────────── */

function RobotSearching({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <title>Robô pesquisando</title>
      {/* antenna */}
      <line
        x1="14"
        y1="2"
        x2="14"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="14" cy="1.5" r="1.5" fill="currentColor">
        <animate attributeName="r" values="1.5;2;1.5" dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
      </circle>
      {/* head */}
      <rect
        x="7"
        y="5"
        width="14"
        height="10"
        rx="3"
        fill="currentColor"
        opacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* eyes — alternate blink */}
      <circle cx="11" cy="10" r="1.6" fill="currentColor">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="17" cy="10" r="1.6" fill="currentColor">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" repeatCount="indefinite" />
      </circle>
      {/* mouth scan */}
      <line x1="10" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.4">
        <animate attributeName="x2" values="10;18;10" dur="1.6s" repeatCount="indefinite" />
      </line>
      {/* body */}
      <rect
        x="9"
        y="16"
        width="10"
        height="8"
        rx="2"
        fill="currentColor"
        opacity="0.10"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* arms swing */}
      <g>
        <line
          x1="9"
          y1="18"
          x2="5"
          y2="21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 9 18;18 9 18;0 9 18"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </line>
        <line
          x1="19"
          y1="18"
          x2="23"
          y2="21"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 19 18;-18 19 18;0 19 18"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </line>
      </g>
      {/* legs */}
      <line
        x1="11"
        y1="24"
        x2="11"
        y2="27"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="17"
        y1="24"
        x2="17"
        y2="27"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────── live number tick ─────────────── */

function Tick({ value, className }: { value: string; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (value !== prev) {
      setPulse(true);
      setPrev(value);
      const t = setTimeout(() => setPulse(false), 280);
      return () => clearTimeout(t);
    }
  }, [value, prev]);
  return (
    <span
      className={cn(
        "tabular-nums transition-[color,transform] duration-200",
        pulse && "text-primary",
        className,
      )}
    >
      {value}
    </span>
  );
}

/* ─────────────── image well ─────────────── */

function ImageWell({
  value,
  onChange,
  highlight,
}: {
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cloudOn = isCloudinaryConfigured();

  // biome-ignore lint/correctness/useExhaustiveDependencies: reseta erro ao trocar imagem
  useEffect(() => {
    setImgErr(false);
  }, [value]);

  const handleFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Arquivo inválido.");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error("Imagem acima de 5 MB.");
        return;
      }
      setUploading(true);
      try {
        const url = await uploadImageToCloudinary(file);
        onChange(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao enviar.");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  // global paste while no input focused on image area
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;
      const file = e.clipboardData?.files?.[0];
      if (file?.type.startsWith("image/")) handleFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const hasImg = !!value && !imgErr;

  return (
    <div className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/useSemanticElements: dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => cloudOn && !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && cloudOn && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
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
          "group relative aspect-square w-full overflow-hidden rounded-3xl",
          "bg-surface-1/40 transition-all outline-none",
          "ring-1 ring-inset ring-border/60",
          dragOver && "ring-primary/60 bg-primary/5",
          highlight && !dragOver && "ring-primary/40 shadow-[0_0_0_4px_var(--primary-ring)]",
          !hasImg && cloudOn && "cursor-pointer hover:ring-border-strong",
          "focus-visible:ring-primary",
        )}
      >
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Enviando…</p>
          </div>
        ) : hasImg ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              onError={() => setImgErr(true)}
              className="h-full w-full object-contain p-4"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-md text-foreground shadow-md transition hover:bg-background"
              aria-label="Remover imagem"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2/60 text-muted-foreground/80">
              <ImagePlus className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">Arraste, cole ou clique</p>
              <p className="text-[11px] text-muted-foreground">PNG · JPG · WebP — até 5 MB</p>
            </div>
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
    </div>
  );
}

/* ─────────────── category combobox (compact, inline create) ─────────────── */

function CategoryCombobox({
  organizationId,
  categories,
  value,
  onChange,
  onCreated,
  highlight,
}: {
  organizationId: string;
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (c: Category) => void;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selected = categories.find((c) => c.id === value);
  const roots = categories.filter((c) => !c.parentId);
  const filtered = q.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : null;
  const exact = q.trim()
    ? categories.find((c) => c.name.toLowerCase() === q.trim().toLowerCase())
    : null;

  async function createNew() {
    if (!q.trim()) return;
    setCreating(true);
    const res = await createCategoryAction(organizationId, {
      name: q.trim(),
      position: 0,
    });
    setCreating(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const cat: Category = {
      id: res.data.id,
      name: q.trim(),
      parentId: null,
    };
    onCreated(cat);
    onChange(cat.id);
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 text-sm text-left transition-colors",
          "hover:bg-surface-1 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
          highlight && "border-primary/40 ring-2 ring-[var(--primary-ring)]",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground/60")}>
          {selected ? selected.name : "Sem categoria"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                // biome-ignore lint/a11y/noAutofocus: foco inicial intencional na busca de categoria
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim() && !exact) {
                    e.preventDefault();
                    createNew();
                  }
                }}
                placeholder="Buscar ou criar…"
                className="h-8 w-full rounded-md bg-transparent pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {!q && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface-1"
              >
                Sem categoria
              </button>
            )}

            {(filtered ?? categories).length === 0 && q && (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                Nenhuma categoria encontrada.
              </p>
            )}

            {!filtered &&
              roots.map((root) => {
                const kids = categories.filter((c) => c.parentId === root.id);
                return (
                  <div key={root.id}>
                    <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {root.name}
                    </p>
                    {kids.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          onChange(root.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center px-3 py-1.5 text-sm hover:bg-surface-1",
                          value === root.id && "bg-surface-1 font-medium",
                        )}
                      >
                        {root.name}
                      </button>
                    ) : (
                      kids.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onChange(c.id);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-1.5 pl-6 text-sm hover:bg-surface-1",
                            value === c.id && "bg-surface-1 font-medium",
                          )}
                        >
                          <span className="text-muted-foreground/40 text-xs">↳</span>
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                );
              })}

            {/* biome-ignore lint/complexity/useOptionalChain: guard + map intencional */}
            {filtered &&
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center px-3 py-1.5 text-sm hover:bg-surface-1",
                    value === c.id && "bg-surface-1 font-medium",
                  )}
                >
                  {c.name}
                </button>
              ))}

            {q.trim() && !exact && (
              <button
                type="button"
                onClick={createNew}
                disabled={creating}
                className="mt-1 flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Criar "{q.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── currency input ─────────────── */

function MoneyInput({
  value,
  onChange,
  ...rest
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  const display =
    value === "" || value == null
      ? ""
      : (Math.round((Number(value) || 0) * 100) / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) return onChange("");
        onChange((Number(digits) / 100).toFixed(2));
      }}
      className={cn("text-right font-mono", rest.className)}
    />
  );
}

/* ─────────────── sub-collapsible ─────────────── */

function SubCollapsible({
  icon: Icon,
  label,
  hint,
  hasData,
  defaultOpen,
  children,
}: {
  icon: typeof Truck;
  label: string;
  hint?: string;
  hasData?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen || !!hasData);
  return (
    <div className="rounded-xl border border-border/50 bg-surface-1/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-1/40"
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-none">{label}</p>
          {hint && <p className="mt-1 truncate text-[10px] text-muted-foreground/70">{hint}</p>}
        </div>
        {hasData && !open && <span className="h-1 w-1 rounded-full bg-primary" />}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border/40 p-3.5 animate-in fade-in-0 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─────────────── layer chip ─────────────── */

function LayerChip({
  icon: Icon,
  label,
  open,
  badge,
  onClick,
}: {
  icon: typeof Store;
  label: string;
  open: boolean;
  badge?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        open
          ? "border-primary/40 bg-primary/[0.06] text-primary"
          : "border-border/60 bg-transparent text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {badge && !open && <span className="h-1 w-1 rounded-full bg-primary" />}
      {open ? <Minus className="h-3 w-3 opacity-60" /> : <Plus className="h-3 w-3 opacity-60" />}
    </button>
  );
}

/* ─────────────── main: ProductCanvas ─────────────── */

export interface ProductCanvasProps {
  organizationId: string;
  categories: Category[];
  suppliers: Supplier[];
  locations?: Location[];
}

type BarcodeStatus = "idle" | "loading" | "found" | "not_found" | "duplicate";

export function ProductCanvas({
  organizationId,
  categories: initialCategories,
  suppliers,
  locations = [],
}: ProductCanvasProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>(EMPTY);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [aiFields, setAiFields] = useState<Set<keyof Form>>(new Set());
  const [lastEdit, setLastEdit] = useState<"price" | "margin" | null>(null);
  const [bcStatus, setBcStatus] = useState<BarcodeStatus>("idle");
  const [bcSuggest, setBcSuggest] = useState<OpenFoodFactsProduct | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [openLayers, setOpenLayers] = useState<Set<LayerId>>(new Set());
  const [priceMode, setPriceMode] = useState<"global" | "perStore">("global");
  const [locationPrices, setLocationPrices] = useState<Record<string, string>>({});
  const [skuLoading, setSkuLoading] = useState(false);
  const [tax, setTax] = useState<TaxForm>(EMPTY_TAX);
  const [taxAiFilled, setTaxAiFilled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draftTs, setDraftTs] = useState<number | null>(null);
  const skipAutosaveRef = useRef(true); // skip first run + restore

  function setTaxField<K extends keyof TaxForm>(k: K, v: TaxForm[K]) {
    setTax((t) => ({ ...t, [k]: v }));
    if (taxAiFilled) setTaxAiFilled(false);
  }

  /* ── draft restore on mount ── */
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        skipAutosaveRef.current = false;
        return;
      }
      const d = JSON.parse(raw) as Draft;
      if (!d.ts || Date.now() - d.ts > DRAFT_TTL_MS) {
        localStorage.removeItem(DRAFT_KEY);
        skipAutosaveRef.current = false;
        return;
      }
      const hasData = d.form?.name?.trim() || d.form?.barcode?.trim() || Number(d.form?.price) > 0;
      if (!hasData) {
        localStorage.removeItem(DRAFT_KEY);
        skipAutosaveRef.current = false;
        return;
      }
      toast("Rascunho não salvo encontrado", {
        description: `Última edição há ${formatAgo(d.ts)}.`,
        duration: 12000,
        action: {
          label: "Restaurar",
          onClick: () => {
            setForm(d.form);
            setTax(d.tax ?? EMPTY_TAX);
            setOpenLayers(new Set(d.openLayers ?? []));
            setPriceMode(d.priceMode ?? "global");
            setLocationPrices(d.locationPrices ?? {});
            setDraftTs(d.ts);
            skipAutosaveRef.current = false;
          },
        },
        cancel: {
          label: "Descartar",
          onClick: () => {
            localStorage.removeItem(DRAFT_KEY);
            skipAutosaveRef.current = false;
          },
        },
      });
      // until user decides, don't autosave over the draft
      setTimeout(() => {
        skipAutosaveRef.current = false;
      }, 100);
    } catch {
      skipAutosaveRef.current = false;
    }
  }, []);

  /* ── debounced autosave ── */
  useEffect(() => {
    if (skipAutosaveRef.current) return;
    const hasData = form.name.trim() || form.barcode.trim() || Number(form.price) > 0;
    if (!hasData) {
      localStorage.removeItem(DRAFT_KEY);
      setDraftTs(null);
      return;
    }
    const t = setTimeout(() => {
      const d: Draft = {
        ts: Date.now(),
        form,
        tax,
        openLayers: Array.from(openLayers),
        priceMode,
        locationPrices,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
        setDraftTs(d.ts);
      } catch {
        /* quota or disabled — ignore */
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [form, tax, openLayers, priceMode, locationPrices]);

  /* ── ⌘K listener ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── smart dock: shadow when not at bottom ── */
  const [dockShadow, setDockShadow] = useState(false);
  useEffect(() => {
    function check() {
      const max = document.documentElement.scrollHeight - window.innerHeight - 4;
      setDockShadow(window.scrollY < max);
    }
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  function toggleLayer(id: LayerId) {
    setOpenLayers((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function regenSku() {
    if (!form.categoryId) {
      toast.info("Selecione uma categoria primeiro.");
      return;
    }
    setSkuLoading(true);
    const r = await generateSkuAction(organizationId, form.categoryId);
    setSkuLoading(false);
    if (r.success) patch({ sku: r.sku });
    else toast.error(r.error);
  }

  const nameRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /* ── derived ── */
  const price = Number(form.price) || 0;
  const cost = Number(form.cost) || 0;
  const margin = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : null;
  const profit = price > 0 && cost > 0 ? price - cost : null;
  const markup = cost > 0 && price > 0 ? price / cost : null;

  const missing: string[] = [];
  if (!form.name.trim()) missing.push("nome");
  if (price <= 0) missing.push("preço");
  const ready = missing.length === 0;

  function patch(p: Partial<Form>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function setField<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (aiFields.has(k)) {
      setAiFields((s) => {
        const n = new Set(s);
        n.delete(k);
        return n;
      });
    }
  }

  /* ── price/margin/cost coupling ── */
  function onCostChange(v: string) {
    const c = Number(v) || 0;
    const next: Partial<Form> = { cost: v };
    if (lastEdit === "margin" && form.margin !== "") {
      const m = Number(form.margin);
      if (c > 0 && m < 100) next.price = (c / (1 - m / 100)).toFixed(2);
    } else if (price > 0) {
      next.margin = c > 0 ? (((price - c) / price) * 100).toFixed(1) : "";
    }
    patch(next);
  }
  function onMarginChange(v: string) {
    setLastEdit("margin");
    const m = Number(v);
    const next: Partial<Form> = { margin: v };
    if (cost > 0 && v !== "" && m < 100) next.price = (cost / (1 - m / 100)).toFixed(2);
    patch(next);
  }
  function onPriceChange(v: string) {
    setLastEdit("price");
    const p = Number(v) || 0;
    const next: Partial<Form> = { price: v };
    if (cost > 0 && p > 0) next.margin = (((p - cost) / p) * 100).toFixed(1);
    patch(next);
  }

  /* ── barcode IA lookup ── */
  const cleanBarcode = form.barcode.replace(/\D/g, "");
  const eanInvalid = cleanBarcode.length >= 8 && !eanOk(cleanBarcode) && bcStatus !== "loading";

  // biome-ignore lint/correctness/useExhaustiveDependencies: debounce on barcode
  useEffect(() => {
    if (cleanBarcode.length < 8 || cleanBarcode.length > 14) return;
    if (bcStatus === "found" || bcStatus === "duplicate") return;
    const t = setTimeout(() => doBarcodeLookup(cleanBarcode), 600);
    return () => clearTimeout(t);
  }, [form.barcode]);

  async function doBarcodeLookup(code: string) {
    setBcStatus("loading");
    setBcSuggest(null);
    const existing = await findProductByBarcodeAction(organizationId, code);
    if (existing) {
      setBcStatus("duplicate");
      toast.error(`Já cadastrado: ${existing.name}`, {
        action: {
          label: "Abrir",
          onClick: () => router.push(`/app/products/${existing.id}`),
        },
      });
      return;
    }
    const res = await lookupProductByBarcodeAction(code, organizationId);
    if (res.success) {
      setBcSuggest(res.data);
      setBcStatus("found");
    } else {
      setBcStatus("not_found");
      setTimeout(() => nameRef.current?.focus(), 30);
    }
  }

  function applyAiSuggestion(p: OpenFoodFactsProduct) {
    const filled = new Set<keyof Form>();
    const u: Partial<Form> = {};
    if (p.name) {
      u.name = p.name;
      filled.add("name");
    }
    if (p.brand) {
      u.brand = p.brand;
      u.brandId = "";
      filled.add("brand");
    }
    if (p.imageUrl) {
      u.imageUrl = p.imageUrl;
      filled.add("imageUrl");
    }
    if (p.categoryId) {
      u.categoryId = p.categoryId;
      filled.add("categoryId");
    }
    patch(u);
    setAiFields(filled);

    if (p.ncm) {
      setTax({
        ncm: p.ncm,
        ncmDescription: p.ncmDescription ?? "",
        cest: p.cest ?? "",
        cfopInternal: p.cfopInternal ?? "",
        cfopInterstate: p.cfopInterstate ?? "",
        origin: p.origin || "NACIONAL",
        icmsCst: p.icmsCst ?? "",
        icmsCsosn: p.icmsCsosn ?? "",
        pisCst: p.pisCst ?? "",
        cofinsCst: p.cofinsCst ?? "",
      });
      setTaxAiFilled(true);
      setOpenLayers((s) => new Set(s).add("fiscal"));
    }

    setBcSuggest(null);
    setBcStatus("idle");
    toast.success(
      p.ncm
        ? "Preenchido pela IA — incluindo fiscal. Revise antes de salvar."
        : "Preenchido pela IA. Revise antes de salvar.",
      { icon: "✨" },
    );
  }

  /* ── submit ── */
  function submit(mode: "save" | "new") {
    if (!form.name.trim()) {
      toast.error("Informe o nome.");
      nameRef.current?.focus();
      return;
    }
    if (price <= 0) {
      toast.error("Informe o preço.");
      priceRef.current?.focus();
      return;
    }

    startTransition(async () => {
      let brandId = form.brandId;
      if (form.brand.trim() && !brandId) {
        const r = await upsertBrandAction(organizationId, form.brand.trim());
        if (r.success) brandId = r.id;
      }

      const input: ProductInput = {
        name: form.name,
        brand: form.brand || undefined,
        brandId: brandId || undefined,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        tags: [],
        productType: "SIMPLE",
        unit: form.unit as ProductInput["unit"],
        saleUnit: form.unit as ProductInput["saleUnit"],
        conversionFactor: 1,
        price,
        costPrice: cost > 0 ? cost : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        height: form.height ? Number(form.height) : undefined,
        width: form.width ? Number(form.width) : undefined,
        length: form.length ? Number(form.length) : undefined,
        stockMin: form.stockMin ? Number(form.stockMin) : undefined,
        location: form.location || undefined,
        imageUrl: form.imageUrl || undefined,
        categoryId: form.categoryId || undefined,
        supplierId: form.supplierId || undefined,
        isActive: true,
        hasAgeRestriction: false,
      };

      const res = await createProductAction(organizationId, input);
      if (!res.success) {
        toast.error(res.error);
        return;
      }

      const pid = res.data.id;

      // Per-store pricing
      if (priceMode === "perStore") {
        for (const loc of locations) {
          const raw = locationPrices[loc.id];
          if (!raw || raw.trim() === "") continue;
          const priceNum = Number(raw);
          if (!Number.isFinite(priceNum) || priceNum < 0) continue;
          await setProductPriceAction(organizationId, {
            productId: pid,
            locationId: loc.id,
            price: priceNum,
          } as never).catch(() => {});
        }
      }

      // Fiscal — requires valid NCM
      if (/^\d{8}$/.test(tax.ncm)) {
        await setProductTaxAction(organizationId, {
          productId: pid,
          ncm: tax.ncm,
          cest: tax.cest,
          cfopInternal: tax.cfopInternal,
          cfopInterstate: tax.cfopInterstate,
          origin: (tax.origin as never) || "NACIONAL",
          icmsCst: tax.icmsCst as never,
          icmsCsosn: tax.icmsCsosn as never,
          pisCst: tax.pisCst,
          cofinsCst: tax.cofinsCst,
          unitTaxable: true,
        }).catch(() => {});
      }

      // clear draft on success
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setDraftTs(null);

      if (mode === "new") {
        toast.success(`${form.name} criado.`);
        skipAutosaveRef.current = true;
        setForm(EMPTY);
        setAiFields(new Set());
        setBcStatus("idle");
        setBcSuggest(null);
        setOpenLayers(new Set());
        setPriceMode("global");
        setLocationPrices({});
        setTax(EMPTY_TAX);
        setTaxAiFilled(false);
        setTimeout(() => {
          skipAutosaveRef.current = false;
          barcodeRef.current?.focus();
        }, 50);
      } else {
        toast.success("Produto criado.");
        router.push("/app/products");
      }
    });
  }

  /* ── keyboard ── */
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      submit(e.shiftKey ? "new" : "save");
    }
    if (e.key === "Escape") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).value) {
        // let field clear itself if it wants
      }
    }
  }

  /* ── commands ── */
  // biome-ignore lint/correctness/useExhaustiveDependencies: handlers estáveis; recriar a paleta a cada mudança seria desnecessário
  const commands: Command[] = useMemo(
    () => [
      {
        id: "focus-name",
        label: "Focar nome do produto",
        icon: Sparkles,
        keywords: ["nome", "titulo"],
        run: () => nameRef.current?.focus(),
      },
      {
        id: "focus-barcode",
        label: "Focar código de barras",
        icon: Barcode,
        keywords: ["ean", "gtin", "codigo"],
        run: () => barcodeRef.current?.focus(),
      },
      {
        id: "scan-camera",
        label: "Escanear pela câmera",
        icon: Camera,
        keywords: ["scanner", "leitor"],
        run: () => setScannerOpen(true),
      },
      {
        id: "ai-lookup",
        label: "Pesquisar produto com IA",
        hint: "Usa código de barras digitado",
        icon: Sparkles,
        keywords: ["ia", "ai", "robo", "buscar"],
        run: () => {
          const c = form.barcode.replace(/\D/g, "");
          if (c.length < 8) {
            toast.info("Informe ao menos 8 dígitos.");
            barcodeRef.current?.focus();
            return;
          }
          doBarcodeLookup(c);
        },
      },
      {
        id: "gen-sku",
        label: "Gerar SKU pela categoria",
        icon: RefreshCw,
        keywords: ["sku", "codigo interno"],
        run: () => {
          if (!openLayers.has("stock")) setOpenLayers((s) => new Set(s).add("stock"));
          regenSku();
        },
      },
      {
        id: "toggle-commercial",
        label: openLayers.has("commercial")
          ? "Fechar comercial avançado"
          : "Abrir comercial avançado",
        icon: Store,
        keywords: ["preco", "loja", "promocao"],
        run: () => toggleLayer("commercial"),
      },
      {
        id: "toggle-stock",
        label: openLayers.has("stock") ? "Fechar estoque & logística" : "Abrir estoque & logística",
        icon: Boxes,
        keywords: ["estoque", "peso", "dimensao", "fornecedor"],
        run: () => toggleLayer("stock"),
      },
      {
        id: "toggle-fiscal",
        label: openLayers.has("fiscal") ? "Fechar fiscal" : "Abrir fiscal",
        icon: Receipt,
        keywords: ["ncm", "cfop", "cest", "icms", "pis", "cofins"],
        run: () => toggleLayer("fiscal"),
      },
      {
        id: "new-category",
        label: "Criar nova categoria",
        icon: FolderPlus,
        keywords: ["categoria", "grupo"],
        run: async () => {
          const name = window.prompt("Nome da nova categoria:");
          if (!name?.trim()) return;
          const res = await createCategoryAction(organizationId, {
            name: name.trim(),
            position: 0,
          });
          if (!res.success) {
            toast.error(res.error);
            return;
          }
          const cat: Category = {
            id: res.data.id,
            name: name.trim(),
            parentId: null,
          };
          setCategories((p) => [...p, cat]);
          setField("categoryId", cat.id);
          toast.success(`Categoria "${cat.name}" criada.`);
        },
      },
      {
        id: "clear",
        label: "Limpar formulário",
        icon: RotateCcw,
        keywords: ["reset", "apagar", "limpar"],
        run: () => {
          if (!window.confirm("Limpar todos os campos preenchidos?")) return;
          skipAutosaveRef.current = true;
          setForm(EMPTY);
          setTax(EMPTY_TAX);
          setAiFields(new Set());
          setOpenLayers(new Set());
          setPriceMode("global");
          setLocationPrices({});
          setBcStatus("idle");
          setBcSuggest(null);
          setTaxAiFilled(false);
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {}
          setDraftTs(null);
          setTimeout(() => {
            skipAutosaveRef.current = false;
          }, 50);
        },
      },
      {
        id: "save",
        label: "Publicar produto",
        icon: Check,
        shortcut: ["⌘", "↵"],
        keywords: ["salvar", "publicar", "criar"],
        run: () => submit("save"),
      },
      {
        id: "save-new",
        label: "Salvar e cadastrar próximo",
        icon: Plus,
        shortcut: ["⌘", "⇧", "↵"],
        keywords: ["salvar novo", "outro"],
        run: () => submit("new"),
      },
      {
        id: "back",
        label: "Voltar para produtos",
        icon: ArrowLeft,
        shortcut: ["esc"],
        keywords: ["sair", "cancelar"],
        run: () => router.push("/app/products"),
      },
    ],
    // biome-ignore lint/correctness/useExhaustiveDependencies: stable wrappers
    [openLayers, form.barcode],
  );

  const marginColor = useMemo(() => {
    if (margin === null) return "text-muted-foreground";
    if (margin < 0) return "text-destructive";
    if (margin < 10) return "text-amber-500";
    if (margin < 30) return "text-amber-400";
    return "text-emerald-400";
  }, [margin]);

  /* ── render ── */
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit("save");
      }}
      onKeyDown={onKeyDown}
      className="relative -m-6 flex min-h-[calc(100vh-4rem)] flex-col bg-background"
    >
      {/* ── topbar ── */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6 sm:gap-4 lg:px-8 xl:px-12">
        <button
          type="button"
          onClick={() => router.push("/app/products")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-1 hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-sm font-semibold whitespace-nowrap">Novo produto</h1>
          <span className="hidden truncate text-xs text-muted-foreground/60 sm:inline">
            {form.name || "sem nome"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-surface-1/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-1 hover:text-foreground sm:inline-flex"
            title="Paleta de comandos"
          >
            <CommandIcon className="h-3 w-3" />
            <kbd className="font-mono">K</kbd>
          </button>
          <div className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-surface-1/40 px-2 py-1 text-[10px] font-medium text-muted-foreground sm:flex">
            <kbd className="font-mono">⌘</kbd>
            <kbd className="font-mono">↵</kbd>
            <span>Salvar</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => router.push("/app/products")}
            className="hidden sm:inline-flex"
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !ready} className="gap-1.5">
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Publicar
          </Button>
        </div>
      </header>

      {/* ── canvas: 3-zone grid ── */}
      <div
        className={cn(
          "grid flex-1 grid-cols-1 gap-y-8 px-4 py-8",
          "sm:px-6 sm:py-10",
          "md:grid-cols-[160px_minmax(0,1fr)] md:gap-x-6 md:gap-y-8",
          "lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:gap-x-8 lg:px-8 lg:py-10",
          "xl:grid-cols-[240px_minmax(0,1fr)_320px] xl:gap-x-12 xl:px-12 xl:py-12",
        )}
      >
        {/* ─── ZONE 1: IMAGE ─── */}
        <aside className="mx-auto w-full max-w-[200px] md:mx-0 md:max-w-none lg:sticky lg:top-20 lg:self-start">
          <ImageWell
            value={form.imageUrl}
            onChange={(v) => setField("imageUrl", v)}
            highlight={aiFields.has("imageUrl")}
          />
          {aiFields.has("imageUrl") && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary">
              <Sparkles className="h-3 w-3" />
              Imagem da IA
            </p>
          )}
        </aside>

        {/* ─── ZONE 2: CORE ─── */}
        <section className="flex max-w-2xl flex-col gap-8">
          {/* Name — hero */}
          <div>
            <label
              htmlFor="p-name"
              className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Nome do produto
            </label>
            <input
              ref={nameRef}
              id="p-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ex: Coca-Cola Lata 350ml"
              autoComplete="off"
              className={cn(
                "mt-1.5 w-full bg-transparent text-xl font-medium leading-tight tracking-tight outline-none placeholder:text-muted-foreground/30 md:text-2xl lg:text-[26px] xl:text-[28px]",
                "border-b border-border/0 transition-colors focus:border-border",
                aiFields.has("name") && "text-foreground",
              )}
            />
          </div>

          {/* Barcode */}
          <div>
            <label
              htmlFor="p-barcode"
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              <Barcode className="h-3 w-3" />
              Código de barras
              {bcStatus === "loading" && (
                <span className="ml-2 inline-flex items-center gap-1.5 text-primary normal-case tracking-normal">
                  <RobotSearching size={14} />
                  Robô pesquisando…
                </span>
              )}
              {bcStatus === "found" && bcSuggest && (
                <span className="ml-2 inline-flex items-center gap-1 text-emerald-400 normal-case tracking-normal">
                  <Sparkles className="h-3 w-3" />
                  Encontrado
                </span>
              )}
              {bcStatus === "not_found" && (
                <span className="ml-2 normal-case tracking-normal text-muted-foreground/60">
                  · não encontrado
                </span>
              )}
              {eanInvalid && (
                <span className="ml-2 normal-case tracking-normal text-amber-500">
                  · dígito inválido
                </span>
              )}
            </label>

            <div className="mt-1.5 flex gap-2">
              <Input
                ref={barcodeRef}
                id="p-barcode"
                inputMode="numeric"
                value={form.barcode}
                onChange={(e) => {
                  setField("barcode", e.target.value);
                  if (bcStatus !== "idle") {
                    setBcStatus("idle");
                    setBcSuggest(null);
                  }
                }}
                placeholder="Escaneie ou digite o EAN/GTIN"
                className={cn(
                  "h-11 font-mono text-base",
                  bcStatus === "found" && "border-emerald-500/40",
                  bcStatus === "duplicate" && "border-amber-500/40",
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setScannerOpen(true)}
                title="Escanear pela câmera"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-11 w-11 shrink-0 relative",
                  bcStatus === "loading" && "border-primary/40 text-primary",
                )}
                onClick={() => {
                  const c = form.barcode.replace(/\D/g, "");
                  if (c.length < 8) {
                    toast.info("Informe ao menos 8 dígitos.");
                    return;
                  }
                  doBarcodeLookup(c);
                }}
                disabled={bcStatus === "loading"}
                title="Pesquisar com IA"
              >
                {bcStatus === "loading" ? (
                  <RobotSearching size={18} />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* loading panel — bigger robot */}
            {bcStatus === "loading" && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-3.5 py-3 text-primary">
                <RobotSearching size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">Consultando catálogo</p>
                  <p className="mt-0.5 text-[11px] text-primary/70">
                    Identificando produto, marca, categoria e fiscal…
                  </p>
                </div>
                <span className="inline-flex gap-0.5 font-mono text-xs tracking-widest text-primary/60">
                  <span className="animate-pulse [animation-delay:0ms]">·</span>
                  <span className="animate-pulse [animation-delay:200ms]">·</span>
                  <span className="animate-pulse [animation-delay:400ms]">·</span>
                </span>
              </div>
            )}

            {/* AI suggestion card */}
            {bcStatus === "found" && bcSuggest && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                {bcSuggest.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bcSuggest.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg border border-border bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-muted-foreground/40">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{bcSuggest.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[bcSuggest.brand, bcSuggest.category].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" onClick={() => applyAiSuggestion(bcSuggest)}>
                    Usar
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setBcSuggest(null);
                      setBcStatus("idle");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Category + brand */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Categoria
              </span>
              <div className="mt-1.5">
                <CategoryCombobox
                  organizationId={organizationId}
                  categories={categories}
                  value={form.categoryId}
                  onChange={(id) => setField("categoryId", id)}
                  onCreated={(c) => setCategories((p) => [...p, c])}
                  highlight={aiFields.has("categoryId")}
                />
              </div>
              {form.categoryId &&
                (() => {
                  const inh = resolveInheritedProfile(categories, form.categoryId);
                  const badges: string[] = [];
                  if (inh.hasAgeRestriction) badges.push("🔞 +18");
                  if (inh.storageTemperature)
                    badges.push(TEMP_BADGE[inh.storageTemperature] ?? inh.storageTemperature);
                  if (inh.controlsExpiry) badges.push("📅 Validade");
                  if (inh.controlsLot) badges.push("🏷️ Lote");
                  if (badges.length === 0) return null;
                  return (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">
                        Herdado
                      </span>
                      {badges.map((b) => (
                        <span
                          key={b}
                          className="inline-flex items-center rounded-full border border-border/60 bg-surface-1/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  );
                })()}
            </div>

            <div>
              <label
                htmlFor="p-brand"
                className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Marca <span className="font-normal opacity-50">opcional</span>
              </label>
              <Input
                id="p-brand"
                value={form.brand}
                onChange={(e) => {
                  setField("brand", e.target.value);
                  if (form.brandId) patch({ brandId: "" });
                }}
                placeholder="Ex: Coca-Cola"
                className={cn("mt-1.5", aiFields.has("brand") && "border-primary/30")}
              />
            </div>
          </div>

          {/* Unidade de medida */}
          <div className="max-w-[240px]">
            <label
              htmlFor="p-unit"
              className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Unidade de medida
            </label>
            <select
              id="p-unit"
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]"
            >
              {UNIT_OPTS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* ─── LAYER CHIPS ─── */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <LayerChip
              icon={Store}
              label="Comercial avançado"
              open={openLayers.has("commercial")}
              onClick={() => toggleLayer("commercial")}
              badge={priceMode === "perStore" || Number(form.promoPrice) > 0 ? "·" : null}
            />
            <LayerChip
              icon={Boxes}
              label="Estoque & Logística"
              open={openLayers.has("stock")}
              onClick={() => toggleLayer("stock")}
              badge={
                form.sku ||
                form.stockMin ||
                form.location ||
                form.supplierId ||
                form.weight ||
                form.height ||
                form.width ||
                form.length
                  ? "·"
                  : null
              }
            />
            <LayerChip
              icon={Receipt}
              label="Fiscal"
              open={openLayers.has("fiscal")}
              onClick={() => toggleLayer("fiscal")}
              badge={/^\d{8}$/.test(tax.ncm) ? "·" : taxAiFilled ? "·" : null}
            />
          </div>

          {/* ─── LAYER 2: COMMERCIAL ─── */}
          {openLayers.has("commercial") && (
            <div className="animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col gap-6 pt-2">
              {/* Promo price */}
              <div>
                <label
                  htmlFor="p-promo"
                  className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Preço promocional <span className="font-normal opacity-50">opcional</span>
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <MoneyInput
                    id="p-promo"
                    value={form.promoPrice}
                    onChange={(v) => setField("promoPrice", v)}
                    placeholder="0,00"
                    className="h-10 max-w-[200px]"
                  />
                  {Number(form.promoPrice) > 0 && price > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {(((price - Number(form.promoPrice)) / price) * 100).toFixed(1)}% off ·
                      economiza{" "}
                      <span className="font-medium text-emerald-400">
                        {brl(price - Number(form.promoPrice))}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Per-store pricing */}
              {locations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Preço por loja
                    </span>
                    <div className="inline-flex rounded-md border border-border/60 bg-surface-1/40 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPriceMode("global")}
                        className={cn(
                          "rounded px-2 py-1 transition-colors",
                          priceMode === "global"
                            ? "bg-card font-medium shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Global
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceMode("perStore")}
                        className={cn(
                          "rounded px-2 py-1 transition-colors",
                          priceMode === "perStore"
                            ? "bg-card font-medium shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Por loja
                      </button>
                    </div>
                  </div>
                  {priceMode === "perStore" ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {locations.map((loc) => (
                        <div
                          key={loc.id}
                          className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-1/30 px-3 py-2"
                        >
                          <span className="flex-1 truncate text-xs font-medium">{loc.name}</span>
                          <MoneyInput
                            value={locationPrices[loc.id] ?? ""}
                            onChange={(v) => setLocationPrices((p) => ({ ...p, [loc.id]: v }))}
                            placeholder={form.price || "0,00"}
                            className="h-8 w-28 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      Mesmo preço {brl(price || 0)} para todas as lojas.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── LAYER 3: STOCK & LOGISTICS ─── */}
          {openLayers.has("stock") && (
            <div className="animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col gap-6 pt-2">
              {/* SKU + supplier */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="p-sku"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    SKU interno
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id="p-sku"
                      value={form.sku}
                      onChange={(e) => setField("sku", e.target.value)}
                      placeholder={
                        form.categoryId ? "Auto-gerar pela categoria" : "Defina categoria primeiro"
                      }
                      disabled={skuLoading}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={regenSku}
                      disabled={skuLoading || !form.categoryId}
                      title="Gerar SKU automático"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", skuLoading && "animate-spin")} />
                    </Button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="p-supplier"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Fornecedor <span className="font-normal opacity-50">opcional</span>
                  </label>
                  <select
                    id="p-supplier"
                    value={form.supplierId}
                    onChange={(e) => setField("supplierId", e.target.value)}
                    className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]"
                  >
                    <option value="">Nenhum</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock min/ideal + location */}
              <div className="grid gap-6 sm:grid-cols-[1fr_1fr_2fr]">
                <div>
                  <label
                    htmlFor="p-stockmin"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Estoque mín.
                  </label>
                  <Input
                    id="p-stockmin"
                    type="number"
                    min="0"
                    step="any"
                    value={form.stockMin}
                    onChange={(e) => setField("stockMin", e.target.value)}
                    placeholder="0"
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="p-stockideal"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Ideal
                  </label>
                  <Input
                    id="p-stockideal"
                    type="number"
                    min="0"
                    step="any"
                    value={form.stockIdeal}
                    onChange={(e) => setField("stockIdeal", e.target.value)}
                    placeholder="0"
                    className="mt-1.5 font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="p-location"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Localização física
                  </label>
                  <Input
                    id="p-location"
                    value={form.location}
                    onChange={(e) => setField("location", e.target.value)}
                    placeholder="Corredor 3 · Prateleira B"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Logistics: weight + dimensions — collapsed by default */}
              <SubCollapsible
                icon={Truck}
                label="Logística"
                hint="Peso e dimensões para frete"
                hasData={!!(form.weight || form.height || form.width || form.length)}
              >
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <div>
                    <label htmlFor="p-weight" className="block text-[11px] text-muted-foreground">
                      Peso (kg)
                    </label>
                    <Input
                      id="p-weight"
                      type="number"
                      min="0"
                      step="0.001"
                      value={form.weight}
                      onChange={(e) => setField("weight", e.target.value)}
                      placeholder="0,350"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">
                      Dimensões (cm) · A × L × C
                    </span>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.height}
                        onChange={(e) => setField("height", e.target.value)}
                        placeholder="Alt"
                        aria-label="Altura"
                        className="font-mono"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.width}
                        onChange={(e) => setField("width", e.target.value)}
                        placeholder="Larg"
                        aria-label="Largura"
                        className="font-mono"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.length}
                        onChange={(e) => setField("length", e.target.value)}
                        placeholder="Comp"
                        aria-label="Comprimento"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              </SubCollapsible>
            </div>
          )}

          {/* ─── LAYER 4: FISCAL ─── */}
          {openLayers.has("fiscal") && (
            <div className="animate-in fade-in-0 slide-in-from-top-2 duration-200 flex flex-col gap-6 pt-2">
              {taxAiFilled && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2 text-xs text-primary">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Dados fiscais sugeridos pela IA — revise antes de salvar.
                </div>
              )}

              {/* NCM + CEST */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="t-ncm"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    NCM <span className="font-normal opacity-50">8 dígitos</span>
                  </label>
                  <Input
                    id="t-ncm"
                    inputMode="numeric"
                    value={tax.ncm}
                    onChange={(e) =>
                      setTaxField("ncm", e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    placeholder="0000 0000"
                    className={cn(
                      "mt-1.5 font-mono placeholder:text-muted-foreground/25 placeholder:tracking-widest",
                      taxAiFilled && "border-primary/30",
                    )}
                  />
                  {tax.ncmDescription && (
                    <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                      {tax.ncmDescription}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="t-cest"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    CEST <span className="font-normal opacity-50">7 dígitos</span>
                  </label>
                  <Input
                    id="t-cest"
                    inputMode="numeric"
                    value={tax.cest}
                    onChange={(e) =>
                      setTaxField("cest", e.target.value.replace(/\D/g, "").slice(0, 7))
                    }
                    placeholder="0000000"
                    className="mt-1.5 font-mono placeholder:text-muted-foreground/25 placeholder:tracking-widest"
                  />
                </div>
              </div>

              {/* CFOP */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="t-cfop-i"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    CFOP interno
                  </label>
                  <Input
                    id="t-cfop-i"
                    inputMode="numeric"
                    value={tax.cfopInternal}
                    onChange={(e) =>
                      setTaxField("cfopInternal", e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="0000"
                    className="mt-1.5 font-mono placeholder:text-muted-foreground/25 placeholder:tracking-widest"
                  />
                </div>
                <div>
                  <label
                    htmlFor="t-cfop-e"
                    className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    CFOP interestadual
                  </label>
                  <Input
                    id="t-cfop-e"
                    inputMode="numeric"
                    value={tax.cfopInterstate}
                    onChange={(e) =>
                      setTaxField("cfopInterstate", e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="0000"
                    className="mt-1.5 font-mono placeholder:text-muted-foreground/25 placeholder:tracking-widest"
                  />
                </div>
              </div>

              {/* Origin */}
              <div>
                <label
                  htmlFor="t-origin"
                  className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Origem da mercadoria
                </label>
                <select
                  id="t-origin"
                  value={tax.origin}
                  onChange={(e) => setTaxField("origin", e.target.value)}
                  className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]"
                >
                  {ORIGIN_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ICMS */}
              <SubCollapsible
                icon={Receipt}
                label="ICMS"
                hint="CSOSN (Simples Nacional) ou CST (Regime Normal)"
                hasData={!!(tax.icmsCsosn || tax.icmsCst)}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="t-csosn" className="block text-[11px] text-muted-foreground">
                      CSOSN <span className="opacity-60">(Simples)</span>
                    </label>
                    <select
                      id="t-csosn"
                      value={tax.icmsCsosn}
                      onChange={(e) => setTaxField("icmsCsosn", e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]"
                    >
                      <option value="">—</option>
                      {ICMS_CSOSN_OPTS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="t-cst" className="block text-[11px] text-muted-foreground">
                      CST ICMS <span className="opacity-60">(Normal)</span>
                    </label>
                    <select
                      id="t-cst"
                      value={tax.icmsCst}
                      onChange={(e) => setTaxField("icmsCst", e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]"
                    >
                      <option value="">—</option>
                      {ICMS_CST_OPTS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </SubCollapsible>

              {/* PIS / COFINS */}
              <SubCollapsible
                icon={Receipt}
                label="PIS / COFINS"
                hint="CST das contribuições"
                hasData={!!(tax.pisCst || tax.cofinsCst)}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="t-pis" className="block text-[11px] text-muted-foreground">
                      CST PIS
                    </label>
                    <Input
                      id="t-pis"
                      inputMode="numeric"
                      value={tax.pisCst}
                      onChange={(e) =>
                        setTaxField("pisCst", e.target.value.replace(/\D/g, "").slice(0, 2))
                      }
                      placeholder="00"
                      className="mt-1 font-mono placeholder:text-muted-foreground/25 placeholder:tracking-widest"
                    />
                  </div>
                  <div>
                    <label htmlFor="t-cofins" className="block text-[11px] text-muted-foreground">
                      CST COFINS
                    </label>
                    <Input
                      id="t-cofins"
                      inputMode="numeric"
                      value={tax.cofinsCst}
                      onChange={(e) =>
                        setTaxField("cofinsCst", e.target.value.replace(/\D/g, "").slice(0, 2))
                      }
                      placeholder="00"
                      className="mt-1 font-mono placeholder:text-muted-foreground/25 placeholder:tracking-widest"
                    />
                  </div>
                </div>
              </SubCollapsible>

              <p className="text-[11px] text-muted-foreground">
                Dados fiscais só salvam se NCM tiver 8 dígitos válidos.
              </p>
            </div>
          )}
        </section>

        {/* ─── ZONE 3: COMMERCIAL ─── */}
        <aside className="md:col-span-2 lg:col-span-1 lg:sticky lg:top-20 lg:self-start">
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-b from-surface-1/40 to-card p-4 lg:p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent" />

            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Comercial
            </p>

            <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-6 lg:block">
              {/* Price hero */}
              <div className="mt-4">
                <label htmlFor="p-price" className="text-[11px] font-medium text-muted-foreground">
                  Preço de venda
                </label>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono text-base text-muted-foreground/40 lg:text-lg">
                    R$
                  </span>
                  <input
                    ref={priceRef}
                    id="p-price"
                    inputMode="numeric"
                    value={
                      form.price === ""
                        ? ""
                        : (Math.round((Number(form.price) || 0) * 100) / 100).toLocaleString(
                            "pt-BR",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )
                    }
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      if (!digits) return onPriceChange("");
                      onPriceChange((Number(digits) / 100).toFixed(2));
                    }}
                    placeholder="0,00"
                    className="w-full bg-transparent font-mono text-2xl font-semibold leading-none tracking-tight outline-none placeholder:text-muted-foreground/20 lg:text-[26px] xl:text-[30px]"
                  />
                </div>
              </div>

              {/* COL 2: cost / margin / readouts */}
              <div className="md:mt-4 lg:mt-0">
                {/* Cost + Margin */}
                <div className="mt-6 grid grid-cols-2 gap-3 md:mt-0 lg:mt-6">
                  <div>
                    <label
                      htmlFor="p-cost"
                      className="text-[11px] font-medium text-muted-foreground"
                    >
                      Custo
                    </label>
                    <MoneyInput
                      id="p-cost"
                      value={form.cost}
                      onChange={onCostChange}
                      placeholder="0,00"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="p-margin"
                      className="text-[11px] font-medium text-muted-foreground"
                    >
                      Margem %
                    </label>
                    <Input
                      id="p-margin"
                      type="number"
                      min="0"
                      max="99.9"
                      step="0.1"
                      value={form.margin}
                      onChange={(e) => onMarginChange(e.target.value)}
                      placeholder="0,0"
                      className="mt-1 h-9 text-right font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Live readouts */}
                <div className="mt-5 space-y-2.5 border-t border-border/40 pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Margem</span>
                    <Tick
                      value={margin !== null ? `${margin.toFixed(1)}%` : "—"}
                      className={cn("font-mono font-semibold", marginColor)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Lucro</span>
                    <Tick
                      value={profit !== null ? brl(profit) : "—"}
                      className="font-mono font-medium"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Markup</span>
                    <Tick
                      value={markup !== null ? `${markup.toFixed(2)}×` : "—"}
                      className="font-mono text-muted-foreground"
                    />
                  </div>
                </div>

                {margin !== null && margin < 0 && (
                  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    Preço abaixo do custo.
                  </div>
                )}
              </div>
              {/* /COL 2 */}
            </div>
            {/* /md grid */}
          </div>
        </aside>
      </div>

      {/* ── sticky dock ── */}
      <div
        className={cn(
          "sticky bottom-0 z-20 border-t border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8 xl:px-12",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          "transition-shadow duration-200",
          dockShadow && "shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)]",
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  ready ? "bg-emerald-400" : "bg-muted-foreground/30",
                )}
              />
              {ready ? (
                <span>Pronto para publicar</span>
              ) : (
                <span>Faltam: {missing.join(", ")}</span>
              )}
            </div>
            {draftTs && (
              <div
                className="hidden items-center gap-1.5 text-[11px] text-muted-foreground/70 sm:flex"
                title="Rascunho salvo localmente"
              >
                <span className="inline-block h-1 w-1 rounded-full bg-primary/60" />
                Rascunho · {formatAgo(draftTs)} atrás
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-md border border-border/60 bg-surface-1/40 px-2 py-1 text-[10px] text-muted-foreground sm:flex">
              <kbd className="font-mono">⌘</kbd>
              <kbd className="font-mono">⇧</kbd>
              <kbd className="font-mono">↵</kbd>
              <span className="ml-1">novo</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || !ready}
              onClick={() => submit("new")}
              className="gap-1.5"
              title="Salvar e cadastrar próximo"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salvar e novo</span>
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !ready} className="gap-1.5">
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Publicar
            </Button>
          </div>
        </div>
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onScanned={(c) => {
            setScannerOpen(false);
            setField("barcode", c);
            doBarcodeLookup(c.replace(/\D/g, ""));
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
    </form>
  );
}
