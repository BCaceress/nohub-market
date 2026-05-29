"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { receiveStockAction } from "./actions/stock-actions";

type Product = { id: string; name: string; unit: string };
type Location = { id: string; name: string };

interface Props {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  location: Location;
  product?: Product; // pre-selected when opening from unit stock
  products: Product[];
}

export function ReceiveStockDialog({
  open,
  onClose,
  organizationId,
  location,
  product: preSelectedProduct,
  products,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [productId, setProductId] = useState(preSelectedProduct?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [shelfLocation, setShelfLocation] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setProductId(preSelectedProduct?.id ?? "");
    setQuantity("");
    setCostPrice("");
    setExpiryDate("");
    setBatchCode("");
    setShelfLocation("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await receiveStockAction(organizationId, {
        locationId: location.id,
        productId,
        quantity: Number(quantity),
        costPrice: costPrice ? Number(costPrice) : undefined,
        expiryDate: expiryDate || undefined,
        batchCode: batchCode || undefined,
        shelfLocation: shelfLocation || undefined,
        notes: notes || undefined,
      });
      if (result.success) {
        toast.success("Estoque recebido com sucesso!");
        handleClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar entrada de estoque</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Unidade: <span className="font-medium text-foreground">{location.name}</span>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Product select */}
          {!preSelectedProduct && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-product">Produto *</Label>
              <select
                id="rs-product"
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
          )}

          {preSelectedProduct && (
            <div className="rounded-lg bg-muted/50 px-3.5 py-2.5 text-sm">
              <span className="text-muted-foreground">Produto: </span>
              <span className="font-medium">{preSelectedProduct.name}</span>
            </div>
          )}

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs-qty">
              Quantidade *{selectedProduct ? ` (${selectedProduct.unit})` : ""}
            </Label>
            <Input
              id="rs-qty"
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          {/* Cost price */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs-cost">Custo unitário (R$)</Label>
            <Input
              id="rs-cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Expiry */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-expiry">Validade</Label>
              <Input
                id="rs-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            {/* Batch */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-batch">Lote</Label>
              <Input
                id="rs-batch"
                placeholder="Ex: L001"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
              />
            </div>
          </div>

          {/* Shelf */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs-shelf">Localização na prateleira</Label>
            <Input
              id="rs-shelf"
              placeholder="Ex: A1-02"
              value={shelfLocation}
              onChange={(e) => setShelfLocation(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rs-notes">Observações</Label>
            <Input
              id="rs-notes"
              placeholder="Opcional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !productId || !quantity}>
              {isPending ? "Registrando…" : "Confirmar entrada"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
