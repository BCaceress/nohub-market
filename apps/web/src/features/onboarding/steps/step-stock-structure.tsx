"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StockStructureType } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { Boxes, Network, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { saveStockStructureAction } from "../actions";
import { useOnboarding } from "../store";

interface StructureCard {
  value: StockStructureType;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: StructureCard[] = [
  {
    value: "LOCAL",
    title: "Estoque local por loja",
    description: "Cada loja gerencia o próprio estoque. Simples e direto.",
    Icon: Boxes,
  },
  {
    value: "CENTRAL_DC",
    title: "Centro de distribuição (CD)",
    description: "CD central abastece todas as lojas. Recebimento centralizado.",
    Icon: Warehouse,
  },
  {
    value: "HYBRID",
    title: "Operação híbrida",
    description: "CD central + estoque local em cada loja. Maior flexibilidade.",
    Icon: Network,
  },
];

export function StepStockStructure({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  // Se apenas 1 loja e sem CD, fluxo HYBRID/CD não faz sentido — mantém disponível
  // mas avisa. Decisão final é do usuário.

  async function submit() {
    if (!s.organizationId) return;
    if (!s.stockStructureType) {
      toast.error("Escolha a estrutura de estoque");
      return;
    }
    setSaving(true);
    const res = await saveStockStructureAction({
      organizationId: s.organizationId,
      stockStructureType: s.stockStructureType,
      centralDcName: s.centralDcName.trim() || "Centro de Distribuição",
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    onNext();
  }

  const needsDcName = s.stockStructureType === "CENTRAL_DC" || s.stockStructureType === "HYBRID";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(({ value, title, description, Icon }) => {
          const active = s.stockStructureType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => s.set({ stockStructureType: value })}
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                "hover:border-primary/50",
                active ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </div>
            </button>
          );
        })}
      </div>

      {needsDcName && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="cd-name">Nome do centro de distribuição</Label>
          <Input
            id="cd-name"
            value={s.centralDcName}
            onChange={(e) => s.set({ centralDcName: e.target.value })}
            placeholder="Ex: CD São Paulo"
            maxLength={60}
          />
        </div>
      )}

      <Button onClick={submit} disabled={saving || !s.stockStructureType}>
        {saving ? "Salvando..." : "Continuar"}
      </Button>
    </div>
  );
}
