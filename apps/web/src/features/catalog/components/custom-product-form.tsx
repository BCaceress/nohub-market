"use client";

import {
  ArrowLeft,
  ImagePlus,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductCombobox } from "@/features/inventory/components/product-combobox";
import { isCloudinaryConfigured, MAX_IMAGE_BYTES, uploadImageToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { saveCustomProductAction } from "../actions/custom-product-actions";

type AvailableProduct = { id: string; name: string; sku: string | null; unit: string };
type Category = { id: string; name: string; parentId: string | null };

type EditOption = {
  id: string;
  name: string;
  componentProductId: string;
  quantity: string;
  priceDelta: string;
  isDefault: boolean;
};
const newId = () => crypto.randomUUID();
type GroupType = "single" | "multiple";
type GroupUnit =
  | "UN"
  | "KG"
  | "G"
  | "L"
  | "ML"
  | "CX"
  | "PCT"
  | "FARDO"
  | "DZ"
  | "BANDEJA"
  | "CENTO";
type EditGroup = {
  name: string;
  unit: GroupUnit;
  type: GroupType;
  required: boolean;
  maxSelect: string;
  options: EditOption[];
};
type EditFixed = { id: string; componentProductId: string; quantity: string };

const UNIT_OPTIONS = [
  { value: "UN", label: "Unidade (un)" },
  { value: "ML", label: "Mililitro (ml)" },
  { value: "L", label: "Litro (l)" },
  { value: "G", label: "Grama (g)" },
  { value: "KG", label: "Quilo (kg)" },
  { value: "DZ", label: "Dúzia (dz)" },
  { value: "PCT", label: "Pacote (pct)" },
  { value: "CX", label: "Caixa (cx)" },
] as const;

export type CustomProductInitial = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  sku: string | null;
  imageUrl: string | null;
  fixedComponents: Array<{ componentProductId: string; quantity: number }>;
  groups: Array<{
    name: string;
    unit: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: Array<{
      name: string;
      componentProductId: string;
      quantity: number;
      priceDelta: number;
      isDefault: boolean;
    }>;
  }>;
};

interface Props {
  organizationId: string;
  availableProducts: AvailableProduct[];
  categories: Category[];
  product?: CustomProductInitial;
}

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

export function CustomProductForm({
  organizationId,
  availableProducts,
  categories,
  product,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(
    product ? product.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
  );
  // Sempre ativo por padrão — sem toggle nesta tela (gerencie inatividade na lista)
  const isActive = product?.isActive ?? true;
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");

  const [fixed, setFixed] = useState<EditFixed[]>(
    product?.fixedComponents.map((c) => ({
      id: newId(),
      componentProductId: c.componentProductId,
      quantity: String(c.quantity),
    })) ?? [],
  );

  const [groups, setGroups] = useState<EditGroup[]>(
    product?.groups.map((g) => ({
      name: g.name,
      unit: g.unit as GroupUnit,
      type: g.maxSelect > 1 ? "multiple" : "single",
      required: g.required,
      maxSelect: String(g.maxSelect),
      options: g.options.map((o) => ({
        id: newId(),
        name: o.name,
        componentProductId: o.componentProductId,
        quantity: String(o.quantity),
        priceDelta: o.priceDelta.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        isDefault: o.isDefault,
      })),
    })) ?? [],
  );

  const unitOf = (id: string) => availableProducts.find((p) => p.id === id)?.unit ?? "";

  /* ── Fixed items ───────────────────────────────────────── */
  const addFixed = () =>
    setFixed((p) => [...p, { id: newId(), componentProductId: "", quantity: "1" }]);
  const removeFixed = (i: number) => setFixed((p) => p.filter((_, j) => j !== i));
  const updateFixed = (i: number, patch: Partial<EditFixed>) =>
    setFixed((p) => p.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  /* ── Groups ────────────────────────────────────────────── */
  const addGroup = () =>
    setGroups((p) => [
      ...p,
      { name: "", unit: "UN", type: "single", required: true, maxSelect: "1", options: [] },
    ]);
  const removeGroup = (gi: number) => setGroups((p) => p.filter((_, i) => i !== gi));
  const updateGroup = (gi: number, patch: Partial<EditGroup>) =>
    setGroups((p) => p.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const addOption = (gi: number) =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  id: newId(),
                  name: "",
                  componentProductId: "",
                  quantity: "1",
                  priceDelta: "0,00",
                  isDefault: false,
                },
              ],
            }
          : g,
      ),
    );
  const removeOption = (gi: number, oi: number) =>
    setGroups((p) =>
      p.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)),
    );

  const toggleDefault = (gi: number, oi: number) =>
    setGroups((p) =>
      p.map((g, i) => {
        if (i !== gi) return g;
        const single = g.type === "single";
        return {
          ...g,
          options: g.options.map((o, j) => {
            if (j === oi) return { ...o, isDefault: !o.isDefault };
            return single ? { ...o, isDefault: false } : o;
          }),
        };
      }),
    );

  const updateOption = (gi: number, oi: number, patch: Partial<EditOption>) =>
    setGroups((p) =>
      p.map((g, i) =>
        i === gi
          ? {
              ...g,
              options: g.options.map((o, j) => {
                if (j !== oi) return o;
                const next = { ...o, ...patch };
                if (patch.componentProductId && !o.name) {
                  const prod = availableProducts.find((ap) => ap.id === patch.componentProductId);
                  if (prod) next.name = prod.name;
                }
                return next;
              }),
            }
          : g,
      ),
    );

  /* ── Save ──────────────────────────────────────────────── */
  function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: parseBRL(price),
        isActive,
        categoryId: categoryId || "",
        imageUrl: imageUrl || "",
        fixedComponents: fixed
          .filter((f) => f.componentProductId)
          .map((f) => ({
            componentProductId: f.componentProductId,
            quantity: Number(f.quantity) || 1,
          })),
        groups: groups.map((g) => {
          const optCount = g.options.filter((o) => o.componentProductId).length;
          const maxSelect =
            g.type === "single"
              ? 1
              : Math.min(Math.max(1, Number(g.maxSelect) || optCount), Math.max(1, optCount));
          return {
            name: g.name.trim(),
            unit: g.unit,
            required: g.required,
            minSelect: g.required ? 1 : 0,
            maxSelect,
            options: g.options
              .filter((o) => o.componentProductId)
              .map((o) => ({
                name: o.name.trim() || "Opção",
                componentProductId: o.componentProductId,
                quantity: Number(o.quantity) || 1,
                priceDelta: parseBRL(o.priceDelta),
                isDefault: o.isDefault,
              })),
          };
        }),
      };

      const result = await saveCustomProductAction(organizationId, product?.id ?? null, payload);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Produto atualizado!" : "Produto personalizado criado!");
      router.push(`/app/products/${result.data.id}`);
      router.refresh();
    });
  }

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId);

  return (
    <div className="mx-auto w-full max-w-400">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-[16px] font-semibold leading-none">
              {isEdit ? "Editar produto personalizado" : "Novo produto personalizado"}
            </h1>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tipo: Personalizado · montado na venda
              {product?.sku && (
                <span className="ml-2 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[10px]">
                  {product.sku}
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
            {isPending ? "Salvando…" : "Salvar produto"}
          </Button>
        </div>
      </div>

      {/* Two-column layout — cadastro à esquerda, grupos à direita */}
      <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        {/* ═══ LEFT — Dados + itens fixos ═══ */}
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <SectionTitle>Dados do produto</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              {/* Imagem */}
              <div className="sm:row-span-2">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Imagem
                </span>
                <ImagePicker value={imageUrl} onChange={setImageUrl} />
              </div>
              {/* Nome + valor base */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Nome</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Drink Energético"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Valor base (R$)</span>
                <Input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(applyBRLMask(e.target.value))}
                  placeholder="0,00"
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Subcategoria</span>
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
                placeholder="Monte seu drink: vodka + energético + sabor."
                rows={2}
              />
            </div>
          </section>

          {/* Itens fixos */}
          <section className="flex flex-col gap-3">
            <SectionTitle icon={<Layers className="h-3.5 w-3.5" />}>
              Itens fixos (opcional)
            </SectionTitle>
            <p className="text-[12px] text-muted-foreground">
              Insumos que entram sempre, sem o cliente escolher (ex: copo, gelo). Baixam do estoque
              a cada venda.
            </p>
            {fixed.length > 0 && (
              <div className="rounded-xl border border-border">
                {fixed.map((f, i) => (
                  <div
                    key={f.id}
                    className={cn("flex items-end gap-2 p-3", i !== 0 && "border-t border-border")}
                  >
                    <div className="flex-1">
                      <ProductCombobox
                        products={availableProducts}
                        value={f.componentProductId}
                        onChange={(id) => updateFixed(i, { componentProductId: id })}
                      />
                    </div>
                    <div className="w-28">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={f.quantity}
                          onChange={(e) => updateFixed(i, { quantity: e.target.value })}
                          className="text-right font-mono"
                        />
                        <span className="w-7 text-[11px] text-muted-foreground">
                          {unitOf(f.componentProductId)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => removeFixed(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={addFixed}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar item fixo
            </Button>
          </section>
        </div>

        {/* ═══ RIGHT — Grupos de opção ═══ */}
        <section className="flex flex-col gap-4">
          <SectionTitle icon={<ListChecks className="h-3.5 w-3.5" />}>Grupos de opção</SectionTitle>

          {groups.map((g, gi) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: grupos sem id estável
            <div key={gi} className="rounded-xl border border-border bg-card">
              {/* Group config */}
              <div className="flex flex-wrap items-end gap-4 border-b border-border p-4">
                <span className="text-[12px] font-semibold text-muted-foreground">
                  Grupo {gi + 1}
                </span>
                <div className="flex min-w-50 flex-1 flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Nome do grupo</span>
                  <Input
                    value={g.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                    placeholder="Ex: Escolha da Vodka"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Tipo</span>
                  <div className="flex gap-1.5">
                    <TypeChip
                      active={g.type === "single"}
                      onClick={() => updateGroup(gi, { type: "single" })}
                    >
                      Única
                    </TypeChip>
                    <TypeChip
                      active={g.type === "multiple"}
                      onClick={() => updateGroup(gi, { type: "multiple" })}
                    >
                      Múltipla
                    </TypeChip>
                  </div>
                </div>
                {g.type === "multiple" && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Até</span>
                    <Input
                      type="number"
                      min="1"
                      value={g.maxSelect}
                      onChange={(e) => updateGroup(gi, { maxSelect: e.target.value })}
                      className="h-9 w-16 text-right font-mono"
                    />
                  </div>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Unidade</span>
                  <select
                    value={g.unit}
                    onChange={(e) => updateGroup(gi, { unit: e.target.value as GroupUnit })}
                    className="flex h-9 w-28 rounded-lg border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Obrigatório</span>
                  <button
                    type="button"
                    onClick={() => updateGroup(gi, { required: !g.required })}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                      g.required
                        ? "border-primary bg-primary-soft text-foreground"
                        : "border-border bg-surface-1 text-muted-foreground",
                    )}
                  >
                    {g.required ? "Sim" : "Não"}
                  </button>
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

              {/* Options table */}
              <div className="p-4">
                <div className="rounded-lg border border-border">
                  <div className="grid grid-cols-[1.3fr_1fr_6.5rem_5.5rem_3rem_2.5rem] items-center gap-2 rounded-t-lg bg-surface-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Produto estoque</span>
                    <span>Opção (rótulo)</span>
                    <span className="text-right">Quant.</span>
                    <span className="text-right">Acréscimo</span>
                    <span className="text-center">Padrão</span>
                    <span />
                  </div>
                  {g.options.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
                      Nenhuma opção. Adicione abaixo.
                    </p>
                  ) : (
                    g.options.map((o, oi) => (
                      <div
                        key={o.id}
                        className="grid grid-cols-[1.3fr_1fr_6.5rem_5.5rem_3rem_2.5rem] items-center gap-2 border-t border-border px-3 py-2"
                      >
                        <ProductCombobox
                          products={availableProducts}
                          value={o.componentProductId}
                          onChange={(id) => updateOption(gi, oi, { componentProductId: id })}
                        />
                        <Input
                          value={o.name}
                          onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                          placeholder="Rótulo"
                          className="h-9"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={o.quantity}
                            onChange={(e) => updateOption(gi, oi, { quantity: e.target.value })}
                            className="h-9 text-right font-mono"
                          />
                          <span className="w-6 text-[10px] text-muted-foreground">
                            {g.unit.toLowerCase()}
                          </span>
                        </div>
                        <Input
                          inputMode="decimal"
                          value={o.priceDelta}
                          onChange={(e) =>
                            updateOption(gi, oi, { priceDelta: applyBRLMask(e.target.value) })
                          }
                          className="h-9 text-right font-mono"
                          placeholder="0,00"
                        />
                        <button
                          type="button"
                          onClick={() => toggleDefault(gi, oi)}
                          aria-label="Marcar como padrão"
                          title="Pré-selecionada na venda"
                          className="flex h-8 w-full items-center justify-center"
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              o.isDefault
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground/40",
                            )}
                          />
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeOption(gi, oi)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => addOption(gi)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar opção
                </Button>
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-10 text-center">
              <ListChecks className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhum grupo de opção</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie grupos como “Escolha da Vodka” para o cliente montar na venda.
              </p>
            </div>
          )}

          <Button type="button" variant="outline" className="self-start" onClick={addGroup}>
            <Plus className="h-4 w-4" />
            Adicionar grupo
          </Button>
        </section>
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-lg border px-3 text-[13px] font-medium transition-colors",
        active
          ? "border-primary bg-primary-soft text-foreground"
          : "border-border bg-surface-1 text-muted-foreground hover:border-border-strong",
      )}
    >
      {children}
    </button>
  );
}

/* ── Image picker (arquivo via Cloudinary) ─────────────────── */

export function ImagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cloudOn = isCloudinaryConfigured();

  async function handleFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Arquivo não é uma imagem.");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("Imagem acima de 5 MB.");
    setUploading(true);
    try {
      onChange(await uploadImageToCloudinary(file));
      setImgError(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  const hasImage = Boolean(value) && !imgError;

  return (
    <div className="flex flex-col gap-2">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clique abre seletor */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: clique abre seletor */}
      <div
        onClick={() => cloudOn && !uploading && inputRef.current?.click()}
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-1/40 transition-colors",
          cloudOn && !hasImage && "cursor-pointer hover:border-primary/50",
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">Enviando…</span>
          </div>
        ) : hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* biome-ignore lint/performance/noImgElement: URL arbitrária do usuário; next/image exige domínios configurados */}
            <img
              src={value}
              alt="Prévia"
              onError={() => setImgError(true)}
              className="h-full w-full object-contain p-2"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
              aria-label="Remover imagem"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
            <ImagePlus className="h-7 w-7" />
            <span className="text-[11px]">
              {cloudOn ? "Selecionar arquivo" : "Upload indisponível"}
            </span>
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

      {hasImage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Trocar
        </Button>
      )}
    </div>
  );
}
