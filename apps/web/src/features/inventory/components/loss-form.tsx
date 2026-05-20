"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registerLossAction } from "../actions/inventory-actions";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Location = { id: string; name: string };

type Props = {
  organizationId: string;
  products: Product[];
  locations: Location[];
};

export function LossForm({ organizationId, products, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    locationId: "",
    productId:  "",
    quantity:   "",
    reason:     "DAMAGE" as const,
    note:       "",
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
      const res = await registerLossAction(organizationId, {
        locationId: form.locationId,
        productId:  form.productId,
        quantity:   parseFloat(form.quantity),
        reason:     form.reason,
        note:       form.note,
      });
      if (!res.success) {
        setError(res.error);
      } else {
        setSuccess(`Perda registrada com sucesso! (ID: ${res.data.movementId.slice(-8)})`);
        setForm({ locationId: form.locationId, productId: "", quantity: "", reason: "DAMAGE", note: "" });
      }
    });
  }

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="locationId">Local *</Label>
          <select
            id="locationId"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.locationId}
            onChange={(e) => set("locationId", e.target.value)}
          >
            <option value="">Selecione o local</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productId">Produto *</Label>
          <select
            id="productId"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.productId}
            onChange={(e) => set("productId", e.target.value)}
          >
            <option value="">Selecione o produto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ""}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label htmlFor="reason">Motivo *</Label>
          <select
            id="reason"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.reason}
            onChange={(e) => set("reason", e.target.value as typeof form.reason)}
          >
            <option value="DAMAGE">Avaria / dano</option>
            <option value="EXPIRY">Vencimento</option>
            <option value="THEFT">Furto / roubo</option>
            <option value="MANUAL">Outro (manual)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Justificativa *</Label>
        <Textarea
          id="note"
          placeholder="Descreva o motivo detalhadamente…"
          rows={3}
          required
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      {error   && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="flex gap-3">
        <Button
          type="submit"
          variant="destructive"
          disabled={isPending || !form.locationId || !form.productId || !form.quantity || !form.note}
        >
          {isPending ? "Registrando…" : "Registrar perda"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/inventory")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
