"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { searchOrgProductsAction } from "@/features/app/actions/supplier-actions";
import { createPurchaseOrderAction } from "@/features/purchasing/actions/purchasing-actions";

type Product = { id: string; name: string; sku: string | null };
type Supplier = { id: string; name: string };
type Location = { id: string; name: string };

type LineItem = {
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
};

type Props = {
  open: boolean;
  suppliers: Supplier[];
  locations: Location[];
  products: Product[];
  onClose: () => void;
  /** Após criar — leva para a aba Pedidos e atualiza a lista. */
  onCreated: () => void;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CreatePoPanel({
  open,
  suppliers,
  locations,
  products: initialProducts,
  onClose,
  onCreated,
}: Props) {
  const [, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [items, setItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
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

  const addItem = (p: Product) => {
    setItems((prev) =>
      prev.some((it) => it.productId === p.id)
        ? prev
        : [...prev, { productId: p.id, name: p.name, quantity: 1, unitCost: 0 }],
    );
  };

  const updateItem = (idx: number, key: "quantity" | "unitCost", value: number) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
  const canSubmit = supplierId && locationId && items.length > 0 && !submitting;

  const reset = () => {
    setSupplierId("");
    setItems([]);
    setNotes("");
    setSearch("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    startTransition(async () => {
      const r = await createPurchaseOrderAction({
        supplierId,
        locationId,
        items: items.map((it) => ({
          productId: it.productId,
          expectedQuantity: it.quantity,
          unitCost: it.unitCost,
        })),
        notes: notes || undefined,
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
        title="Novo Pedido de Compra"
        description="Selecione fornecedor, unidade e adicione os itens. O pedido é criado como rascunho."
        onClose={onClose}
        actions={
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar pedido"}
          </Button>
        }
      />
      <SheetBody className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="po-supplier">Fornecedor</Label>
            <Select
              id="po-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-location">Unidade destino</Label>
            <Select
              id="po-location"
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
        </div>

        {/* Busca de produtos */}
        <div className="space-y-2">
          <Label htmlFor="po-search">Adicionar produtos</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="po-search"
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

        {/* Itens selecionados */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Itens ({items.length})</Label>
            <span className="text-sm font-semibold text-foreground">{brl(subtotal)}</span>
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Nenhum item. Use a busca acima.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Produto</th>
                    <th className="px-3 py-2 text-right font-medium">Qtd</th>
                    <th className="px-3 py-2 text-right font-medium">Custo</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
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
                          onChange={(e) =>
                            updateItem(idx, "quantity", Number.parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-20 text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unitCost}
                          onChange={(e) =>
                            updateItem(idx, "unitCost", Number.parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-24 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {brl(it.quantity * it.unitCost)}
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="po-notes">Observações (opcional)</Label>
          <Textarea
            id="po-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condições, prazos, instruções…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar pedido"}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  );
}
