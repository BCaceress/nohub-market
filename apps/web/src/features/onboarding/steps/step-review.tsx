"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { finalizeOnboardingAction } from "../actions";
import { useOnboarding } from "../store";

const SEGMENT_LABEL: Record<string, string> = {
  BEVERAGE_CONVENIENCE: "Conveniência de bebidas",
  SUPERMARKET: "Supermercado",
  UNMANNED_MARKET: "Mercado autônomo",
};

const STRUCTURE_LABEL: Record<string, string> = {
  LOCAL: "Estoque local por loja",
  CENTRAL_DC: "Centro de distribuição",
  HYBRID: "Operação híbrida (CD + local)",
};

export function StepReview() {
  const s = useOnboarding();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function finalize() {
    if (!s.organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    setSaving(true);
    const res = await finalizeOnboardingAction({ organizationId: s.organizationId });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Pronto! ${res.data.locationsCreated} unidades e ${res.data.capabilitiesActivated} módulos ativados.`,
    );
    s.reset();
    router.push("/app");
  }

  const needsCD = s.stockStructureType === "CENTRAL_DC" || s.stockStructureType === "HYBRID";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border bg-secondary/30 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Resumo
        </p>
        <dl className="flex flex-col gap-2.5 text-sm">
          <Row label="Segmento" value={SEGMENT_LABEL[s.segmentType] ?? "—"} />
          <Row
            label="Lojas"
            value={`${s.storeCount} ${s.storeCount === 1 ? "unidade" : "unidades"}`}
          />
          <Row label="Estrutura" value={STRUCTURE_LABEL[s.stockStructureType] ?? "—"} />
        </dl>
      </div>

      <div className="rounded-xl border p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Vamos criar
        </p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {s.stores.map((store, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: store drafts do not have ids before onboarding creates them.
            <li key={`s-${i}`} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {store.name || `Loja ${i + 1}`}
            </li>
          ))}
          {needsCD && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {s.centralDcName || "Centro de Distribuição"}
            </li>
          )}
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Capabilities e fluxos do segmento
          </li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Você poderá configurar CNPJ, fiscal, pagamentos e canais (iFood, WhatsApp, Mercado Livre)
        depois em Configurações.
      </p>

      <Button onClick={finalize} disabled={saving}>
        {saving ? "Configurando sua conta..." : "Concluir e entrar"}
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
