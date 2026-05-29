"use client";

import { DollarSign, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteProductPriceAction, setProductPriceAction } from "../actions/price-actions";

/* ── Types ──────────────────────────────────────────────────── */

type PriceRow = {
  id: string;
  price: { toString(): string };
  promoPrice: { toString(): string } | null;
  cost: { toString(): string } | null;
  validFrom: Date | null;
  validTo: Date | null;
  channel: string | null;
  product: { id: string; name: string };
  variant: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
};

type Product = { id: string; name: string };
type Location = { id: string; name: string };

interface Props {
  organizationId: string;
  prices: PriceRow[];
  products: Product[];
  locations: Location[];
  defaultLocationId?: string;
}

/* ── Channel labels ─────────────────────────────────────────── */

const CHANNEL_OPTIONS = [
  { value: "", label: "— Padrão (sem canal)" },
  { value: "IFOOD", label: "iFood" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "MERCADO_LIVRE", label: "Mercado Livre" },
  { value: "RAPPI", label: "Rappi" },
  { value: "OWN_ECOMMERCE", label: "E-commerce próprio" },
  { value: "OTHER", label: "Outro" },
];

function channelLabel(ch: string | null) {
  return CHANNEL_OPTIONS.find((o) => o.value === (ch ?? ""))?.label ?? ch ?? "—";
}

/* ── Price dialog ────────────────────────────────────────────── */

type PriceForm = {
  productId: string;
  locationId: string;
  channel: string;
  price: string;
  promoPrice: string;
  cost: string;
  validFrom: string;
  validTo: string;
};

const EMPTY_FORM: PriceForm = {
  productId: "",
  locationId: "",
  channel: "",
  price: "",
  promoPrice: "",
  cost: "",
  validFrom: "",
  validTo: "",
};

/* ── Main component ──────────────────────────────────────────── */

export function PriceMatrix({
  organizationId,
  prices: initialPrices,
  products,
  locations,
  defaultLocationId,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PriceForm>(EMPTY_FORM);

  // Filters
  const [filterProduct, setFilterProduct] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterLocation, setFilterLocation] = useState(defaultLocationId ?? "");

  function set(partial: Partial<PriceForm>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: PriceRow) {
    setEditingId(row.id);
    setForm({
      productId: row.product.id,
      locationId: row.location?.id ?? "",
      channel: row.channel ?? "",
      price: row.price.toString(),
      promoPrice: row.promoPrice?.toString() ?? "",
      cost: row.cost?.toString() ?? "",
      validFrom: row.validFrom ? row.validFrom.toISOString().slice(0, 16) : "",
      validTo: row.validTo ? row.validTo.toISOString().slice(0, 16) : "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const toIso = (s: string) => (s ? new Date(s).toISOString() : undefined);
      const result = await setProductPriceAction(organizationId, {
        productId: form.productId,
        locationId: form.locationId || undefined,
        channel: (form.channel || undefined) as never,
        price: Number(form.price),
        promoPrice: form.promoPrice ? Number(form.promoPrice) : undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        validFrom: toIso(form.validFrom),
        validTo: toIso(form.validTo),
      });

      if (result.success) {
        toast.success(editingId ? "Preço atualizado!" : "Preço criado!");
        setDialogOpen(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este preço?")) return;
    startTransition(async () => {
      const result = await deleteProductPriceAction(organizationId, id);
      if (result.success) {
        setPrices((prev) => prev.filter((p) => p.id !== id));
        toast.success("Preço removido");
      } else {
        toast.error(result.error);
      }
    });
  }

  /* ── Filtered rows ─────────────────────────────────────────── */

  const displayed = prices.filter((p) => {
    if (filterProduct && p.product.id !== filterProduct) return false;
    if (filterChannel && (p.channel ?? "") !== filterChannel) return false;
    if (filterLocation && (p.location?.id ?? "") !== filterLocation) return false;
    return true;
  });

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <>
      {/* Filters + action */}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label
            htmlFor="price-filter-product"
            className="text-xs font-medium text-muted-foreground"
          >
            Produto
          </label>
          <select
            id="price-filter-product"
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label
            htmlFor="price-filter-channel"
            className="text-xs font-medium text-muted-foreground"
          >
            Canal
          </label>
          <select
            id="price-filter-channel"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label
            htmlFor="price-filter-location"
            className="text-xs font-medium text-muted-foreground"
          >
            Unidade
          </label>
          <select
            id="price-filter-location"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Todas as unidades</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={openNew} className="shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Novo preço
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Variante</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Promo</TableHead>
            <TableHead className="text-right">Custo</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.length === 0 ? (
            <TableEmpty
              icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
              title="Nenhum preço configurado"
              description="Adicione preços dimensionais por canal, unidade ou variante."
            />
          ) : (
            displayed.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.product.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {row.variant?.name ?? "—"}
                </TableCell>
                <TableCell>
                  {row.channel ? (
                    <Badge variant="secondary" className="text-xs">
                      {channelLabel(row.channel)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Padrão</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.location?.name ?? "Todas"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  R$ {Number(row.price.toString()).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                  {row.promoPrice ? `R$ ${Number(row.promoPrice.toString()).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {row.cost ? `R$ ${Number(row.cost.toString()).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar preço" : "Novo preço"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {/* Product */}
            <div className="flex flex-col gap-1.5">
              <Label>Produto *</Label>
              <select
                value={form.productId}
                onChange={(e) => set({ productId: e.target.value })}
                required
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Selecionar produto…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensions */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Canal</Label>
                <select
                  value={form.channel}
                  onChange={(e) => set({ channel: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unidade (opcional)</Label>
                <select
                  value={form.locationId}
                  onChange={(e) => set({ locationId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">Todas as unidades</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prices */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Preço (R$) *</Label>
                <Input
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
                <Label>Promo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.promoPrice}
                  onChange={(e) => set({ promoPrice: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Custo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => set({ cost: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Promo window */}
            {form.promoPrice && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 p-3">
                <p className="sm:col-span-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Janela de vigência da promoção (RN-C09)
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(e) => set({ validFrom: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Fim *</Label>
                  <Input
                    type="datetime-local"
                    value={form.validTo}
                    onChange={(e) => set({ validTo: e.target.value })}
                    required={!!form.promoPrice}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
