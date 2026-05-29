"use client";

import { Barcode, Check, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteProductPackageAction,
  type ProductPackage,
  upsertProductPackageAction,
} from "@/features/catalog/actions/package-actions";

interface Props {
  organizationId: string;
  productId: string;
  initialPackages: ProductPackage[];
}

type Draft = {
  id?: string;
  label: string;
  factor: string;
  barcode: string;
  isDefault: boolean;
};

const EMPTY_DRAFT: Draft = {
  label: "",
  factor: "1",
  barcode: "",
  isDefault: false,
};

export function PackagesEditor({ organizationId, productId, initialPackages }: Props) {
  const [packages, setPackages] = useState<ProductPackage[]>(initialPackages);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isPending, startTransition] = useTransition();

  function startNew() {
    setDraft({ ...EMPTY_DRAFT });
  }

  function startEdit(p: ProductPackage) {
    setDraft({
      id: p.id,
      label: p.label ?? "",
      factor: String(p.factor),
      barcode: p.barcode,
      isDefault: p.isDefault,
    });
  }

  function cancel() {
    setDraft(null);
  }

  function save() {
    if (!draft) return;
    const factor = Number(draft.factor);
    if (!Number.isFinite(factor) || factor <= 0) {
      toast.error("Fator deve ser maior que zero.");
      return;
    }
    if (!draft.barcode.trim()) {
      toast.error("Informe o código de barras.");
      return;
    }
    startTransition(async () => {
      const res = await upsertProductPackageAction(organizationId, productId, {
        id: draft.id,
        barcode: draft.barcode,
        label: draft.label || null,
        factor,
        isDefault: draft.isDefault,
        sortOrder: Math.round(factor * 100),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const updated: ProductPackage = {
        id: res.id,
        barcode: draft.barcode.trim(),
        label: draft.label || null,
        factor,
        isDefault: draft.isDefault,
        sortOrder: Math.round(factor * 100),
        type: draft.barcode.length === 14 ? "DUN14" : draft.barcode.length === 8 ? "EAN8" : "EAN13",
      };
      setPackages((prev) => {
        const next = draft.id
          ? prev.map((p) => (p.id === draft.id ? updated : p))
          : [...prev, updated];
        if (draft.isDefault) {
          for (const p of next) if (p.id !== updated.id) p.isDefault = false;
        }
        return next.sort((a, b) => a.factor - b.factor);
      });
      setDraft(null);
      toast.success(draft.id ? "Embalagem atualizada." : "Embalagem cadastrada.");
    });
  }

  function remove(id: string) {
    if (!confirm("Remover esta embalagem?")) return;
    startTransition(async () => {
      const res = await deleteProductPackageAction(id);
      if (!res.success) {
        toast.error(res.error ?? "Erro");
        return;
      }
      setPackages((prev) => prev.filter((p) => p.id !== id));
      toast.success("Embalagem removida.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Embalagens</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cadastre múltiplos códigos por produto. No PDV, cada bipada soma o fator correspondente
            (unidade → 1, fardo → 6, caixa → 24).
          </p>
        </div>
        {!draft && (
          <Button type="button" size="sm" onClick={startNew}>
            <Plus className="h-3.5 w-3.5" />
            Nova embalagem
          </Button>
        )}
      </div>

      {packages.length === 0 && !draft && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center">
          <Barcode className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma embalagem cadastrada</p>
          <p className="text-xs text-muted-foreground/70">
            Clique em "Nova embalagem" para adicionar a primeira.
          </p>
        </div>
      )}

      {(packages.length > 0 || draft) && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_1fr_auto] gap-3 px-4 py-2.5 bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Embalagem</span>
            <span className="text-right">Fator</span>
            <span>Código</span>
            <span className="w-20" />
          </div>

          {packages.map((p) => {
            const isEditing = draft?.id === p.id;
            if (isEditing && draft)
              return (
                <DraftRow
                  key={p.id}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={cancel}
                  pending={isPending}
                />
              );
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_80px_1fr_auto] items-center gap-3 px-4 py-2.5 border-t border-border text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {p.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                  <span className="truncate font-medium">{p.label ?? "—"}</span>
                </div>
                <span className="text-right font-mono">{p.factor}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-mono text-xs">{p.barcode}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {p.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => startEdit(p)}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(p.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {draft && !draft.id && (
            <DraftRow
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancel}
              pending={isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DraftRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  pending,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_80px_1fr_auto] items-center gap-3 px-4 py-2.5 border-t border-border bg-muted/10">
      <Input
        autoFocus
        placeholder="Unidade, Fardo 6, Caixa 24…"
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        className="h-8 text-sm"
      />
      <Input
        type="number"
        min="0.001"
        step="any"
        value={draft.factor}
        onChange={(e) => setDraft({ ...draft, factor: e.target.value })}
        className="h-8 text-right font-mono text-sm"
      />
      <Input
        inputMode="numeric"
        placeholder="EAN/DUN"
        value={draft.barcode}
        onChange={(e) => setDraft({ ...draft, barcode: e.target.value.replace(/\D/g, "") })}
        className="h-8 font-mono text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex items-center gap-1 justify-end">
        <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
          />
          Padrão
        </label>
        <Button type="button" size="icon" className="h-7 w-7" onClick={onSave} disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onCancel}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
