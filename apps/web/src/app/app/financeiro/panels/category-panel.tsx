"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { upsertCategoryAction } from "@/features/financeiro/actions/financeiro-actions";

type Category = { id: string; name: string; kind: string };

type Props = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
};

export function CategoryPanel({ open, categories, onClose, onChanged }: Props) {
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    startTransition(async () => {
      const r = await upsertCategoryAction({ name, kind });
      setSubmitting(false);
      if (!r.success) setError(r.error);
      else {
        setName("");
        setError(null);
        onChanged();
      }
    });
  };

  const archive = (id: string, c: Category) => {
    startTransition(async () => {
      await upsertCategoryAction({ id, name: c.name, kind: c.kind as never, archived: true });
      onChanged();
    });
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-md">
      <SheetHeader
        title="Categorias financeiras"
        description="Usadas no DRE simplificado para classificar receitas e despesas."
        onClose={onClose}
      />
      <SheetBody className="space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="cat-name">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Aluguel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-kind">Tipo</Label>
            <Select
              id="cat-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as "INCOME" | "EXPENSE")}
            >
              <option value="EXPENSE">Despesa</option>
              <option value="INCOME">Receita</option>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={!name.trim() || submitting}>
            Add
          </Button>
        </div>

        <div className="space-y-1.5">
          {categories.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={c.kind === "INCOME" ? "success" : "warning"}>
                    {c.kind === "INCOME" ? "Receita" : "Despesa"}
                  </Badge>
                  <span className="text-sm text-foreground">{c.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive-soft"
                  onClick={() => archive(c.id, c)}
                >
                  Arquivar
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetBody>
    </Sheet>
  );
}
