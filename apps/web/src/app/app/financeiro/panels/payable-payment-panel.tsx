"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { recordPayablePaymentAction } from "@/features/financeiro/actions/financeiro-actions";

export type PayablePaymentTarget = {
  id: string;
  description: string;
  amount: number;
  paidAmount: number;
  supplierName: string;
};

type Props = {
  open: boolean;
  target: PayablePaymentTarget | null;
  onClose: () => void;
  onDone: () => void;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PayablePaymentPanel({ open, target, onClose, onDone }: Props) {
  const [, startTransition] = useTransition();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = target ? target.amount - target.paidAmount : 0;

  useEffect(() => {
    if (target) {
      setAmount(Math.round((target.amount - target.paidAmount) * 100) / 100);
      setDate(new Date().toISOString().slice(0, 10));
      setError(null);
    }
  }, [target]);

  const handleSubmit = () => {
    if (!target || amount <= 0 || submitting) return;
    setSubmitting(true);
    startTransition(async () => {
      const r = await recordPayablePaymentAction({
        payableId: target.id,
        amount,
        paymentDate: date || undefined,
      });
      setSubmitting(false);
      if (!r.success) setError(r.error);
      else {
        onDone();
        onClose();
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-md">
      <SheetHeader
        title="Baixar conta a pagar"
        description={target ? `${target.supplierName} · ${target.description}` : undefined}
        onClose={onClose}
      />
      <SheetBody className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {target && (
          <div className="rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor total</span>
              <span className="tabular-nums">{brl(target.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Já pago</span>
              <span className="tabular-nums">{brl(target.paidAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
              <span>Em aberto</span>
              <span className="tabular-nums text-warning">{brl(remaining)}</span>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="pay-amount">Valor da baixa</Label>
          <Input
            id="pay-amount"
            type="number"
            min="0"
            step="0.01"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(Number.parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-date">Data do pagamento</Label>
          <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={amount <= 0 || submitting}>
            {submitting ? "Salvando…" : "Confirmar baixa"}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  );
}
