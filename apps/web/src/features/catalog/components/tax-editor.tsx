"use client";

import { Info } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setProductTaxAction } from "../actions/tax-actions";

type TaxData = {
  ncm: string;
  cest: string | null;
  cfopInternal: string | null;
  cfopInterstate: string | null;
  origin: string;
  icmsCst: string | null;
  icmsCsosn: string | null;
  icmsRate: { toString(): string } | null;
  pisCst: string | null;
  pisRate: { toString(): string } | null;
  cofinsCst: string | null;
  cofinsRate: { toString(): string } | null;
  unitTaxable: boolean;
};

interface Props {
  organizationId: string;
  productId: string;
  taxData: TaxData | null;
  taxRegime: string | null;
  variantId?: string;
}

const ICMS_CST_OPTIONS = [
  { value: "00", label: "00 — Tributado integralmente" },
  { value: "10", label: "10 — Tributado + ST" },
  { value: "20", label: "20 — Com redução de BC" },
  { value: "30", label: "30 — Isento/NT + ST" },
  { value: "40", label: "40 — Isento" },
  { value: "41", label: "41 — Não tributado" },
  { value: "50", label: "50 — Suspensão" },
  { value: "51", label: "51 — Diferimento" },
  { value: "60", label: "60 — ICMS cobrado ant. por ST" },
  { value: "70", label: "70 — Redução de BC + ST" },
  { value: "90", label: "90 — Outros" },
];

const ICMS_CSOSN_OPTIONS = [
  { value: "101", label: "101 — Tributado com permissão de crédito" },
  { value: "102", label: "102 — Tributado sem permissão de crédito" },
  { value: "103", label: "103 — Isenção para faixa de receita" },
  { value: "201", label: "201 — Tributado com crédito + ST" },
  { value: "202", label: "202 — Tributado sem crédito + ST" },
  { value: "203", label: "203 — Isento + ST" },
  { value: "300", label: "300 — Imune" },
  { value: "400", label: "400 — Não tributado" },
  { value: "500", label: "500 — ICMS cobrado ant. por ST" },
  { value: "900", label: "900 — Outros" },
];

const PIS_COFINS_CST_OPTIONS = [
  { value: "01", label: "01 — Alíquota básica" },
  { value: "02", label: "02 — Alíquota diferenciada" },
  { value: "03", label: "03 — Alíquota por unidade" },
  { value: "04", label: "04 — Monofásica" },
  { value: "05", label: "05 — Substituição tributária" },
  { value: "06", label: "06 — Alíquota zero" },
  { value: "07", label: "07 — Isenta" },
  { value: "08", label: "08 — Sem incidência" },
  { value: "09", label: "09 — Suspensão" },
  { value: "49", label: "49 — Outras saídas" },
  { value: "99", label: "99 — Outras entradas" },
];

const TAX_ORIGIN_OPTIONS = [
  { value: "NACIONAL", label: "0 — Nacional" },
  { value: "IMPORTADO_DIRETO", label: "1 — Importado direto" },
  { value: "IMPORTADO_NACIONAL", label: "2 — Importado, nacional" },
  { value: "NACIONAL_MAIS_40_IMPORTADO", label: "3 — Nacional, > 40% importado" },
  { value: "NACIONAL_MENOS_40_IMPORTADO", label: "4 — Nacional, ≤ 40% importado" },
  { value: "NACIONAL_SEM_SIMILAR", label: "5 — Nacional, sem similar" },
  { value: "ESTRANGEIRO_DIRETO", label: "6 — Estrangeiro direto" },
  { value: "ESTRANGEIRO_NACIONAL", label: "7 — Estrangeiro, adq. no mercado interno" },
  { value: "NACIONAL_MENOS_70_IMPORTADO", label: "8 — Nacional, > 70% importado" },
];

export function TaxEditor({ organizationId, productId, taxData, taxRegime, variantId }: Props) {
  const [isPending, startTransition] = useTransition();
  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI";

  const [form, setForm] = useState({
    ncm: taxData?.ncm ?? "",
    cest: taxData?.cest ?? "",
    cfopInternal: taxData?.cfopInternal ?? "5102",
    cfopInterstate: taxData?.cfopInterstate ?? "6102",
    origin: taxData?.origin ?? "NACIONAL",
    icmsCst: taxData?.icmsCst ?? "",
    icmsCsosn: taxData?.icmsCsosn ?? "",
    icmsRate: taxData?.icmsRate?.toString() ?? "",
    pisCst: taxData?.pisCst ?? "01",
    pisRate: taxData?.pisRate?.toString() ?? "",
    cofinsCst: taxData?.cofinsCst ?? "01",
    cofinsRate: taxData?.cofinsRate?.toString() ?? "",
    unitTaxable: taxData?.unitTaxable ?? true,
  });

  function set(partial: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await setProductTaxAction(organizationId, {
        productId,
        variantId: variantId || undefined,
        ncm: form.ncm,
        cest: form.cest || undefined,
        cfopInternal: form.cfopInternal || undefined,
        cfopInterstate: form.cfopInterstate || undefined,
        origin: form.origin as never,
        icmsCst: (isSimples ? undefined : form.icmsCst || undefined) as never,
        icmsCsosn: (isSimples ? form.icmsCsosn || undefined : undefined) as never,
        icmsRate: form.icmsRate ? Number(form.icmsRate) : undefined,
        pisCst: form.pisCst || undefined,
        pisRate: form.pisRate ? Number(form.pisRate) : undefined,
        cofinsCst: form.cofinsCst || undefined,
        cofinsRate: form.cofinsRate ? Number(form.cofinsRate) : undefined,
        unitTaxable: form.unitTaxable,
      });

      if (result.success) {
        toast.success("Dados fiscais salvos!");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Regime badge */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-sm">
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
        <span>
          Regime tributário:{" "}
          <Badge variant={isSimples ? "success" : "info"}>{taxRegime ?? "Não informado"}</Badge> —{" "}
          {isSimples ? "Use CSOSN para ICMS" : "Use CST para ICMS"}
        </span>
      </div>

      {/* NCM / CEST */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-ncm">NCM * (8 dígitos)</Label>
          <Input
            id="tax-ncm"
            value={form.ncm}
            onChange={(e) => set({ ncm: e.target.value.replace(/\D/g, "").slice(0, 8) })}
            placeholder="22021000"
            maxLength={8}
            pattern="\d{8}"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-cest">CEST (7 dígitos)</Label>
          <Input
            id="tax-cest"
            value={form.cest}
            onChange={(e) => set({ cest: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            placeholder="0300400"
            maxLength={7}
          />
        </div>
      </div>

      {/* CFOP */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-cfop-int">CFOP operações internas</Label>
          <Input
            id="tax-cfop-int"
            value={form.cfopInternal}
            onChange={(e) => set({ cfopInternal: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="5102"
            maxLength={4}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-cfop-est">CFOP operações interestaduais</Label>
          <Input
            id="tax-cfop-est"
            value={form.cfopInterstate}
            onChange={(e) => set({ cfopInterstate: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="6102"
            maxLength={4}
          />
        </div>
      </div>

      {/* Origem */}
      <div className="flex flex-col gap-1.5">
        <Label>Origem do produto</Label>
        <select
          value={form.origin}
          onChange={(e) => set({ origin: e.target.value })}
          className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {TAX_ORIGIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ICMS */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{isSimples ? "ICMS CSOSN" : "ICMS CST"}</Label>
          <select
            value={isSimples ? form.icmsCsosn : form.icmsCst}
            onChange={(e) =>
              isSimples ? set({ icmsCsosn: e.target.value }) : set({ icmsCst: e.target.value })
            }
            className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Selecionar…</option>
            {(isSimples ? ICMS_CSOSN_OPTIONS : ICMS_CST_OPTIONS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-icms-rate">Alíquota ICMS (%)</Label>
          <Input
            id="tax-icms-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.icmsRate}
            onChange={(e) => set({ icmsRate: e.target.value })}
            placeholder="12.00"
          />
        </div>
      </div>

      {/* PIS / COFINS */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>PIS CST</Label>
          <select
            value={form.pisCst}
            onChange={(e) => set({ pisCst: e.target.value })}
            className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Selecionar…</option>
            {PIS_COFINS_CST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-pis-rate">Alíquota PIS (%)</Label>
          <Input
            id="tax-pis-rate"
            type="number"
            min="0"
            max="100"
            step="0.0001"
            value={form.pisRate}
            onChange={(e) => set({ pisRate: e.target.value })}
            placeholder="0.65"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>COFINS CST</Label>
          <select
            value={form.cofinsCst}
            onChange={(e) => set({ cofinsCst: e.target.value })}
            className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Selecionar…</option>
            {PIS_COFINS_CST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tax-cofins-rate">Alíquota COFINS (%)</Label>
          <Input
            id="tax-cofins-rate"
            type="number"
            min="0"
            max="100"
            step="0.0001"
            value={form.cofinsRate}
            onChange={(e) => set({ cofinsRate: e.target.value })}
            placeholder="3.00"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar dados fiscais"}
        </Button>
      </div>
    </form>
  );
}
