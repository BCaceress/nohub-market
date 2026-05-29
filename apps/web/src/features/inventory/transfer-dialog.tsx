"use client";

import { ArrowRight } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransferAction } from "./actions/stock-actions";

type Product = { id: string; name: string; unit: string };
type Location = { id: string; name: string };

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  locations: Location[];
  products: Product[];
  defaultFromLocationId?: string;
  defaultProductId?: string;
}

export function TransferDialog({
  open,
  onClose,
  organizationId,
  locations,
  products,
  defaultFromLocationId,
  defaultProductId,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [fromLocationId, setFromLocationId] = useState(defaultFromLocationId ?? "");
  const [toLocationId, setToLocationId] = useState("");
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setFromLocationId(defaultFromLocationId ?? "");
    setToLocationId("");
    setProductId(defaultProductId ?? "");
    setQuantity("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTransferAction(organizationId, {
        fromLocationId,
        toLocationId,
        productId,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
      if (result.success) {
        toast.success("Transferência realizada com sucesso!");
        handleClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const fromName = locations.find((l) => l.id === fromLocationId)?.name;
  const toName = locations.find((l) => l.id === toLocationId)?.name;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Transferir estoque entre unidades</DialogTitle>
        </DialogHeader>

        {fromName && toName && (
          <div className="flex items-center gap-2 text-sm -mt-1">
            <span className="font-medium text-foreground">{fromName}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{toName}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* From */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-from">Unidade de origem *</Label>
            <select
              id="tf-from"
              value={fromLocationId}
              onChange={(e) => setFromLocationId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring"
            >
              <option value="">Selecionar unidade…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-to">Unidade de destino *</Label>
            <select
              id="tf-to"
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring"
            >
              <option value="">Selecionar unidade…</option>
              {locations
                .filter((l) => l.id !== fromLocationId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-product">Produto *</Label>
            <select
              id="tf-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring"
            >
              <option value="">Selecionar produto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-qty">
              Quantidade *{selectedProduct ? ` (${selectedProduct.unit})` : ""}
            </Label>
            <Input
              id="tf-qty"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tf-notes">Observações</Label>
            <Input
              id="tf-notes"
              placeholder="Motivo da transferência (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !fromLocationId || !toLocationId || !productId || !quantity}
            >
              {isPending ? "Transferindo…" : "Confirmar transferência"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
