"use client";

import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Select } from "@/components/ui/select";
import { findProductByBarcodeWithPackageAction } from "@/features/catalog/actions/package-actions";
import { quickSaleAction } from "@/features/sales/actions/order-actions";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string;
  productType: string;
  imageUrl: string | null;
  categoryName: string | null;
};

type Location = { id: string; name: string };

type CartItem = {
  productId: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
};

type Props = {
  products: Product[];
  locations: Location[];
  defaultLocationId?: string;
  organizationId: string;
  actorId: string;
};

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Dinheiro", icon: Banknote },
  { value: "PIX_MANUAL", label: "Pix", icon: Zap },
  { value: "CARD_PRESENT", label: "Cartão", icon: CreditCard },
  { value: "VOUCHER", label: "Voucher", icon: Tag },
] as const;

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ALL = "__ALL__";

export function POSClient({
  products,
  locations,
  defaultLocationId,
  organizationId,
  actorId,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
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

  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Categories ──────────────────────────────────────────── */
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const key = p.categoryName ?? "Sem categoria";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [products]);

  /* ── Filtered list ───────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== ALL) {
        const cat = p.categoryName ?? "Sem categoria";
        if (cat !== activeCategory) return false;
      }
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    });
  }, [products, search, activeCategory]);

  /* ── Cart ops ────────────────────────────────────────────── */
  const addToCart = useCallback(
    (product: Pick<Product, "id" | "name" | "price" | "unit">, qty = 1) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          return prev.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i,
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            unit: product.unit,
            quantity: qty,
          },
        ];
      });
    },
    [],
  );

  /** Barcode-aware: detecta dígitos 8-14 e busca produto + factor da embalagem. */
  const tryBarcodeLookup = useCallback(
    async (raw: string): Promise<boolean> => {
      const clean = raw.trim().replace(/\D/g, "");
      if (clean.length < 8 || clean.length > 14 || clean !== raw.trim()) return false;
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
    [organizationId, addToCart],
  );

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => setCart([]);

  /* ── Totals ──────────────────────────────────────────────── */
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountValue = Number(discountTotal) || 0;
  const total = Math.max(0, subtotal - discountValue);
  const received = Number(receivedAmount) || 0;
  const change = paymentMethod === "CASH" ? Math.max(0, received - total) : 0;
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

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
  }, [cart, locationId, paymentMethod, receivedAmount, discountTotal, successDialog]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

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
    setError(null);
    setLoading(true);

    try {
      const result = await quickSaleAction({
        organizationId,
        locationId,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
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
      <div className="flex w-[58%] flex-col border-r border-border bg-background">
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
              }}
              className={cn(
                "h-12 w-full rounded-xl border border-border bg-card pl-11 pr-20 text-[15px] text-foreground shadow-xs",
                "placeholder:text-muted-foreground/60",
                "focus:outline-none focus:border-primary focus:ring-4 focus:ring-[var(--primary-ring)]",
              )}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
              <Kbd>/</Kbd>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="flex h-12 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[12px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <Select
                className="h-auto !border-0 !shadow-none !bg-transparent !ring-0 !pl-0 !pr-6 text-[13px] font-medium text-foreground focus-visible:!ring-0"
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
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChip
              active={activeCategory === ALL}
              onClick={() => setActiveCategory(ALL)}
              label="Todos"
              count={products.length}
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
                Tente outro termo, código de barras ou ajuste a categoria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={cn(
                    "group relative flex h-full flex-col items-stretch rounded-xl border border-border bg-card text-left shadow-xs overflow-hidden",
                    "transition-[transform,border-color,box-shadow] duration-150",
                    "hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.97]",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
                    "touch-target",
                  )}
                >
                  {/* Image */}
                  <div className="relative w-full aspect-square bg-surface-1 flex items-center justify-center shrink-0">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-muted-foreground/30 text-3xl select-none">📦</span>
                    )}
                    {p.productType === "FRACTIONED" && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-info-soft px-1.5 py-0.5 text-[9px] font-bold text-info">
                        KG
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex flex-col gap-0.5 p-2">
                    <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground">
                      {p.name}
                    </span>
                    <div className="flex items-baseline justify-between mt-0.5">
                      <span className="font-display text-[13px] font-semibold leading-none tabular-nums text-foreground group-hover:text-primary">
                        {BRL(p.price)}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-subtle">
                        /{p.unit}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          RIGHT — Cart + checkout
          ═══════════════════════════════════════════════════════ */}
      <div className="flex w-[42%] flex-col bg-card">
        {/* Cart header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3.5">
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
              onClick={clearCart}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Limpar
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
              {cart.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-xs transition-colors hover:border-border-strong"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {item.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {BRL(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-1 p-0.5">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, -1)}
                      aria-label="Diminuir"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground touch-target"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono text-[13px] font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, 1)}
                      aria-label="Aumentar"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-primary touch-target"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-20 text-right font-display text-[14px] font-semibold tabular-nums">
                    {BRL(item.price * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    aria-label="Remover"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Checkout panel */}
        <div className="shrink-0 border-t border-border bg-surface-1/40 p-4 safe-bottom">
          {/* Payment chips */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PAYMENT_OPTIONS.map((opt) => {
              const Active = paymentMethod === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setPaymentMethod(opt.value)}
                  className={cn(
                    "flex flex-1 min-w-[88px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12.5px] font-semibold transition-all touch-target",
                    Active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:border-border-strong hover:bg-surface-1",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Quick inputs */}
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor="pos-discount-total" className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                Desconto (R$)
              </span>
              <Input
                id="pos-discount-total"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(e.target.value)}
                className="h-10 text-[15px] tabular-nums"
              />
            </label>
            <label htmlFor="pos-received-amount" className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">
                {paymentMethod === "CASH" ? "Recebido (R$)" : "Recebido"}
              </span>
              <Input
                id="pos-received-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder={paymentMethod === "CASH" ? "0,00" : "—"}
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
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
              <span className="font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
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
