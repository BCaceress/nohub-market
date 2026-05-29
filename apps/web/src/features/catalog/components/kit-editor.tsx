"use client";

import { GripVertical, Layers, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setKitComponentsAction } from "../actions/kit-actions";

type AvailableProduct = {
  id: string;
  name: string;
  unit: string;
  productType: string;
};

type Component = {
  componentProductId: string;
  componentVariantId: string | null;
  quantity: number;
  position: number;
  product: { id: string; name: string; unit: string; price: { toString(): string } };
  variant: { id: string; name: string; sku: string | null } | null;
};

interface Props {
  organizationId: string;
  kitProductId: string;
  components: Component[];
  availableProducts: AvailableProduct[];
}

interface EditableComponent {
  componentProductId: string;
  componentVariantId: string;
  quantity: string;
  position: number;
  label: string;
}

export function KitEditor({ organizationId, kitProductId, components, availableProducts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<EditableComponent[]>(
    components.map((c, i) => ({
      componentProductId: c.componentProductId,
      componentVariantId: c.componentVariantId ?? "",
      quantity: String(c.quantity),
      position: i,
      label: c.variant ? `${c.product.name} — ${c.variant.name}` : c.product.name,
    })),
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [addQty, setAddQty] = useState("1");

  function addItem() {
    if (!selectedProductId || !addQty) return;
    const p = availableProducts.find((p) => p.id === selectedProductId);
    if (!p) return;

    setItems((prev) => [
      ...prev,
      {
        componentProductId: selectedProductId,
        componentVariantId: "",
        quantity: addQty,
        position: prev.length,
        label: p.name,
      },
    ]);
    setSelectedProductId("");
    setAddQty("1");
  }

  function removeItem(i: number) {
    setItems((prev) =>
      prev.filter((_, idx) => idx !== i).map((item, idx) => ({ ...item, position: idx })),
    );
  }

  function updateQty(i: number, value: string) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, quantity: value } : item)));
  }

  async function handleSave() {
    startTransition(async () => {
      const result = await setKitComponentsAction(
        organizationId,
        kitProductId,
        items.map((item) => ({
          componentProductId: item.componentProductId,
          componentVariantId: item.componentVariantId || undefined,
          quantity: Number(item.quantity) || 1,
          position: item.position,
        })),
      );

      if (result.success) {
        toast.success("Composição do kit salva!");
      } else {
        toast.error(result.error);
      }
    });
  }

  // Cost estimate from product.price (rough)
  const _totalCost = items.reduce((sum, item) => {
    const p = availableProducts.find((ap) => ap.id === item.componentProductId);
    return sum + (p ? 0 : 0); // Price not available in availableProducts (simplified)
  }, 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        O kit não tem estoque próprio. Ao ser vendido, baixa o estoque de cada componente (RN-C03).
        Componentes não podem ser outros kits (RN-C04).
      </p>

      {/* Component list */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {items.map((item, i) => (
            <div
              key={`${item.componentProductId}-${item.componentVariantId}`}
              className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantity}
                  onChange={(e) => updateQty(i, e.target.value)}
                  className="w-20 text-right font-mono text-sm h-8"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeItem(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <Layers className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Kit vazio</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione produtos que compõem este combo.
          </p>
        </div>
      )}

      {/* Add component */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 flex flex-col gap-1.5">
          <label htmlFor="kit-add-product" className="text-xs font-medium text-muted-foreground">
            Adicionar produto
          </label>
          <select
            id="kit-add-product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Selecionar produto…</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="w-24 flex flex-col gap-1.5">
          <label htmlFor="kit-add-qty" className="text-xs font-medium text-muted-foreground">
            Qtd.
          </label>
          <Input
            id="kit-add-qty"
            type="number"
            min="0.001"
            step="0.001"
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            className="text-right font-mono"
          />
        </div>
        <Button type="button" variant="outline" onClick={addItem} disabled={!selectedProductId}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {items.length} componente{items.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar composição"}
        </Button>
      </div>
    </div>
  );
}
