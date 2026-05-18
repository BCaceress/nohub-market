"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { saveCatalogAction } from "../actions";
import { useOnboarding } from "../store";

const METHODS = [
  ["template", "Template do segmento", "Comece com um catálogo pronto do seu tipo de negócio."],
  ["spreadsheet", "Importar planilha", "Suba uma planilha com seus produtos."],
  ["manual", "Cadastro manual", "Adicione os produtos um a um depois."],
] as const;

export function StepCatalog({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!s.catalogMethod || !s.organizationId) {
      toast.error("Escolha um método");
      return;
    }
    setSaving(true);
    const res = await saveCatalogAction({
      organizationId: s.organizationId,
      method: s.catalogMethod,
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
      <p className="text-sm text-muted-foreground">
        Apenas registramos sua preferência agora — a importação acontece depois.
      </p>
      {METHODS.map(([v, title, desc]) => (
        <button
          key={v}
          type="button"
          onClick={() => s.set({ catalogMethod: v })}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors",
            s.catalogMethod === v ? "border-primary bg-secondary" : "hover:bg-secondary",
          )}
        >
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </button>
      ))}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onSkip} className="flex-1">
          Pular por enquanto
        </Button>
        <Button onClick={submit} disabled={saving} className="flex-1">
          {saving ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
