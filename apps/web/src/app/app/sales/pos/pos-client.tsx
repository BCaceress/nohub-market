"use client";

import { useState, useCallback } from "react";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Badge }     from "@/components/ui/badge";
import { Label }     from "@/components/ui/label";
import { Select }    from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { quickSaleAction } from "@/features/sales/actions/order-actions";

type Product = {
  id:          string;
  name:        string;
  sku:         string | null;
  price:       number;
  unit:        string;
  productType: string;
};

type Location = {
  id:   string;
  name: string;
};

type CartItem = {
  productId: string;
  name:      string;
  price:     number;
  unit:      string;
  quantity:  number;
};

type Props = {
  products:       Product[];
  locations:      Location[];
  organizationId: string;
  actorId:        string;
};

const PAYMENT_OPTIONS = [
  { value: "CASH",       label: "Dinheiro"    },
  { value: "PIX_MANUAL", label: "Pix"         },
  { value: "CARD_PRESENT", label: "Cartão"    },
  { value: "VOUCHER",    label: "Voucher"      },
];

export function POSClient({ products, locations, organizationId, actorId }: Props) {
  const [search,         setSearch]         = useState("");
  const [cart,           setCart]           = useState<CartItem[]>([]);
  const [locationId,     setLocationId]     = useState(locations[0]?.id ?? "");
  const [paymentMethod,  setPaymentMethod]  = useState("CASH");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [discountTotal,  setDiscountTotal]  = useState("");
  const [loading,        setLoading]        = useState(false);
  const [successDialog,  setSuccessDialog]  = useState<{
    orderId:      string;
    total:        number;
    changeAmount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())),
  );

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name:      product.name,
          price:     product.price,
          unit:      product.unit,
          quantity:  1,
        },
      ];
    });
  }, []);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const subtotal      = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountValue = Number(discountTotal) || 0;
  const total         = Math.max(0, subtotal - discountValue);
  const received      = Number(receivedAmount) || 0;
  const change        = paymentMethod === "CASH" ? Math.max(0, received - total) : 0;

  const handleSale = async () => {
    if (!locationId) { setError("Selecione um local"); return; }
    if (cart.length === 0) { setError("Carrinho vazio"); return; }
    setError(null);
    setLoading(true);

    try {
      const result = await quickSaleAction({
        organizationId,
        locationId,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity:  i.quantity,
        })),
        paymentMethod:  paymentMethod as "CASH" | "PIX_MANUAL" | "PIX_DYNAMIC" | "CARD_PRESENT" | "CARD_ONLINE" | "VOUCHER",
        receivedAmount: paymentMethod === "CASH" ? received : undefined,
        discountTotal:  discountValue || undefined,
        actorId,
        idempotencyKey: `pos-${actorId}-${Date.now()}`,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setSuccessDialog({
          orderId:      result.orderId,
          total:        result.total,
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
    <>
      {/* Coluna esquerda — catálogo */}
      <div className="flex w-[55%] flex-col border-r">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar produto (nome ou código)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col items-start rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary hover:shadow-md active:scale-95"
              >
                <span className="mb-1 line-clamp-2 text-sm font-medium leading-tight">
                  {p.name}
                </span>
                {p.sku && (
                  <span className="mb-2 text-xs text-muted-foreground">{p.sku}</span>
                )}
                <span className="mt-auto font-bold text-primary">
                  {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">/{p.unit}</span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-muted-foreground">
                Nenhum produto encontrado
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Coluna direita — carrinho + checkout */}
      <div className="flex w-[45%] flex-col bg-muted/30">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">Carrinho</span>
          {cart.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {cart.reduce((s, i) => s + i.quantity, 0)} itens
            </Badge>
          )}
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Clique em um produto para adicionar
            </p>
          ) : (
            cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-2 rounded-lg bg-card p-2 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6"
                    onClick={() => updateQty(item.productId, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-6 w-6"
                    onClick={() => updateQty(item.productId, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <span className="w-20 text-right text-sm font-semibold">
                  {(item.price * item.quantity).toLocaleString("pt-BR", {
                    style:    "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            ))
          )}
        </div>

        <Separator />

        {/* Checkout */}
        <div className="space-y-3 p-4">
          {/* Local */}
          <div className="flex items-center gap-2">
            <Label className="w-24 shrink-0 text-xs">Local</Label>
            <Select
              className="h-8 text-xs"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>

          {/* Desconto */}
          <div className="flex items-center gap-2">
            <Label className="w-24 shrink-0 text-xs">Desconto (R$)</Label>
            <Input
              className="h-8 text-xs"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={discountTotal}
              onChange={(e) => setDiscountTotal(e.target.value)}
            />
          </div>

          {/* Pagamento */}
          <div className="flex items-center gap-2">
            <Label className="w-24 shrink-0 text-xs">Pagamento</Label>
            <Select
              className="h-8 text-xs"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          {/* Valor recebido (só dinheiro) */}
          {paymentMethod === "CASH" && (
            <div className="flex items-center gap-2">
              <Label className="w-24 shrink-0 text-xs">Recebido (R$)</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
              />
            </div>
          )}

          <Separator />

          {/* Totais */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto</span>
                <span>−{discountValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
            {paymentMethod === "CASH" && received > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Troco</span>
                <span>{change.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={cart.length === 0 || loading}
            onClick={handleSale}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando…
              </>
            ) : (
              <>
                {paymentMethod === "CASH" ? (
                  <Banknote className="mr-2 h-4 w-4" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Finalizar Venda
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dialog sucesso */}
      <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Venda realizada!
            </DialogTitle>
          </DialogHeader>
          {successDialog && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pedido</span>
                <span className="font-mono text-xs">{successDialog.orderId.slice(0, 12)}…</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">
                  {successDialog.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              {successDialog.changeAmount > 0 && (
                <div className="flex justify-between rounded bg-blue-50 px-3 py-2 text-sm">
                  <span className="font-medium text-blue-700">Troco</span>
                  <span className="font-bold text-blue-700">
                    {successDialog.changeAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={() => setSuccessDialog(null)}>
              Nova Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
