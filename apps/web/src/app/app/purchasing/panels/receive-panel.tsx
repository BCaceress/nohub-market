"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import {
  confirmReceiptAction,
  getPurchaseOrderAction,
  registerReceiptAction,
} from "@/features/purchasing/actions/purchasing-actions";

type ReceiptItemState = {
  purchaseOrderItemId: string;
  productId: string;
  variantId: string | null;
  productLabel: string;
  variantLabel: string | null;
  expectedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
};

type Props = {
  open: boolean;
  poId: string | null;
  onClose: () => void;
  /** Chamado após confirmar recebimento (atualiza estoque). */
  onDone: () => void;
};

export function ReceivePanel({ open, poId, onClose, onDone }: Props) {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [items, setItems] = useState<ReceiptItemState[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // Carrega PO ao abrir
  useEffect(() => {
    if (!open || !poId) return;
    setLoading(true);
    setError(null);
    setReceiptId(null);
    setInvoiceNumber("");
    getPurchaseOrderAction(poId)
      .then((po) => {
        if (!po) {
          setError("Pedido não encontrado.");
          return;
        }
        setSupplierName(po.supplier?.name ?? "—");
        setItems(
          po.items.map((item) => ({
            purchaseOrderItemId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productLabel: item.productNameSnapshot ?? item.product?.name ?? item.productId,
            variantLabel: item.variant?.name ?? null,
            expectedQuantity: Number(item.expectedQuantity),
            receivedQuantity: Number(item.expectedQuantity),
            unitCost: Number(item.unitCost),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [open, poId]);

  const updateItem = (idx: number, key: "receivedQuantity" | "unitCost", value: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const handleRegister = () => {
    if (!poId) return;
    startTransition(async () => {
      const r = await registerReceiptAction({
        purchaseOrderId: poId,
        items: items.map((it) => ({
          purchaseOrderItemId: it.purchaseOrderItemId,
          productId: it.productId,
          variantId: it.variantId,
          receivedQuantity: it.receivedQuantity,
          unitCost: it.unitCost,
        })),
        supplierInvoiceNumber: invoiceNumber || null,
      });
      if (!r.success) setError(r.error);
      else {
        setError(null);
        setReceiptId(r.receiptId);
      }
    });
  };

  const handleConfirm = () => {
    if (!receiptId) return;
    startTransition(async () => {
      const r = await confirmReceiptAction(receiptId);
      if (!r.success) setError(r.error);
      else {
        setError(null);
        onDone();
        onClose();
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-2xl">
      <SheetHeader
        title={`Receber de ${supplierName || "…"}`}
        description="Confira quantidades e custos, registre e confirme para atualizar o estoque."
        onClose={onClose}
      />
      <SheetBody className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando pedido…</p>
        ) : receiptId ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-soft px-4 py-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-medium text-success">Rascunho de recebimento criado</p>
                <p className="mt-0.5 text-sm text-success/80">ID: {receiptId.slice(0, 8)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Confirme o recebimento para dar entrada no estoque.
            </p>
            <Button onClick={handleConfirm}>Confirmar Recebimento (Atualizar Estoque)</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-invoice-number">Número da Nota Fiscal (opcional)</Label>
              <Input
                id="receipt-invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ex: 000001"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Produto</th>
                    <th className="px-4 py-3 text-right font-medium">Pedida</th>
                    <th className="px-4 py-3 text-right font-medium">Recebida</th>
                    <th className="px-4 py-3 text-right font-medium">Custo Unit.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={item.purchaseOrderItemId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{item.productLabel}</p>
                        {item.variantLabel && (
                          <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {item.expectedQuantity}
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.receivedQuantity}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              "receivedQuantity",
                              Number.parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 w-24 text-right ml-auto"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={item.unitCost}
                          onChange={(e) =>
                            updateItem(idx, "unitCost", Number.parseFloat(e.target.value) || 0)
                          }
                          className="h-8 w-28 text-right ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleRegister} disabled={items.length === 0}>
              Registrar Recebimento
            </Button>
          </div>
        )}
      </SheetBody>
    </Sheet>
  );
}
