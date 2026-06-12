"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCombobox } from "@/features/inventory/components/product-combobox";
import { setOptionGroupsAction } from "../actions/option-group-actions";

type AvailableProduct = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  productType: string;
};

type EditableOption = {
  componentProductId: string;
  name: string;
  quantity: string;
  priceDelta: string;
  isDefault: boolean;
};

type EditableGroup = {
  name: string;
  required: boolean;
  minSelect: string;
  maxSelect: string;
  options: EditableOption[];
};

type ServerOption = {
  componentProductId: string;
  name: string;
  quantity: { toString(): string };
  priceDelta: { toString(): string };
  isDefault: boolean;
};

type ServerGroup = {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ServerOption[];
};

interface Props {
  organizationId: string;
  productId: string;
  groups: ServerGroup[];
  availableProducts: AvailableProduct[];
}

export function OptionGroupEditor({ organizationId, productId, groups, availableProducts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<EditableGroup[]>(
    groups.map((g) => ({
      name: g.name,
      required: g.required,
      minSelect: String(g.minSelect),
      maxSelect: String(g.maxSelect),
      options: g.options.map((o) => ({
        componentProductId: o.componentProductId,
        name: o.name,
        quantity: String(o.quantity),
        priceDelta: String(o.priceDelta),
        isDefault: o.isDefault,
      })),
    })),
  );

  function addGroup() {
    setItems((prev) => [
      ...prev,
      { name: "", required: true, minSelect: "1", maxSelect: "1", options: [] },
    ]);
  }

  function removeGroup(gi: number) {
    setItems((prev) => prev.filter((_, i) => i !== gi));
  }

  function updateGroup(gi: number, patch: Partial<EditableGroup>) {
    setItems((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }

  function addOption(gi: number) {
    setItems((prev) =>
      prev.map((g, i) =>
        i === gi
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  componentProductId: "",
                  name: "",
                  quantity: "1",
                  priceDelta: "0",
                  isDefault: false,
                },
              ],
            }
          : g,
      ),
    );
  }

  function removeOption(gi: number, oi: number) {
    setItems((prev) =>
      prev.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)),
    );
  }

  function updateOption(gi: number, oi: number, patch: Partial<EditableOption>) {
    setItems((prev) =>
      prev.map((g, i) =>
        i === gi
          ? {
              ...g,
              options: g.options.map((o, j) => {
                if (j !== oi) return o;
                const next = { ...o, ...patch };
                // Auto-preenche o rótulo com o nome do produto ao selecionar
                if (patch.componentProductId && !o.name) {
                  const p = availableProducts.find((ap) => ap.id === patch.componentProductId);
                  if (p) next.name = p.name;
                }
                return next;
              }),
            }
          : g,
      ),
    );
  }

  function handleSave() {
    startTransition(async () => {
      const payload = items.map((g, gi) => ({
        name: g.name.trim(),
        unit: "UN" as const,
        required: g.required,
        minSelect: Number(g.minSelect) || 0,
        maxSelect: Number(g.maxSelect) || 1,
        position: gi,
        options: g.options.map((o, oi) => ({
          componentProductId: o.componentProductId,
          name: o.name.trim(),
          quantity: Number(o.quantity) || 1,
          priceDelta: Number(o.priceDelta) || 0,
          isDefault: o.isDefault,
          position: oi,
        })),
      }));

      const result = await setOptionGroupsAction(organizationId, productId, payload);
      if (result.success) {
        toast.success("Grupos de opção salvos!");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        O produto personalizado não tem estoque próprio. Os itens fixos ficam na aba “Composição”.
        Aqui você define os grupos de escolha que o cliente monta na venda — cada opção baixa o
        estoque de um produto real e pode ter acréscimo de preço.
      </p>

      {items.map((g, gi) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: grupos sem id estável no editor
        <div key={gi} className="rounded-xl border border-border bg-card">
          {/* Group header */}
          <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
            <div className="flex-1 min-w-40 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Nome do grupo</span>
              <Input
                placeholder="Ex: Escolha da Vodka"
                value={g.name}
                onChange={(e) => updateGroup(gi, { name: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={g.required}
                onChange={(e) => updateGroup(gi, { required: e.target.checked })}
              />
              Obrigatório
            </label>
            <div className="w-20 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Mín.</span>
              <Input
                type="number"
                min="0"
                value={g.minSelect}
                onChange={(e) => updateGroup(gi, { minSelect: e.target.value })}
                className="text-right font-mono"
              />
            </div>
            <div className="w-20 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Máx.</span>
              <Input
                type="number"
                min="1"
                value={g.maxSelect}
                onChange={(e) => updateGroup(gi, { maxSelect: e.target.value })}
                className="text-right font-mono"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={() => removeGroup(gi)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2 p-4">
            {g.options.map((o, oi) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: opções sem id estável no editor
              <div key={oi} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-35 flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Produto (insumo)</span>
                  <ProductCombobox
                    products={availableProducts}
                    value={o.componentProductId}
                    onChange={(id) => updateOption(gi, oi, { componentProductId: id })}
                    placeholder="Buscar produto do cadastro…"
                  />
                </div>
                <div className="w-32 flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Rótulo</span>
                  <Input
                    placeholder="Ex: Absolut"
                    value={o.name}
                    onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                  />
                </div>
                <div className="w-20 flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Qtd.</span>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={o.quantity}
                    onChange={(e) => updateOption(gi, oi, { quantity: e.target.value })}
                    className="text-right font-mono"
                  />
                </div>
                <div className="w-24 flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">+ R$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={o.priceDelta}
                    onChange={(e) => updateOption(gi, oi, { priceDelta: e.target.value })}
                    className="text-right font-mono"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => removeOption(gi, oi)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => addOption(gi)}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar opção
            </Button>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
          <ListChecks className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Nenhum grupo de opção</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie grupos como “Escolha da Vodka” para o cliente montar na venda.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline" onClick={addGroup}>
          <Plus className="h-4 w-4" />
          Adicionar grupo
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar grupos"}
        </Button>
      </div>
    </div>
  );
}
