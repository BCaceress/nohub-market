"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { saveLocationsAction } from "../actions";
import { type LocationDraft, useOnboarding } from "../store";

const empty: LocationDraft = {
  name: "",
  type: "STORE",
  isSelfService: false,
  is24h: false,
};

export function StepStructure({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);
  const list = s.locations.length ? s.locations : [empty];

  const update = (i: number, patch: Partial<LocationDraft>) =>
    s.set({ locations: list.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });

  async function submit() {
    const valid = list.filter((l) => l.name.trim());
    if (!valid.length) {
      toast.error("Cadastre ao menos uma unidade");
      return;
    }
    if (!s.organizationId) return;
    setSaving(true);
    const res = await saveLocationsAction({
      organizationId: s.organizationId,
      locations: valid,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    s.set({ locations: valid });
    onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      {list.map((loc, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id estável
        <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-col gap-2">
            <Label>Nome da unidade</Label>
            <Input
              value={loc.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Ex: Loja Centro"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={loc.type}
              onChange={(e) => update(i, { type: e.target.value as LocationDraft["type"] })}
            >
              <option value="STORE">Loja</option>
              <option value="DC">Centro de distribuição</option>
              <option value="HYBRID">Híbrido</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={loc.isSelfService}
              onChange={(e) => update(i, { isSelfService: e.target.checked })}
            />
            Autônomo (sem operador)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={loc.is24h}
              onChange={(e) => update(i, { is24h: e.target.checked })}
            />
            Funciona 24h
          </label>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => s.set({ locations: [...list, { ...empty }] })}
      >
        + Adicionar unidade
      </Button>
      <Button onClick={submit} disabled={saving}>
        {saving ? "Salvando..." : "Continuar"}
      </Button>
    </div>
  );
}
