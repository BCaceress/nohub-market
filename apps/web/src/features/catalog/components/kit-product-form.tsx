"use client";

import { ArrowLeft, Boxes, Layers, Package, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductCombobox } from "@/features/inventory/components/product-combobox";
import { cn } from "@/lib/utils";
import { type KitComponentOption, saveKitProductAction } from "../actions/kit-product-actions";
import { ImagePicker, SectionTitle } from "./custom-product-form";

type Category = { id: string; name: string; parentId: string | null };

export type KitProductInitial = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  imageUrl: string | null;
  components: Array<{ componentProductId: string; quantity: number }>;
};

interface Props {
  organizationId: string;
  availableProducts: KitComponentOption[];
  categories: Category[];
  initialSku?: string;
  product?: KitProductInitial;
}

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const applyBRLMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
const parseBRL = (m: string): number => {
  const d = m.replace(/\D/g, "");
  return d ? parseInt(d, 10) / 100 : 0;
};

type EditItem = { id: string; componentProductId: string; quantity: string };
const newId = () => crypto.randomUUID();

export function KitProductForm({
  organizationId,
  availableProducts,
  categories,
  initialSku,
  product,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [sku, setSku] = useState(product?.sku ?? initialSku ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [price, setPrice] = useState(
    product?.price ? product.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
  );

  const [items, setItems] = useState<EditItem[]>(
    product?.components.map((c) => ({
      id: newId(),
      componentProductId: c.componentProductId,
      quantity: String(c.quantity),
    })) ?? [],
  );

  const optOf = (id: string) => availableProducts.find((p) => p.id === id);

  /* ── Composição ─────────────────────────────────────────── */
  const addItem = () =>
    setItems((p) => [...p, { id: newId(), componentProductId: "", quantity: "1" }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, j) => j !== i));
  const updateItem = (i: number, patch: Partial<EditItem>) =>
    setItems((p) => p.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  /* ── Custo, margem, estoque calculado ───────────────────── */
  const totalCost = items.reduce((sum, it) => {
    const opt = optOf(it.componentProductId);
    return sum + (opt ? opt.cost * (Number(it.quantity) || 0) : 0);
  }, 0);

  const priceValue = parseBRL(price);
  // Margem de lucro (markup sobre custo): preço = custo × (1 + margem/100)
  const margin = totalCost > 0 ? ((priceValue - totalCost) / totalCost) * 100 : 0;

  const setMargin = (raw: string) => {
    const pct = Number(raw.replace(",", "."));
    if (!Number.isFinite(pct) || totalCost <= 0) return;
    const next = totalCost * (1 + pct / 100);
    setPrice(next.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const applySuggestedPrice = () => {
    setPrice(
      totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    );
  };

  // Estoque do kit = menor disponibilidade entre os componentes (inteiro)
  const validItems = items.filter((it) => it.componentProductId && Number(it.quantity) > 0);
  const kitStock =
    validItems.length === 0
      ? 0
      : validItems.reduce((min, it) => {
          const opt = optOf(it.componentProductId);
          const qty = Number(it.quantity) || 0;
          const avail = opt ? Math.floor(opt.stock / qty) : 0;
          return Math.min(min, Math.max(0, avail));
        }, Number.POSITIVE_INFINITY);

  /* ── Salvar ─────────────────────────────────────────────── */
  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome do kit.");
      return;
    }
    const valid = items.filter((it) => it.componentProductId);
    if (valid.length < 2) {
      toast.error("O kit deve possuir no mínimo 2 produtos.");
      return;
    }
    if (valid.some((it) => !(Number(it.quantity) > 0))) {
      toast.error("Quantidade de cada produto deve ser maior que zero.");
      return;
    }

    startTransition(async () => {
      const result = await saveKitProductAction(organizationId, product?.id ?? null, {
        name: name.trim(),
        description: description.trim(),
        sku: sku.trim(),
        categoryId: categoryId || "",
        imageUrl: imageUrl || "",
        isActive,
        price: priceValue,
        components: valid.map((it) => ({
          componentProductId: it.componentProductId,
          quantity: Number(it.quantity) || 1,
        })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Kit atualizado!" : "Kit criado!");
      router.push(`/app/products/${result.data.id}`);
      router.refresh();
    });
  }

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId);

  return (
    <div className="mx-auto w-full max-w-400">
      {/* Sticky header — Ações */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-[16px] font-semibold leading-none">
              {isEdit ? "Editar Kit/Combo" : "Novo Kit/Combo"}
            </h1>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tipo: Kit/Combo · baixa os componentes na venda
              {sku && (
                <span className="ml-2 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[10px]">
                  {sku}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar kit"}
          </Button>
        </div>
      </div>

      {/* Composição ocupa a maior área (coluna direita) */}
      <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        {/* ═══ LEFT — Dados gerais + preço + estoque ═══ */}
        <div className="flex flex-col gap-8">
          {/* Dados Gerais */}
          <section className="flex flex-col gap-4">
            <SectionTitle>Dados gerais</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="sm:row-span-2">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Imagem do kit
                </span>
                <ImagePicker value={imageUrl} onChange={setImageUrl} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Nome do kit *</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Combo Festa"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Código / SKU</span>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Gerado automaticamente"
                  className="font-mono"
                />
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Categoria</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Sem categoria</option>
                {rootCategories.map((root) => {
                  const subs = subCategories.filter((s) => s.parentId === root.id);
                  if (subs.length === 0) return null;
                  return (
                    <optgroup key={root.id} label={root.name}>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Descrição</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição exibida na venda."
                rows={2}
              />
            </div>

            {/* Situação */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Kit ativo</p>
                <p className="text-xs text-muted-foreground">Inativo não aparece nas vendas</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  isActive ? "bg-green-500" : "bg-muted-foreground/30",
                )}
                aria-pressed={isActive}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    isActive ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          </section>

          {/* Preço e Margem */}
          <section className="flex flex-col gap-3">
            <SectionTitle>Preço e margem</SectionTitle>
            <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Custo total dos componentes</span>
                <span className="font-mono font-medium">{BRL(totalCost)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Preço de venda</span>
                  <Input
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(applyBRLMask(e.target.value))}
                    placeholder="0,00"
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Margem (%)</span>
                  <Input
                    inputMode="decimal"
                    value={totalCost > 0 ? margin.toFixed(1) : "—"}
                    onChange={(e) => setMargin(e.target.value)}
                    disabled={totalCost <= 0}
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={applySuggestedPrice}
                disabled={totalCost <= 0}
              >
                Usar custo como preço
              </Button>
            </div>
          </section>

          {/* Estoque calculado */}
          <section className="flex flex-col gap-3">
            <SectionTitle icon={<Boxes className="h-3.5 w-3.5" />}>Estoque calculado</SectionTitle>
            <div className="rounded-xl border border-border bg-muted/10 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Kits disponíveis</span>
                <span className="font-mono text-2xl font-semibold">{kitStock}</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Calculado pela menor disponibilidade entre os componentes. O kit não mantém estoque
                próprio — a venda baixa cada componente.
              </p>
            </div>
          </section>
        </div>

        {/* ═══ RIGHT — Composição (maior área) ═══ */}
        <section className="flex flex-col gap-3">
          <SectionTitle icon={<Layers className="h-3.5 w-3.5" />}>Composição do kit</SectionTitle>
          <p className="text-[12px] text-muted-foreground">
            Somente produtos simples. Mínimo de 2 produtos. O mesmo produto pode ser adicionado mais
            de uma vez (as quantidades são consolidadas).
          </p>

          <div className="rounded-xl border border-border">
            {/* Cabeçalho */}
            <div className="grid grid-cols-[1.6fr_6.5rem_6rem_6rem_2.5rem] items-center gap-2 rounded-t-xl bg-surface-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Produto</span>
              <span className="text-right">Quant.</span>
              <span className="text-right">Custo un.</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Kit vazio</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adicione ao menos 2 produtos que compõem este combo.
                </p>
              </div>
            ) : (
              items.map((it, i) => {
                const opt = optOf(it.componentProductId);
                const qty = Number(it.quantity) || 0;
                const subtotal = opt ? opt.cost * qty : 0;
                return (
                  <div
                    key={it.id}
                    className="grid grid-cols-[1.6fr_6.5rem_6rem_6rem_2.5rem] items-center gap-2 border-t border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <ProductCombobox
                        products={availableProducts}
                        value={it.componentProductId}
                        onChange={(id) => updateItem(i, { componentProductId: id })}
                      />
                      {opt?.sku && (
                        <span className="mt-1 ml-1 block font-mono text-[10px] text-muted-foreground">
                          {opt.sku}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                        className="h-9 text-right font-mono"
                      />
                      <span className="w-6 text-[10px] text-muted-foreground">
                        {opt?.unit?.toLowerCase() ?? ""}
                      </span>
                    </div>
                    <span className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {opt ? BRL(opt.cost) : "—"}
                    </span>
                    <span className="text-right font-mono text-sm tabular-nums">
                      {opt ? BRL(subtotal) : "—"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}

            {/* Rodapé — total */}
            {items.length > 0 && (
              <div className="grid grid-cols-[1.6fr_6.5rem_6rem_6rem_2.5rem] items-center gap-2 border-t border-border bg-surface-1/50 px-3 py-2.5 text-sm">
                <span className="font-medium text-muted-foreground">Custo total</span>
                <span />
                <span />
                <span className="text-right font-mono font-semibold tabular-nums">
                  {BRL(totalCost)}
                </span>
                <span />
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={addItem}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar produto
          </Button>
        </section>
      </div>
    </div>
  );
}
