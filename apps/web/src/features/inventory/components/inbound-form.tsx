"use client";

import { Boxes, Check, CircleDollarSign, MapPin, PackagePlus, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { registerInboundAction } from "../actions/inventory-actions";
import { ProductCombobox } from "./product-combobox";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Location = { id: string; name: string };

type Props = {
  organizationId: string;
  products: Product[];
  locations: Location[];
};

const REASONS = [
  { value: "PURCHASE", label: "Compra" },
  { value: "RETURN", label: "Devolução" },
  { value: "MANUAL", label: "Manual" },
  { value: "INITIAL", label: "Saldo inicial" },
  { value: "TRANSFER", label: "Transferência" },
] as const;

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground shadow-xs transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]";

export function InboundForm({ organizationId, products, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    locationId: locations.length === 1 ? (locations[0]?.id ?? "") : "",
    productId: "",
    quantity: "",
    unitCost: "",
    lotCode: "",
    expiryDate: "",
    manufactureDate: "",
    reason: "PURCHASE" as (typeof REASONS)[number]["value"],
    note: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
    setError(null);
    setSuccess(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await registerInboundAction(organizationId, {
        locationId: form.locationId,
        productId: form.productId,
        quantity: parseFloat(form.quantity),
        unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
        lotCode: form.lotCode || undefined,
        expiryDate: form.expiryDate || undefined,
        manufactureDate: form.manufactureDate || undefined,
        reason: form.reason,
        note: form.note || undefined,
      });
      if (!res.success) {
        setError(res.error);
      } else {
        setSuccess(`Entrada registrada! (ID: ${res.data.movementId.slice(-8)})`);
        setForm((prev) => ({
          ...prev,
          productId: "",
          quantity: "",
          unitCost: "",
          lotCode: "",
          expiryDate: "",
          manufactureDate: "",
          note: "",
        }));
      }
    });
  }

  const selectedProduct = products.find((p) => p.id === form.productId);
  const selectedLocation = locations.find((l) => l.id === form.locationId);
  const qty = parseFloat(form.quantity) || 0;
  const cost = parseFloat(form.unitCost) || 0;
  const total = qty * cost;
  const canSubmit = Boolean(form.locationId && form.productId && form.quantity);

  const fmtMoney = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* ── Main column ───────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Destino & produto */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Destino e produto</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="locationId">Local de estoque *</Label>
                <select
                  id="locationId"
                  required
                  className={selectClass}
                  value={form.locationId}
                  onChange={(e) => set("locationId", e.target.value)}
                >
                  <option value="">Selecione o local</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reason">Motivo</Label>
                <select
                  id="reason"
                  className={selectClass}
                  value={form.reason}
                  onChange={(e) => set("reason", e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productId">Produto *</Label>
              <ProductCombobox
                id="productId"
                products={products}
                value={form.productId}
                onChange={(id) => set("productId", id)}
              />
              <p className="text-xs text-muted-foreground">
                {products.length} produtos disponíveis — digite para buscar por nome ou SKU.
              </p>
            </div>
          </div>
        </section>

        {/* Quantidade & custo */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Quantidade e custo</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">
                Quantidade{selectedProduct ? ` (${selectedProduct.unit})` : ""} *
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0.001"
                step="0.001"
                required
                placeholder="0.000"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitCost">Custo unitário (R$)</Label>
              <Input
                id="unitCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.unitCost}
                onChange={(e) => set("unitCost", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Lote */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Lote e validade</h2>
            <span className="text-xs text-muted-foreground">(opcional)</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lotCode">Código do lote</Label>
              <Input
                id="lotCode"
                placeholder="ex: LOT-2025-001"
                value={form.lotCode}
                onChange={(e) => set("lotCode", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiryDate">Validade</Label>
              <Input
                id="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={(e) => set("expiryDate", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufactureDate">Fabricação</Label>
              <Input
                id="manufactureDate"
                type="date"
                value={form.manufactureDate}
                onChange={(e) => set("manufactureDate", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="note">Observação</Label>
            <Textarea
              id="note"
              placeholder="Nota fiscal, fornecedor, observações…"
              rows={2}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
        </section>
      </div>

      {/* ── Summary column ────────────────────────── */}
      <aside className="lg:sticky lg:top-6 flex h-fit flex-col gap-4 rounded-xl border border-border bg-surface-1 p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <PackagePlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Resumo da entrada</h2>
        </div>

        <dl className="flex flex-col gap-3 text-sm">
          <SummaryRow label="Local">{selectedLocation?.name ?? <Muted>—</Muted>}</SummaryRow>
          <SummaryRow label="Produto">{selectedProduct?.name ?? <Muted>—</Muted>}</SummaryRow>
          <SummaryRow label="Quantidade">
            {qty > 0 ? (
              <span className="tabular-nums">
                {qty.toLocaleString("pt-BR")} {selectedProduct?.unit ?? ""}
              </span>
            ) : (
              <Muted>—</Muted>
            )}
          </SummaryRow>
          <SummaryRow label="Custo unit.">
            {cost > 0 ? <span className="tabular-nums">{fmtMoney(cost)}</span> : <Muted>—</Muted>}
          </SummaryRow>
        </dl>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" />
            Valor total
          </span>
          <span className="text-base font-semibold tabular-nums">
            {total > 0 ? fmtMoney(total) : fmtMoney(0)}
          </span>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-1.5 rounded-lg border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-600">
            <Check className="h-3.5 w-3.5 shrink-0" />
            {success}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={isPending || !canSubmit} className="w-full">
            {isPending ? "Registrando…" : "Registrar entrada"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push("/app/inventory")}
          >
            Cancelar
          </Button>
        </div>
      </aside>
    </form>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right font-medium")}>{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted-foreground/60">{children}</span>;
}
