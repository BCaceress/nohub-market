"use client";

import { Button } from "@/components/ui/button";
import type { SegmentType } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { Beer, ShoppingCart, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { selectSegmentAction } from "../actions";
import { useOnboarding } from "../store";

interface SegmentCard {
  value: SegmentType;
  title: string;
  description: string;
  highlights: string[];
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const SEGMENTS: SegmentCard[] = [
  {
    value: "BEVERAGE_CONVENIENCE",
    title: "Conveniência de bebidas",
    description: "Operação rápida, delivery e catálogo no WhatsApp.",
    highlights: ["PDV ágil", "Delivery", "Promoções", "Múltiplos preços"],
    Icon: Beer,
    accent: "from-amber-500/20 to-orange-500/10",
  },
  {
    value: "SUPERMARKET",
    title: "Supermercado",
    description: "Grande volume, validade, reposição e operação contínua.",
    highlights: ["Validade", "Reposição", "Inventário", "Setores"],
    Icon: ShoppingCart,
    accent: "from-emerald-500/20 to-green-500/10",
  },
  {
    value: "UNMANNED_MARKET",
    title: "Mercado autônomo",
    description: "Autoatendimento por QR Code, app e controle remoto.",
    highlights: ["QR Code", "App", "24h", "Sem operador"],
    Icon: Smartphone,
    accent: "from-blue-500/20 to-indigo-500/10",
  },
];

export function StepSegment({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!s.segmentType) {
      toast.error("Escolha um segmento");
      return;
    }
    setSaving(true);
    const res = await selectSegmentAction({ segmentType: s.segmentType });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    s.set({ organizationId: res.data.organizationId });
    onNext();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {SEGMENTS.map(({ value, title, description, highlights, Icon, accent }) => {
          const active = s.segmentType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => s.set({ segmentType: value })}
              className={cn(
                "group relative flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all",
                "hover:border-primary/50 hover:shadow-md",
                active ? "border-primary bg-gradient-to-br shadow-md" : "border-border bg-card",
                active && accent,
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {highlights.map((h) => (
                    <span
                      key={h}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        active
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Esta escolha define menus, dashboards, fluxos e regras desta conta. Para operar outro
        segmento, crie uma conta separada.
      </p>

      <Button onClick={submit} disabled={saving || !s.segmentType}>
        {saving ? "Criando conta..." : "Continuar"}
      </Button>
    </div>
  );
}
