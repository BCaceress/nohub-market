"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStoreCountAction } from "../actions";
import { useOnboarding } from "../store";

export function StepStoreCount({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));

  function inc() {
    s.set({ storeCount: clamp(s.storeCount + 1) });
  }
  function dec() {
    s.set({ storeCount: clamp(s.storeCount - 1) });
  }

  async function submit() {
    if (!s.organizationId) {
      toast.error("Volte ao passo anterior");
      return;
    }
    const n = clamp(s.storeCount);
    setSaving(true);
    const res = await saveStoreCountAction({
      organizationId: s.organizationId,
      storeCount: n,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    // Pré-popula nomes vazios para o próximo passo.
    const existing = s.stores ?? [];
    const next = Array.from({ length: n }, (_, i) => existing[i] ?? { name: "" });
    s.set({ storeCount: n, stores: next });
    onNext();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Label>Quantas lojas/unidades você opera?</Label>
        <div className="flex items-center justify-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={dec}
            disabled={s.storeCount <= 1}
            aria-label="Diminuir"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={s.storeCount}
            onChange={(e) => s.set({ storeCount: clamp(Number(e.target.value) || 1) })}
            className="h-14 w-28 text-center text-2xl font-bold"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={inc}
            disabled={s.storeCount >= 100}
            aria-label="Aumentar"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Você poderá adicionar mais lojas depois em Configurações.
        </p>
      </div>

      <Button onClick={submit} disabled={saving}>
        {saving ? "Salvando..." : "Continuar"}
      </Button>
    </div>
  );
}
