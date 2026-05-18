"use client";

import { Button } from "@/components/ui/button";
import type { ProductCategory } from "@/lib/capabilities";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { saveOperationAction } from "../actions";
import { useOnboarding } from "../store";

const BUSINESS = [
  ["UNMANNED_MARKET", "Mercado autônomo"],
  ["CONVENIENCE", "Conveniência"],
  ["BEVERAGE", "Bebidas / Adega"],
  ["HYBRID", "Híbrido"],
] as const;

const CHANNELS = ["IFOOD", "WHATSAPP", "MERCADO_LIVRE", "RAPPI", "OWN_ECOMMERCE"];

const CATEGORIES: [ProductCategory, string][] = [
  ["alcohol", "Bebidas alcoólicas"],
  ["perishable", "Perecíveis"],
  ["hortifruti", "Hortifruti"],
  ["grocery", "Mercearia"],
  ["tobacco", "Tabacaria"],
  ["general", "Conveniência geral"],
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export function StepOperation({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  async function submit() {
    if (!s.businessType) {
      toast.error("Escolha o tipo de negócio");
      return;
    }
    if (!s.organizationId) {
      toast.error("Organização não encontrada — volte ao passo 2");
      return;
    }
    setSaving(true);
    const res = await saveOperationAction({
      organizationId: s.organizationId,
      businessType: s.businessType,
      salesChannels: s.salesChannels,
      productCategories: s.productCategories,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data.capabilities.length
        ? `Capabilities aplicadas: ${res.data.capabilities.join(", ")}`
        : "Operação salva",
    );
    onNext();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Tipo de negócio</p>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS.map(([v, label]) => (
            <Chip key={v} active={s.businessType === v} onClick={() => s.set({ businessType: v })}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Canais de venda online</p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <Chip
              key={c}
              active={s.salesChannels.includes(c)}
              onClick={() => s.set({ salesChannels: toggle(s.salesChannels, c) })}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Categorias de produto</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(([v, label]) => (
            <Chip
              key={v}
              active={s.productCategories.includes(v)}
              onClick={() => s.set({ productCategories: toggle(s.productCategories, v) })}
            >
              {label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Bebida alcoólica ativa controle de idade e lei seca; hortifruti ativa validade e venda
          fracionada.
        </p>
      </div>
      <Button onClick={submit} disabled={saving}>
        {saving ? "Aplicando..." : "Continuar"}
      </Button>
    </div>
  );
}
