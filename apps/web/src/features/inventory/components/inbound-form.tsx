"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registerInboundAction } from "../actions/inventory-actions";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Location = { id: string; name: string };

type Props = {
  organizationId: string;
  products: Product[];
  locations: Location[];
};

export function InboundForm({ organizationId, products, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    locationId: "",
    productId: "",
    quantity: "",
    unitCost: "",
    lotCode: "",
    expiryDate: "",
    manufactureDate: "",
    reason: "PURCHASE" as const,
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
        setSuccess(`Entrada registrada com sucesso! (ID: ${res.data.movementId.slice(-8)})`);
        setForm({
          locationId: form.locationId,
          productId: "",
          quantity: "",
          unitCost: "",
          lotCode: "",
          expiryDate: "",
          manufactureDate: "",
          reason: "PURCHASE",
          note: "",
        });
      }
    });
  }

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produto e local</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
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
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` — ${p.sku}` : ""}
                  </option>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Motivo</Label>
            <select
              id="reason"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.reason}
              onChange={(e) => set("reason", e.target.value as typeof form.reason)}
            >
              <option value="PURCHASE">Compra</option>
              <option value="RETURN">Devolução</option>
              <option value="MANUAL">Manual</option>
              <option value="INITIAL">Saldo inicial</option>
              <option value="TRANSFER">Transferência</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lote (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
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
              <Label htmlFor="expiryDate">Data de validade</Label>
              <Input
                id="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={(e) => set("expiryDate", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufactureDate">Data de fabricação</Label>
              <Input
                id="manufactureDate"
                type="date"
                value={form.manufactureDate}
                onChange={(e) => set("manufactureDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Observação</Label>
        <Textarea
          id="note"
          placeholder="Nota fiscal, fornecedor, observações…"
          rows={2}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending || !form.locationId || !form.productId || !form.quantity}
        >
          {isPending ? "Registrando…" : "Registrar entrada"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/inventory")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
