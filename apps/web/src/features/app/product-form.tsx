"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductAction,
  type ProductInput,
  updateProductAction,
} from "./actions/product-actions";

type Supplier = { id: string; name: string };
type Capability = { key: string };

const UNITS = [
  { value: "UN", label: "Unidade (un)" },
  { value: "KG", label: "Quilograma (kg)" },
  { value: "G", label: "Grama (g)" },
  { value: "L", label: "Litro (l)" },
  { value: "ML", label: "Mililitro (ml)" },
  { value: "CX", label: "Caixa (cx)" },
  { value: "PCT", label: "Pacote (pct)" },
];

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border border-input"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  price: { toString(): string };
  costPrice: { toString(): string } | null;
  unit: string;
  supplierId: string | null;
  active: boolean;
  hasAgeRestriction: boolean;
  minAge: number | null;
  expiryDays: number | null;
  allowFractioned: boolean;
};

export type ProductFormInitialValues = {
  name?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  category?: string;
  unit?: string;
};

export function ProductForm({
  organizationId,
  product,
  suppliers,
  capabilities,
  initialValues,
}: {
  organizationId: string;
  product?: Product;
  suppliers: Supplier[];
  capabilities: Capability[];
  initialValues?: ProductFormInitialValues;
}) {
  const router = useRouter();
  const caps = new Set(capabilities.map((c) => c.key));

  type FormState = Omit<ProductInput, "price" | "costPrice"> & {
    price: string;
    costPrice: string;
  };

  const [form, setForm] = useState<FormState>({
    name: product?.name ?? initialValues?.name ?? "",
    description: product?.description ?? initialValues?.description ?? "",
    sku: product?.sku ?? initialValues?.sku ?? "",
    barcode: product?.barcode ?? initialValues?.barcode ?? "",
    price: product?.price.toString() ?? "",
    costPrice: product?.costPrice?.toString() ?? "",
    unit:
      (product?.unit as ProductInput["unit"]) ??
      (initialValues?.unit as ProductInput["unit"]) ??
      "UN",
    supplierId: product?.supplierId ?? "",
    active: product?.active ?? true,
    hasAgeRestriction: product?.hasAgeRestriction ?? false,
    minAge: product?.minAge ?? 18,
    expiryDays: product?.expiryDays ?? undefined,
    allowFractioned: product?.allowFractioned ?? false,
  });
  const [saving, setSaving] = useState(false);

  function set(partial: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: ProductInput = {
      ...form,
      price: Number(form.price),
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      supplierId: form.supplierId || undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      description: form.description || undefined,
    };
    const res = product
      ? await updateProductAction(organizationId, product.id, payload)
      : await createProductAction(organizationId, payload);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(product ? "Produto atualizado!" : "Produto criado!");
    router.push("/app/catalog");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 max-w-2xl">
      {/* Identificação */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex flex-col gap-2">
          <Label>Nome *</Label>
          <Input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ex: Refrigerante 2L"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>SKU (cód. interno)</Label>
          <Input
            value={form.sku ?? ""}
            onChange={(e) => set({ sku: e.target.value })}
            placeholder="REF-001"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Código de barras (EAN)</Label>
          <Input
            value={form.barcode ?? ""}
            onChange={(e) => set({ barcode: e.target.value })}
            placeholder="7891000000000"
            inputMode="numeric"
          />
        </div>
        <div className="sm:col-span-2 flex flex-col gap-2">
          <Label>Descrição</Label>
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Descrição do produto..."
            rows={2}
          />
        </div>
      </div>

      {/* Preço e unidade */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label>Preço de venda (R$) *</Label>
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
        <div className="flex flex-col gap-2">
          <Label>Custo (R$)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.costPrice ?? ""}
            onChange={(e) => set({ costPrice: e.target.value })}
            placeholder="0,00"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Unidade</Label>
          <Select
            value={form.unit}
            onChange={(e) => set({ unit: e.target.value as ProductInput["unit"] })}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Fornecedor */}
      <div className="grid gap-4 sm:grid-cols-2">
        {suppliers.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Fornecedor</Label>
            <Select
              value={form.supplierId ?? ""}
              onChange={(e) => set({ supplierId: e.target.value })}
            >
              <option value="">Nenhum</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Capabilities opcionais */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Restrições e controles</p>
        <Checkbox
          label="Produto ativo"
          checked={form.active}
          onChange={(v) => set({ active: v })}
        />

        {caps.has("product.age_restriction") && (
          <div className="flex flex-col gap-2">
            <Checkbox
              label="Restrição de idade"
              checked={form.hasAgeRestriction}
              onChange={(v) => set({ hasAgeRestriction: v })}
            />
            {form.hasAgeRestriction && (
              <div className="ml-6 flex flex-col gap-1">
                <Label>Idade mínima</Label>
                <Input
                  type="number"
                  min="0"
                  max="99"
                  className="w-24"
                  value={form.minAge ?? 18}
                  onChange={(e) => set({ minAge: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        )}

        {caps.has("product.expiry_tracking") && (
          <div className="flex flex-col gap-2">
            <Label>Validade (dias)</Label>
            <Input
              type="number"
              min="1"
              className="w-32"
              value={form.expiryDays ?? ""}
              onChange={(e) =>
                set({ expiryDays: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Ex: 30"
            />
          </div>
        )}

        {caps.has("product.fractioned_sale") && (
          <Checkbox
            label="Permite venda fracionada"
            checked={form.allowFractioned}
            onChange={(v) => set({ allowFractioned: v })}
          />
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : product ? "Salvar alterações" : "Criar produto"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/catalog")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
