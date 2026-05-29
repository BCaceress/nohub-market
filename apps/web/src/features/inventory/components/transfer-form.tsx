"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTransferAction } from "../actions/transfer-actions";

type Product = { id: string; name: string; sku: string | null; unit: string };
type Location = { id: string; name: string };

type Props = {
  organizationId: string;
  products: Product[];
  locations: Location[];
};

export function TransferForm({ organizationId, products, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    fromLocationId: "",
    toLocationId: "",
    productId: "",
    quantity: "",
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

    if (form.fromLocationId === form.toLocationId) {
      setError("Origem e destino devem ser diferentes.");
      return;
    }

    startTransition(async () => {
      const res = await createTransferAction(organizationId, {
        fromLocationId: form.fromLocationId,
        toLocationId: form.toLocationId,
        productId: form.productId,
        quantity: parseFloat(form.quantity),
        note: form.note || undefined,
      });
      if (!res.success) {
        setError(res.error);
      } else {
        setSuccess(`Transferência realizada com sucesso!`);
        setForm({ fromLocationId: "", toLocationId: "", productId: "", quantity: "", note: "" });
      }
    });
  }

  const selectedProduct = products.find((p) => p.id === form.productId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      {/* Locations */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fromLocationId">Origem *</Label>
          <select
            id="fromLocationId"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.fromLocationId}
            onChange={(e) => set("fromLocationId", e.target.value)}
          >
            <option value="">Selecione</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center pb-1">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="toLocationId">Destino *</Label>
          <select
            id="toLocationId"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.toLocationId}
            onChange={(e) => set("toLocationId", e.target.value)}
          >
            <option value="">Selecione</option>
            {locations
              .filter((l) => l.id !== form.fromLocationId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Product + qty */}
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Observação</Label>
        <Textarea
          id="note"
          rows={2}
          placeholder="Motivo da transferência, NF, etc."
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={
            isPending ||
            !form.fromLocationId ||
            !form.toLocationId ||
            !form.productId ||
            !form.quantity
          }
        >
          {isPending ? "Transferindo…" : "Confirmar transferência"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/inventory")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
