"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { saveStoreNamesAction } from "../actions";
import { useOnboarding } from "../store";

const SUGGESTIONS = ["Loja Centro", "Loja Zona Sul", "Loja Norte", "Loja Leste", "Loja Oeste"];

export function StepStoreNames({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  function update(i: number, name: string) {
    const next = [...s.stores];
    next[i] = { name };
    s.set({ stores: next });
  }

  async function submit() {
    if (!s.organizationId) {
      toast.error("Volte ao passo anterior");
      return;
    }
    const names = s.stores.map((x) => x.name.trim()).filter(Boolean);
    if (names.length !== s.storeCount) {
      toast.error(`Informe o nome das ${s.storeCount} lojas`);
      return;
    }
    setSaving(true);
    const res = await saveStoreNamesAction({
      organizationId: s.organizationId,
      storeNames: names,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Identifique cada uma das {s.storeCount} {s.storeCount === 1 ? "unidade" : "unidades"}.
      </p>

      <div className="flex flex-col gap-3">
        {Array.from({ length: s.storeCount }).map((_, i) => (
          <div key={`store-${i}-${s.storeCount}`} className="flex flex-col gap-1.5">
            <Label htmlFor={`store-${i}`} className="text-xs">
              Loja {i + 1}
            </Label>
            <div className="relative">
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`store-${i}`}
                className="pl-9"
                value={s.stores[i]?.name ?? ""}
                onChange={(e) => update(i, e.target.value)}
                placeholder={SUGGESTIONS[i] ?? `Loja ${i + 1}`}
                maxLength={60}
              />
            </div>
          </div>
        ))}
      </div>

      <Button onClick={submit} disabled={saving}>
        {saving ? "Salvando..." : "Continuar"}
      </Button>
    </div>
  );
}
