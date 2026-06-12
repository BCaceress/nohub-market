"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { createReceivableAction } from "@/features/financeiro/actions/financeiro-actions";

type Option = { id: string; name: string | null };

type Props = {
  open: boolean;
  customers: Option[];
  categories: { id: string; name: string; kind: string }[];
  onClose: () => void;
  onCreated: () => void;
};

export function CreateReceivablePanel({ open, customers, categories, onClose, onCreated }: Props) {
  const [, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomeCategories = categories.filter((c) => c.kind === "INCOME");
  const canSubmit = description.trim() && amount > 0 && dueDate && !submitting;

  const reset = () => {
    setDescription("");
    setAmount(0);
    setDueDate(new Date().toISOString().slice(0, 10));
    setCustomerId("");
    setCategoryId("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    startTransition(async () => {
      const r = await createReceivableAction({
        description,
        amount,
        dueDate,
        customerId: customerId || null,
        categoryId: categoryId || null,
      });
      setSubmitting(false);
      if (!r.success) setError(r.error);
      else {
        reset();
        onCreated();
        onClose();
      }
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-lg">
      <SheetHeader
        title="Nova conta a receber"
        description="Lançamento manual de recebível (venda a prazo, crediário, etc.)."
        onClose={onClose}
      />
      <SheetBody className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="recv-desc">Descrição</Label>
          <Input
            id="recv-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Venda a prazo #1234"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="recv-amount">Valor</Label>
            <Input
              id="recv-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recv-due">Vencimento</Label>
            <Input
              id="recv-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="recv-customer">Cliente (opcional)</Label>
            <Select
              id="recv-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recv-category">Categoria (opcional)</Label>
            <Select
              id="recv-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Criando…" : "Criar conta"}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  );
}
