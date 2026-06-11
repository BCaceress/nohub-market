"use client";

import {
  Banknote,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  User,
  UserPlus,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Kbd } from "@/components/ui/kbd";
import { Select } from "@/components/ui/select";
import {
  quickCreateCustomerAction,
  searchCustomersAction,
} from "@/features/app/actions/customer-actions";
import { findProductByBarcodeWithPackageAction } from "@/features/catalog/actions/package-actions";
import { quickSaleAction } from "@/features/sales/actions/order-actions";
import { CashSheet, type ClosedSession, type OpenSession } from "@/features/sales/cash-sheet";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string;
  productType: string;
  compositionKind: string | null; // COMBO | RECIPE (somente KIT)
  imageUrl: string | null;
  categoryName: string | null;
};

type Location = { id: string; name: string };

type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: Array<{
    id: string;
    name: string;
    priceDelta: number;
    isDefault: boolean;
    componentProductId: string;
    stockQty: number; // qtd necessária na unidade de estoque do insumo
  }>;
};

type CartItem = {
  lineId: string; // productId para simples/kit; id único para CUSTOM
  productId: string;
  name: string;
  price: number; // preço unitário (já inclui acréscimos das opções no CUSTOM)
  unit: string;
  quantity: number;
  productType: string;
  compositionKind?: string | null;
  selectedOptionIds?: string[];
  selectionSummary?: string; // "Absolut · Red Bull · Morango"
};

type Props = {
  products: Product[];
  stockByLocation: Record<string, string[]>;
  stockQtyByLocation: Record<string, Record<string, number>>;
  optionGroupsByProduct: Record<string, OptionGroup[]>;
  fixedComponentsByProduct: Record<string, Array<{ componentProductId: string; stockQty: number }>>;
  locations: Location[];
  defaultLocationId?: string;
  organizationId: string;
  actorId: string;
  openSessions: OpenSession[];
  recentClosed: ClosedSession[];
};

/** Métodos válidos no estado de pagamento (cartão guarda crédito/débito). */
const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Dinheiro", icon: Banknote },
  { value: "PIX_MANUAL", label: "Pix", icon: Zap },
  { value: "CARD_CREDIT", label: "Crédito", icon: CreditCard },
  { value: "CARD_DEBIT", label: "Débito", icon: CreditCard },
  { value: "VOUCHER", label: "Voucher", icon: Tag },
] as const;

/** Chips simples (cartão é tratado à parte, com menu crédito/débito). */
const SIMPLE_PAYMENTS = [
  { value: "CASH", label: "Dinheiro", icon: Banknote },
  { value: "PIX_MANUAL", label: "Pix", icon: Zap },
] as const;

const paymentChipClass = (active: boolean) =>
  cn(
    "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12.5px] font-semibold transition-all touch-target",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-sm"
      : "border-border bg-card text-foreground hover:border-border-strong hover:bg-surface-1",
  );

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Máscara BRL: dígitos brutos → "1.234,56" */
const applyBRLMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Converte string mascarada "1.234,56" → 1234.56 */
const parseBRLMask = (masked: string): number => {
  const digits = masked.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

const ALL = "__ALL__";

/** Rótulo do tipo composto para badges (SIMPLE/FRACTIONED não diferenciam). */
const typeBadge = (p: { productType: string; compositionKind?: string | null }) => {
  if (p.productType === "CUSTOM") return { label: "Personalizado", icon: Sparkles };
  if (p.productType === "KIT") {
    return {
      label: p.compositionKind === "RECIPE" ? "Receita" : "Combo",
      icon: Boxes,
    };
  }
  return null;
};

export function POSClient({
  products,
  stockByLocation,
  stockQtyByLocation,
  optionGroupsByProduct,
  fixedComponentsByProduct,
  locations,
  defaultLocationId,
  organizationId,
  actorId,
  openSessions,
  recentClosed,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeType, setActiveType] = useState<"ALL" | "CUSTOM" | "KIT">("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_OPTIONS)[number]["value"]>("CASH");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [discountTotal, setDiscountTotal] = useState("");
  const [loading, setLoading] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{
    orderId: string;
    total: number;
    changeAmount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weightDialog, setWeightDialog] = useState<Product | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  // Cliente vinculado à venda
  const [customer, setCustomer] = useState<{ id: string; name: string | null } | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  // CUSTOM — montagem do produto personalizado
  const [customDialog, setCustomDialog] = useState<Product | null>(null);
  const [customSelected, setCustomSelected] = useState<Record<string, string[]>>({});
  const [customQty, setCustomQty] = useState(1);
  // Caixa — painel lateral + sessão aberta no local atual
  const [cashSheetOpen, setCashSheetOpen] = useState(false);
  const currentSession = useMemo(
    () => openSessions.find((s) => s.locationId === locationId) ?? null,
    [openSessions, locationId],
  );

  const searchRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  /* ── Produtos com estoque no local atual ─────────────────── */
  const inStockIds = useMemo(
    () => new Set(stockByLocation[locationId] ?? []),
    [stockByLocation, locationId],
  );

  /* ── Estoque (quantidade) no local atual — CUSTOM/KIT ────── */
  const stockHere = useMemo(
    () => stockQtyByLocation[locationId] ?? {},
    [stockQtyByLocation, locationId],
  );
  const availQty = useCallback((productId: string) => stockHere[productId] ?? 0, [stockHere]);

  /** Quantas unidades de um CUSTOM/KIT dá pra montar com o estoque atual. */
  const mountableFor = useCallback(
    (productId: string): number => {
      let min = Number.POSITIVE_INFINITY;
      for (const f of fixedComponentsByProduct[productId] ?? []) {
        if (f.stockQty > 0)
          min = Math.min(min, Math.floor(availQty(f.componentProductId) / f.stockQty));
      }
      for (const g of optionGroupsByProduct[productId] ?? []) {
        if (!g.required) continue;
        let best = 0;
        for (const o of g.options) {
          if (o.stockQty > 0)
            best = Math.max(best, Math.floor(availQty(o.componentProductId) / o.stockQty));
        }
        min = Math.min(min, best);
      }
      return min === Number.POSITIVE_INFINITY ? 999 : min;
    },
    [fixedComponentsByProduct, optionGroupsByProduct, availQty],
  );

  /* ── Lista vendável: com estoque (esgotados ficam de fora) ─ */
  const sellable = useMemo(
    () =>
      products.filter((p) => {
        if (!inStockIds.has(p.id)) return false;
        // Compostos sem montável (componente em falta) não aparecem
        if (p.productType === "CUSTOM" || p.productType === "KIT") {
          return mountableFor(p.id) > 0;
        }
        return true;
      }),
    [products, inStockIds, mountableFor],
  );

  const hasCustom = useMemo(() => sellable.some((p) => p.productType === "CUSTOM"), [sellable]);
  const hasKit = useMemo(() => sellable.some((p) => p.productType === "KIT"), [sellable]);

  /* ── Categories (sobre a lista vendável) ─────────────────── */
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of sellable) {
      const key = p.categoryName ?? "Sem categoria";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [sellable]);

  /* ── Filtered list ───────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellable.filter((p) => {
      if (activeType !== "ALL" && p.productType !== activeType) return false;
      if (activeCategory !== ALL) {
        const cat = p.categoryName ?? "Sem categoria";
        if (cat !== activeCategory) return false;
      }
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    });
  }, [sellable, search, activeCategory, activeType]);

  /* ── In-cart quantities (per product, somando linhas) ────── */
  const cartQtyById = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of cart) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    return m;
  }, [cart]);

  /* ── Cart ops ────────────────────────────────────────────── */
  const addToCart = useCallback(
    (
      product: Pick<Product, "id" | "name" | "price" | "unit"> &
        Partial<Pick<Product, "productType" | "compositionKind">>,
      qty = 1,
    ) => {
      setCart((prev) => {
        // Simples/Kit mesclam por productId (lineId === productId)
        const existing = prev.find((i) => i.lineId === product.id);
        if (existing) {
          return prev.map((i) =>
            i.lineId === product.id ? { ...i, quantity: i.quantity + qty } : i,
          );
        }
        return [
          ...prev,
          {
            lineId: product.id,
            productId: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            quantity: qty,
            productType: product.productType ?? "SIMPLE",
            compositionKind: product.compositionKind ?? null,
          },
        ];
      });
    },
    [],
  );

  /** Define quantidade absoluta (usado para produtos fracionados / peso). */
  const setCartQty = useCallback(
    (product: Pick<Product, "id" | "name" | "price" | "unit">, qty: number) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.lineId === product.id);
        if (existing) {
          return prev.map((i) => (i.lineId === product.id ? { ...i, quantity: qty } : i));
        }
        return [
          ...prev,
          {
            lineId: product.id,
            productId: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            quantity: qty,
            productType: "FRACTIONED",
          },
        ];
      });
    },
    [],
  );

  /** Adiciona um produto CUSTOM já montado — sempre nova linha. */
  const addCustomToCart = useCallback(
    (
      product: Product,
      unitPrice: number,
      qty: number,
      selectedOptionIds: string[],
      summary: string,
    ) => {
      setCart((prev) => [
        ...prev,
        {
          lineId:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `custom-${Date.now()}-${Math.random()}`,
          productId: product.id,
          name: product.name,
          price: unitPrice,
          unit: product.unit,
          quantity: qty,
          productType: "CUSTOM",
          selectedOptionIds,
          selectionSummary: summary,
        },
      ]);
    },
    [],
  );

  /** Clique no card: fracionado abre peso; CUSTOM abre montagem; demais somam 1. */
  const handleProductClick = useCallback(
    (product: Product) => {
      // Caixa fechado: nada vai pro carrinho — abre tela de abrir caixa.
      if (!currentSession) {
        toast.error("Abra o caixa deste local para vender.");
        setCashSheetOpen(true);
        return;
      }
      if (product.productType === "FRACTIONED") {
        setWeightInput(String(cartQtyById.get(product.id) ?? ""));
        setWeightDialog(product);
        return;
      }
      if (product.productType === "CUSTOM") {
        const groups = optionGroupsByProduct[product.id] ?? [];
        // Pré-seleciona padrões disponíveis (ou 1ª opção disponível de grupo obrigatório)
        const initial: Record<string, string[]> = {};
        for (const g of groups) {
          const avail = g.options.filter((o) => availQty(o.componentProductId) >= o.stockQty);
          const defaults = avail.filter((o) => o.isDefault).map((o) => o.id);
          if (defaults.length > 0) {
            initial[g.id] = defaults.slice(0, g.maxSelect);
          } else if (g.required && g.minSelect > 0 && avail[0]) {
            initial[g.id] = [avail[0].id];
          } else {
            initial[g.id] = [];
          }
        }
        setCustomSelected(initial);
        setCustomQty(1);
        setCustomDialog(product);
        return;
      }
      addToCart(product);
    },
    [addToCart, cartQtyById, optionGroupsByProduct, availQty, currentSession],
  );

  const confirmWeight = () => {
    if (!weightDialog) return;
    const qty = Number(weightInput.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Informe um peso válido.");
      return;
    }
    setCartQty(weightDialog, qty);
    setWeightDialog(null);
    setWeightInput("");
  };

  /** Barcode-aware: detecta dígitos 8-14 e busca produto + factor da embalagem. */
  const tryBarcodeLookup = useCallback(
    async (raw: string): Promise<boolean> => {
      const clean = raw.trim().replace(/\D/g, "");
      if (clean.length < 8 || clean.length > 14 || clean !== raw.trim()) return false;
      // Caixa fechado: bloqueia leitura de código de barras também.
      if (!currentSession) {
        toast.error("Abra o caixa deste local para vender.");
        setCashSheetOpen(true);
        return false;
      }
      const res = await findProductByBarcodeWithPackageAction(organizationId, clean);
      if (!res) {
        toast.error(`Código ${clean} não encontrado.`);
        return false;
      }
      addToCart(
        { id: res.productId, name: res.name, price: res.price, unit: res.unit },
        res.factor,
      );
      toast.success(`${res.name} +${res.factor}${res.label ? ` (${res.label})` : ""}`, {
        duration: 1500,
      });
      setSearch("");
      return true;
    },
    [organizationId, addToCart, currentSession],
  );

  const updateQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.lineId === lineId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (lineId: string) => {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const clearCart = () => setCart([]);

  /* ── Custom builder helpers ──────────────────────────────── */
  const customGroups = customDialog ? (optionGroupsByProduct[customDialog.id] ?? []) : [];

  const toggleCustomOption = (group: OptionGroup, optionId: string) => {
    const opt = group.options.find((o) => o.id === optionId);
    if (opt && availQty(opt.componentProductId) < opt.stockQty) return; // sem estoque suficiente
    setCustomSelected((prev) => {
      const current = prev[group.id] ?? [];
      const has = current.includes(optionId);
      let next: string[];
      if (group.maxSelect === 1) {
        next = has && !group.required ? [] : [optionId]; // radio
      } else if (has) {
        next = current.filter((id) => id !== optionId);
      } else if (current.length < group.maxSelect) {
        next = [...current, optionId];
      } else {
        return prev; // atingiu o máximo
      }
      return { ...prev, [group.id]: next };
    });
  };

  const customDeltaTotal = customGroups.reduce((sum, g) => {
    const sel = customSelected[g.id] ?? [];
    return sum + g.options.filter((o) => sel.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0);
  }, 0);
  const customBasePrice = customDialog?.price ?? 0;
  const customUnitPrice = customBasePrice + customDeltaTotal;
  const customMaxQty = customDialog ? mountableFor(customDialog.id) : 999;
  const customTotal = customUnitPrice * customQty;

  const customValid = customGroups.every((g) => {
    const count = (customSelected[g.id] ?? []).length;
    if (g.required && count < g.minSelect) return false;
    return count <= g.maxSelect;
  });

  const confirmCustom = () => {
    if (!customDialog || !customValid) return;
    const ids: string[] = [];
    const labels: string[] = [];
    for (const g of customGroups) {
      const sel = customSelected[g.id] ?? [];
      for (const o of g.options) {
        if (sel.includes(o.id)) {
          ids.push(o.id);
          labels.push(o.name);
        }
      }
    }
    addCustomToCart(customDialog, customUnitPrice, customQty, ids, labels.join(" · "));
    setCustomDialog(null);
    setCustomSelected({});
    setCustomQty(1);
  };

  /* ── Totals ──────────────────────────────────────────────── */
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountValue = parseBRLMask(discountTotal);
  const total = Math.max(0, subtotal - discountValue);
  const received = parseBRLMask(receivedAmount);
  const change = paymentMethod === "CASH" ? Math.max(0, received - total) : 0;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const isCardPayment = paymentMethod === "CARD_CREDIT" || paymentMethod === "CARD_DEBIT";
  const cardPaymentLabel =
    paymentMethod === "CARD_CREDIT"
      ? "Crédito"
      : paymentMethod === "CARD_DEBIT"
        ? "Débito"
        : "Cartão";

  /* ── Keyboard shortcuts ──────────────────────────────────── */
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyboard shortcut should use the current checkout state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't capture if user is typing in a number / text field other than search
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        void handleSale();
      }
      if (e.key === "Escape" && !isInput && successDialog) {
        setSuccessDialog(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cart,
    locationId,
    paymentMethod,
    receivedAmount,
    discountTotal,
    successDialog,
    currentSession,
  ]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (weightDialog) {
      const t = setTimeout(() => weightRef.current?.select(), 50);
      return () => clearTimeout(t);
    }
  }, [weightDialog]);

  /* ── Submit sale ─────────────────────────────────────────── */
  const handleSale = async () => {
    if (!locationId) {
      setError("Selecione um local");
      return;
    }
    if (cart.length === 0) {
      setError("Carrinho vazio");
      return;
    }
    if (!currentSession) {
      setError("Abra o caixa deste local antes de vender");
      setCashSheetOpen(true);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const result = await quickSaleAction({
        organizationId,
        locationId,
        cashSessionId: currentSession.id,
        customerId: customer?.id,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          selectedOptionIds: i.selectedOptionIds,
        })),
        paymentMethod,
        receivedAmount: paymentMethod === "CASH" ? received : undefined,
        discountTotal: discountValue || undefined,
        actorId,
        idempotencyKey: `pos-${actorId}-${Date.now()}`,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSuccessDialog({
          orderId: result.orderId,
          total: result.total,
          changeAmount: result.changeAmount,
        });
        setCart([]);
        setSearch("");
        setReceivedAmount("");
        setDiscountTotal("");
        setCustomer(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-surface-1/40">
      {/* ═══════════════════════════════════════════════════════
          LEFT — Product catalog
          ═══════════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col bg-background bg-dot-grid">
        {/* Top bar — search + location */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar produto, código de barras ou SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const clean = search.trim().replace(/\D/g, "");
                  if (clean.length >= 8 && clean === search.trim()) {
                    e.preventDefault();
                    void tryBarcodeLookup(search);
                  }
                }
                if (e.key === "Escape" && search) {
                  setSearch("");
                }
              }}
              className={cn(
                "h-12 w-full rounded-xl border border-border bg-card pl-11 pr-20 text-[15px] text-foreground shadow-xs",
                "placeholder:text-muted-foreground/60",
                "focus:outline-none focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]",
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-1 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Kbd className="pointer-events-none text-muted-foreground">/</Kbd>
              )}
            </span>
          </div>
          {/* Local — somente desktop */}
          <span className="hidden h-12 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[12px] text-muted-foreground md:flex">
            <MapPin className="h-3.5 w-3.5" />
            <Select
              className="h-auto border-0! shadow-none! bg-card! ring-0! pl-0! pr-6! text-[13px] font-medium text-foreground focus-visible:ring-0!"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </span>
          {/* Caixa — sempre visível (texto some no mobile) */}
          <button
            type="button"
            onClick={() => setCashSheetOpen(true)}
            className={cn(
              "flex h-12 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition-colors",
              currentSession
                ? "border-success/30 bg-success-soft text-success hover:bg-success-soft/70"
                : "border-border bg-card text-muted-foreground hover:bg-surface-1 hover:text-foreground",
            )}
            title={currentSession ? "Caixa aberto" : "Caixa fechado — clique para abrir"}
          >
            {currentSession ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Caixa · {BRL(currentSession.cashOnHand)}</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Abrir caixa</span>
              </>
            )}
          </button>
        </div>

        {/* Filters — categorias + tipo */}
        {(categories.length > 0 || hasCustom || hasKit) && (
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChip
              active={activeCategory === ALL}
              onClick={() => setActiveCategory(ALL)}
              label="Todos"
              count={sellable.length}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.name}
                active={activeCategory === c.name}
                onClick={() => setActiveCategory(c.name)}
                label={c.name}
                count={c.count}
              />
            ))}
            {(hasCustom || hasKit) && (
              <>
                <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
                {hasCustom && (
                  <TypeChip
                    active={activeType === "CUSTOM"}
                    onClick={() => setActiveType((t) => (t === "CUSTOM" ? "ALL" : "CUSTOM"))}
                    label="Personalizados"
                    icon={Sparkles}
                  />
                )}
                {hasKit && (
                  <TypeChip
                    active={activeType === "KIT"}
                    onClick={() => setActiveType((t) => (t === "KIT" ? "ALL" : "KIT"))}
                    label="Kits & Combos"
                    icon={Boxes}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-1 text-muted-foreground ring-1 ring-border">
                <Search className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold">Nenhum produto encontrado</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Tente outro termo, código de barras ou ajuste os filtros. Produtos sem estoque não
                são exibidos.
              </p>
              {(activeCategory !== ALL || activeType !== "ALL" || search) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory(ALL);
                    setActiveType("ALL");
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5">
              {filtered.map((p) => {
                const inCartQty = cartQtyById.get(p.id) ?? 0;
                const inCart = inCartQty > 0;
                const isComposable = p.productType === "CUSTOM" || p.productType === "KIT";
                const mountable = isComposable ? mountableFor(p.id) : null;
                const badge = typeBadge(p);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    aria-label={`Adicionar ${p.name}`}
                    className={cn(
                      "group relative flex h-full flex-col items-stretch rounded-xl border bg-card text-left shadow-xs overflow-hidden cursor-pointer",
                      "transition-[transform,border-color,box-shadow] duration-150",
                      "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]",
                      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
                      "touch-target",
                      inCart
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary",
                    )}
                  >
                    {/* In-cart quantity badge */}
                    {inCart && (
                      <span className="absolute left-1.5 top-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground shadow-sm">
                        {inCartQty}
                      </span>
                    )}
                    {/* Image */}
                    <div className="relative w-full aspect-square bg-surface-1 shrink-0 overflow-hidden">
                      {p.imageUrl ? (
                        // biome-ignore lint/performance/noImgElement: external user-provided URL
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 text-3xl select-none">
                          📦
                        </span>
                      )}
                      {p.productType === "FRACTIONED" && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-info-soft px-1.5 py-0.5 text-[9px] font-bold text-info">
                          KG
                        </span>
                      )}
                      {badge && (
                        <span
                          className={cn(
                            "absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm",
                            p.productType === "CUSTOM"
                              ? "bg-primary-soft text-primary"
                              : "bg-info-soft text-info",
                          )}
                        >
                          <badge.icon className="h-2.5 w-2.5" />
                          {badge.label}
                        </span>
                      )}
                      {/* Disponibilidade limitada de compostos */}
                      {mountable !== null && mountable < 999 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-background/85 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-muted-foreground backdrop-blur-sm">
                          {mountable} disp.
                        </span>
                      )}
                      {/* Hover add affordance */}
                      <span
                        className={cn(
                          "absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md",
                          "opacity-0 translate-y-1 transition-all duration-150",
                          "group-hover:opacity-100 group-hover:translate-y-0",
                        )}
                        aria-hidden="true"
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex flex-col gap-0.5 p-2">
                      <span className="line-clamp-2 h-[29px] text-[11px] font-semibold leading-snug text-foreground">
                        {p.name}
                      </span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="font-display text-[13px] font-semibold leading-none tabular-nums text-foreground group-hover:text-primary">
                          {BRL(p.price)}
                          {p.productType === "CUSTOM" && (
                            <span className="ml-0.5 text-[9px] font-medium text-muted-foreground">
                              +
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-subtle">
                          /{p.unit}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          RIGHT — Cart + checkout (largura fixa, mais enxuta)
          ═══════════════════════════════════════════════════════ */}
      <div className="flex w-[348px] shrink-0 flex-col border-l border-border-strong bg-card shadow-[-12px_0_32px_-18px_rgb(26_24_20/0.22)] lg:w-[384px] xl:w-[428px] 2xl:w-[468px]">
        {/* Cart header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-[15px] font-semibold leading-none">Carrinho</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {itemCount === 0 ? "vazio" : `${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setClearConfirm(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>

        {/* Cliente vinculado */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setCustomerDialogOpen(true)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
              customer
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-dashed border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {customer ? (
              <User className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">
              {customer ? (customer.name ?? "Cliente") : "Vincular cliente"}
            </span>
          </button>
          {customer && (
            <button
              type="button"
              onClick={() => setCustomer(null)}
              aria-label="Remover cliente"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-1 text-muted-foreground ring-1 ring-border">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-foreground">Carrinho vazio</p>
              <p className="max-w-[220px] text-[12px] text-muted-foreground">
                Toque em um produto à esquerda ou use o leitor de código de barras para adicionar.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {cart.map((item) => {
                const itemBadge = typeBadge(item);
                return (
                  <li
                    key={item.lineId}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-xs transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[12.5px] font-semibold leading-tight text-foreground">
                            {item.name}
                          </p>
                          {itemBadge && (
                            <span
                              className={cn(
                                "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide",
                                item.productType === "CUSTOM"
                                  ? "bg-primary-soft text-primary"
                                  : "bg-info-soft text-info",
                              )}
                            >
                              <itemBadge.icon className="h-2.5 w-2.5" />
                              {itemBadge.label}
                            </span>
                          )}
                        </div>
                        {item.selectionSummary ? (
                          <p className="truncate text-[10.5px] leading-tight text-primary">
                            {item.selectionSummary}
                          </p>
                        ) : (
                          <p className="font-mono text-[10px] leading-tight text-muted-foreground tabular-nums">
                            {BRL(item.price)} un.
                          </p>
                        )}
                      </div>
                      {/* Stepper — diminuir até 0 remove a linha */}
                      <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-1 p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            item.quantity <= 1
                              ? removeItem(item.lineId)
                              : updateQty(item.lineId, -1)
                          }
                          aria-label={item.quantity <= 1 ? "Remover item" : "Diminuir"}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-destructive touch-target"
                        >
                          {item.quantity <= 1 ? (
                            <Trash2 className="h-3.5 w-3.5" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="w-6 text-center font-mono text-[13px] font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.lineId, 1)}
                          aria-label="Aumentar"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-primary touch-target"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="w-[68px] shrink-0 text-right font-display text-[13.5px] font-semibold leading-none tabular-nums">
                        {BRL(item.price * item.quantity)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Checkout panel */}
        <div className="shrink-0 border-t border-border bg-surface-1/40 p-3.5 safe-bottom">
          {/* Payment chips — Cartão abre menu Crédito/Débito */}
          <div className="mb-3 flex gap-1.5">
            {SIMPLE_PAYMENTS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={paymentChipClass(paymentMethod === opt.value)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}

            {/* Cartão — escolhe crédito ou débito no menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className={paymentChipClass(isCardPayment)} aria-label="Cartão">
                <CreditCard className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{cardPaymentLabel}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                side="top"
                className="min-w-[170px] rounded-xl border-border bg-popover p-1.5 shadow-lg"
              >
                <DropdownMenuItem
                  className="cursor-pointer rounded-md text-[13px]"
                  onClick={() => setPaymentMethod("CARD_CREDIT")}
                >
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Crédito
                  {paymentMethod === "CARD_CREDIT" && (
                    <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer rounded-md text-[13px]"
                  onClick={() => setPaymentMethod("CARD_DEBIT")}
                >
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  Débito
                  {paymentMethod === "CARD_DEBIT" && (
                    <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => setPaymentMethod("VOUCHER")}
              className={paymentChipClass(paymentMethod === "VOUCHER")}
            >
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Voucher</span>
            </button>
          </div>

          {/* Quick inputs */}
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor="pos-discount-total" className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Desconto (R$)
              </span>
              <Input
                id="pos-discount-total"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(applyBRLMask(e.target.value))}
                className="h-10 text-[15px] tabular-nums"
              />
            </label>
            <label htmlFor="pos-received-amount" className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                {paymentMethod === "CASH" ? "Recebido (R$)" : "Recebido"}
              </span>
              <Input
                id="pos-received-amount"
                type="text"
                inputMode="decimal"
                placeholder={paymentMethod === "CASH" ? "0,00" : "—"}
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(applyBRLMask(e.target.value))}
                disabled={paymentMethod !== "CASH"}
                className="h-10 text-[15px] tabular-nums"
              />
            </label>
          </div>

          {/* Totals */}
          <div className="mt-3 space-y-1 rounded-xl bg-card p-3 ring-1 ring-border">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono tabular-nums">{BRL(subtotal)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex items-center justify-between text-[12.5px] text-success">
                <span>Desconto</span>
                <span className="font-mono tabular-nums">− {BRL(discountValue)}</span>
              </div>
            )}
            <div className="my-1 h-px bg-border" />
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
                Total a pagar
              </span>
              <span className="font-display text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {BRL(total)}
              </span>
            </div>
            {paymentMethod === "CASH" && received > 0 && (
              <div
                className={cn(
                  "mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold",
                  received >= total ? "bg-info-soft text-info" : "bg-warning-soft text-warning",
                )}
              >
                <span>{received >= total ? "Troco" : "Falta"}</span>
                <span className="font-mono tabular-nums">
                  {BRL(received >= total ? change : total - received)}
                </span>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-2 rounded-lg bg-destructive-soft px-3 py-2 text-[12px] font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            className="mt-3 w-full"
            size="xl"
            disabled={cart.length === 0 || loading}
            onClick={handleSale}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processando…
              </>
            ) : (
              <>
                <Receipt className="h-5 w-5" />
                Finalizar venda
                <span className="ml-auto flex items-center gap-1 opacity-80">
                  <Kbd className="!bg-white/15 !border-white/10 !text-primary-foreground">F2</Kbd>
                </span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ─── Clear cart confirmation ────────────────────────── */}
      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-center">Limpar carrinho?</DialogTitle>
          </DialogHeader>
          <p className="text-center text-[13px] text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item será removido" : "itens serão removidos"}. Essa
            ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                clearCart();
                setClearConfirm(false);
              }}
            >
              Limpar carrinho
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setClearConfirm(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Weight dialog (produtos fracionados) ───────────── */}
      <Dialog
        open={!!weightDialog}
        onOpenChange={(open) => {
          if (!open) {
            setWeightDialog(null);
            setWeightInput("");
          }
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{weightDialog?.name}</DialogTitle>
          </DialogHeader>
          {weightDialog && (
            <div className="space-y-3 py-1">
              <label htmlFor="pos-weight" className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                  Peso / quantidade ({weightDialog.unit})
                </span>
                <Input
                  id="pos-weight"
                  ref={weightRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,000"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmWeight();
                    }
                  }}
                  className="h-12 text-center font-display text-[22px] tabular-nums"
                />
              </label>
              <div className="flex items-center justify-between rounded-lg bg-surface-1 px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">
                  {BRL(weightDialog.price)} / {weightDialog.unit}
                </span>
                <span className="font-display font-semibold tabular-nums">
                  {BRL(weightDialog.price * (Number(weightInput.replace(",", ".")) || 0))}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" size="lg" onClick={confirmWeight}>
              <Plus className="h-4 w-4" />
              Adicionar ao carrinho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Custom builder dialog (produto personalizado) ─── */}
      <Dialog
        open={!!customDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCustomDialog(null);
            setCustomSelected({});
            setCustomQty(1);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              {customDialog?.name}
            </DialogTitle>
          </DialogHeader>
          {customDialog && (
            <div className="max-h-[50vh] space-y-4 overflow-y-auto py-1">
              {customGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Este produto não tem grupos de opção configurados.
                </p>
              )}
              {customGroups.map((g) => {
                const sel = customSelected[g.id] ?? [];
                const anyAvailable = g.options.some(
                  (o) => availQty(o.componentProductId) >= o.stockQty,
                );
                return (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold">{g.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {g.required ? "Obrigatório" : "Opcional"}
                        {g.maxSelect > 1 ? ` · até ${g.maxSelect}` : ""}
                      </span>
                    </div>
                    {g.required && !anyAvailable && (
                      <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-[11px] font-medium text-warning">
                        Nenhuma opção em estoque — não é possível montar.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-1.5">
                      {g.options.map((o) => {
                        const active = sel.includes(o.id);
                        const inStock = availQty(o.componentProductId) >= o.stockQty;
                        return (
                          <button
                            type="button"
                            key={o.id}
                            disabled={!inStock}
                            onClick={() => toggleCustomOption(g, o.id)}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] transition-colors touch-target",
                              !inStock
                                ? "cursor-not-allowed border-border bg-surface-1 opacity-60"
                                : active
                                  ? "border-primary bg-primary-soft text-foreground"
                                  : "border-border bg-card hover:border-border-strong",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded-full border",
                                  active ? "border-primary bg-primary" : "border-border",
                                )}
                              >
                                {active && <Check className="h-3 w-3 text-primary-foreground" />}
                              </span>
                              {o.name}
                            </span>
                            {!inStock ? (
                              <span className="text-[11px] font-medium text-muted-foreground">
                                Sem estoque
                              </span>
                            ) : (
                              o.priceDelta > 0 && (
                                <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                                  + {BRL(o.priceDelta)}
                                </span>
                              )
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {/* Totalizador — base + adicionais + quantidade */}
            <div className="w-full space-y-1 rounded-lg bg-surface-1 px-3 py-2.5 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base</span>
                <span className="font-mono tabular-nums">{BRL(customBasePrice)}</span>
              </div>
              {customDeltaTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Adicionais</span>
                  <span className="font-mono tabular-nums text-primary">
                    + {BRL(customDeltaTotal)}
                  </span>
                </div>
              )}
              <div className="my-1 h-px bg-border" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                    disabled={customQty <= 1}
                    aria-label="Diminuir quantidade"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground disabled:opacity-40 touch-target"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono text-[13px] font-semibold tabular-nums">
                    {customQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => Math.min(customMaxQty, q + 1))}
                    disabled={customQty >= customMaxQty}
                    aria-label="Aumentar quantidade"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-primary disabled:opacity-40 touch-target"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-subtle">
                    Total
                  </span>
                  <span className="font-display text-[20px] font-semibold leading-none tabular-nums">
                    {BRL(customTotal)}
                  </span>
                </div>
              </div>
            </div>
            <Button className="w-full" size="lg" disabled={!customValid} onClick={confirmCustom}>
              <Plus className="h-4 w-4" />
              Adicionar {customQty > 1 ? `${customQty}× ` : ""}ao carrinho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Success dialog ─────────────────────────────────── */}
      <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle className="text-center">Venda confirmada!</DialogTitle>
          </DialogHeader>
          {successDialog && (
            <div className="space-y-3 py-1">
              <div className="flex justify-between rounded-lg bg-surface-1 px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">Pedido</span>
                <span className="font-mono">{successDialog.orderId.slice(0, 12)}…</span>
              </div>
              <div className="flex items-baseline justify-between px-1">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-subtle">
                  Total
                </span>
                <span className="font-display text-[26px] font-semibold tabular-nums">
                  {BRL(successDialog.total)}
                </span>
              </div>
              {successDialog.changeAmount > 0 && (
                <div className="flex items-baseline justify-between rounded-lg bg-info-soft px-3 py-2.5">
                  <span className="text-[12.5px] font-semibold text-info">Troco</span>
                  <span className="font-display text-[22px] font-semibold tabular-nums text-info">
                    {BRL(successDialog.changeAmount)}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" size="lg" onClick={() => setSuccessDialog(null)}>
              Nova venda
              <Kbd className="!bg-white/15 !border-white/10 !text-primary-foreground">ESC</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerPicker
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        onSelect={(c) => {
          setCustomer(c);
          setCustomerDialogOpen(false);
        }}
      />

      <CashSheet
        open={cashSheetOpen}
        onClose={() => setCashSheetOpen(false)}
        locations={locations}
        openSessions={openSessions}
        recentClosed={recentClosed}
        organizationId={organizationId}
        actorId={actorId}
        defaultLocationId={locationId}
      />
    </div>
  );
}

/* ── Category chip ─────────────────────────────────────────── */

function CategoryChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors touch-target",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-surface-1 hover:text-foreground",
      )}
    >
      {label}
      <Badge
        variant={active ? "secondary" : "outline"}
        className={cn(
          "!px-1.5 !text-[10px] !font-bold",
          active && "!bg-white/15 !text-primary-foreground",
        )}
      >
        {count}
      </Badge>
    </button>
  );
}

/* ── Type chip (Personalizados / Kits & Combos) ────────────── */

function TypeChip({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Sparkles;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors touch-target",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-dashed border-border bg-card text-muted-foreground hover:bg-surface-1 hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/* ── Customer picker (vincular cliente à venda) ────────────── */

type CustomerLite = {
  id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
};

function CustomerPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (c: { id: string; name: string | null }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchCustomersAction(query);
      if (active) {
        setResults(res);
        setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  const handleQuickCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    const res = await quickCreateCustomerAction({ name });
    setCreating(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Cliente criado");
    onSelect({ id: res.data.id, name: res.data.name });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, CPF ou telefone…"
              className="pl-9"
            />
          </div>

          <div className="max-h-[40vh] overflow-y-auto rounded-lg border divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                {query.trim() ? "Nenhum cliente encontrado." : "Digite para buscar."}
              </div>
            ) : (
              results.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelect({ id: c.id, name: c.name })}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-1"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {c.name ?? "Cliente sem nome"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[c.document, c.phone].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {query.trim() && !loading && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleQuickCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Cadastrar “{query.trim()}”
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
