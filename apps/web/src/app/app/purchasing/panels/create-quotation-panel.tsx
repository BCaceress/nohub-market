"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { searchOrgProductsAction } from "@/features/app/actions/supplier-actions";
import { createQuotationAction } from "@/features/purchasing/actions/purchasing-actions";

type Product = { id: string; name: string; sku: string | null };
type Supplier = { id: string; name: string };
type Location = { id: string; name: string };

type LineItem = { productId: string; name: string; quantity: number };

type Props = {
  open: boolean;
  suppliers: Supplier[];
  locations: Location[];
  products: Product[];
  onClose: () => void;
  onCreated: () => void;
};

export function CreateQuotationPanel({
  open,
  suppliers,
  locations,
  products: initialProducts,
  onClose,
  onCreated,
}: Props) {
  const [, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = (term: string) => {
    setSearch(term);
    startTransition(async () => {
      const r = await searchOrgProductsAction(term || undefined);
      setProducts(r);
    });
  };

  const toggleSupplier = (id: string) =>
    setSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const addItem = (p: Product) =>
    setItems((prev) =>
      prev.some((it) => it.productId === p.id)
        ? prev
        : [...prev, { productId: p.id, name: p.name, quantity: 1 }],
    );

  const updateQty = (idx: number, value: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: value } : it)));

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit =
    description.trim() && locationId && supplierIds.length > 0 && items.length > 0 && !submitting;

  const reset = () => {
    setDescription("");
    setSupplierIds([]);
    setItems([]);
    setDeliveryDate("");
    setSearch("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    startTransition(async () => {
      const r = await createQuotationAction({
        description: description.trim(),
        locationId,
        supplierIds,
        items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        expectedDeliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      });
      setSubmitting(false);
      if (!r.success) {
        setError(r.error);
      } else {
        reset();
        onCreated();
        onClose();
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-2xl">
      <SheetHeader
        title="Nova Cotação"
        description="Descreva a cotação, escolha os fornecedores e os itens a cotar."
        onClose={onClose}
        actions={
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar cotação"}
          </Button>
        }
      />
      <SheetBody className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="q-desc">Descrição</Label>
          <Input
            id="q-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Reposição de bebidas — Junho"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-location">Unidade destino</Label>
            <Select
              id="q-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-delivery">Entrega desejada (opcional)</Label>
            <Input
              id="q-delivery"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </div>

        {/* Fornecedores */}
        <div className="space-y-2">
          <Label>Fornecedores ({supplierIds.length})</Label>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suppliers.map((s) => {
                const active = supplierIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleSupplier(s.id)}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary-soft text-primary-soft-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-border-strong"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Busca de produtos */}
        <div className="space-y-2">
          <Label htmlFor="q-search">Itens a cotar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q-search"
              value={search}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Buscar por nome ou SKU…"
              className="pl-9"
            />
          </div>
          {search && (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {products.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum produto.</p>
              ) : (
                products.slice(0, 30).map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-1"
                  >
                    <span>
                      {p.name}
                      {p.sku && <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>}
                    </span>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Produto</th>
                  <th className="px-3 py-2 text-right font-medium">Quantidade</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it, idx) => (
                  <tr key={it.productId}>
                    <td className="px-3 py-2 font-medium text-foreground">{it.name}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={it.quantity}
                        onChange={(e) => updateQty(idx, Number.parseFloat(e.target.value) || 0)}
                        className="h-8 w-24 text-right ml-auto"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar cotação"}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  );
}
