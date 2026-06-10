"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createSupplierReturnAction,
  getReceiptAction,
} from "@/features/purchasing/actions/purchasing-actions";

const REASONS: { value: string; label: string }[] = [
  { value: "DEFECT", label: "Defeito/Avaria" },
  { value: "EXPIRY", label: "Vencimento" },
  { value: "WRONG_ITEM", label: "Item Errado" },
  { value: "OVERSTOCK", label: "Excesso de Estoque" },
  { value: "OTHER", label: "Outro" },
];

type Receipt = {
  id: string;
  createdAt: Date;
  supplierName: string;
};

type ReturnLine = {
  goodsReceiptItemId: string;
  name: string;
  received: number;
  unitCost: number;
  quantityToReturn: number;
};

type Props = {
  open: boolean;
  receipts: Receipt[];
  onClose: () => void;
  onCreated: () => void;
};

export function CreateReturnPanel({ open, receipts, onClose, onCreated }: Props) {
  const [, startTransition] = useTransition();
  const [receiptId, setReceiptId] = useState("");
  const [reason, setReason] = useState("DEFECT");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega itens do recibo selecionado
  useEffect(() => {
    if (!receiptId) {
      setLines([]);
      return;
    }
    setLoadingItems(true);
    getReceiptAction(receiptId)
      .then((receipt) => {
        if (!receipt) return;
        setLines(
          receipt.items.map((it) => ({
            goodsReceiptItemId: it.id,
            name: it.product?.name ?? it.productId,
            received: Number(it.receivedQuantity),
            unitCost: Number(it.unitCost),
            quantityToReturn: 0,
          })),
        );
      })
      .finally(() => setLoadingItems(false));
  }, [receiptId]);

  const updateQty = (idx: number, value: number) =>
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, quantityToReturn: Math.min(Math.max(value, 0), l.received) } : l,
      ),
    );

  const toReturn = lines.filter((l) => l.quantityToReturn > 0);
  const canSubmit = receiptId && toReturn.length > 0 && !submitting;

  const reset = () => {
    setReceiptId("");
    setReason("DEFECT");
    setNotes("");
    setLines([]);
    setError(null);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    startTransition(async () => {
      const r = await createSupplierReturnAction({
        goodsReceiptId: receiptId,
        reason: reason as never,
        notes: notes || null,
        items: toReturn.map((l) => ({
          goodsReceiptItemId: l.goodsReceiptItemId,
          quantityToReturn: l.quantityToReturn,
          unitCost: l.unitCost,
        })),
      });
      setSubmitting(false);
      if (!r.success) {
        setError(r.error);
      } else {
        reset();
        onCreated();
        onClose();
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-2xl">
      <SheetHeader
        title="Nova Devolução ao Fornecedor"
        description="Escolha um recebimento confirmado e as quantidades a devolver."
        onClose={onClose}
        actions={
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar devolução"}
          </Button>
        }
      />
      <SheetBody className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ret-receipt">Recebimento</Label>
            <Select
              id="ret-receipt"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {receipts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.supplierName} · #{r.id.slice(0, 8)} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ret-reason">Motivo</Label>
            <Select id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {receipts.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Nenhum recebimento confirmado disponível para devolução.
          </div>
        )}

        {loadingItems ? (
          <p className="text-sm text-muted-foreground">Carregando itens…</p>
        ) : lines.length > 0 ? (
          <div className="space-y-2">
            <Label>Itens a devolver ({toReturn.length})</Label>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-1 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Produto</th>
                    <th className="px-3 py-2 text-right font-medium">Recebido</th>
                    <th className="px-3 py-2 text-right font-medium">Devolver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((l, idx) => (
                    <tr key={l.goodsReceiptItemId}>
                      <td className="px-3 py-2 font-medium text-foreground">{l.name}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{l.received}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          max={l.received}
                          step="0.001"
                          value={l.quantityToReturn}
                          onChange={(e) => updateQty(idx, Number.parseFloat(e.target.value) || 0)}
                          className="h-8 w-24 text-right ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="ret-notes">Observações (opcional)</Label>
          <Textarea
            id="ret-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes da devolução…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar devolução"}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  );
}
