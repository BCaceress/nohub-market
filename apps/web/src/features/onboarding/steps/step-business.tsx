"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCNPJ, isValidCNPJ, onlyDigits } from "@nohub/shared/brazilian";
import { useState } from "react";
import { toast } from "sonner";
import { cnpjLookupAction } from "../actions";
import { useOnboarding } from "../store";

export function StepBusiness({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [loading, setLoading] = useState(false);

  async function fetchCnpj() {
    if (!isValidCNPJ(s.document)) {
      toast.error("CNPJ inválido");
      return;
    }
    setLoading(true);
    const res = await cnpjLookupAction(s.document);
    setLoading(false);
    if (!res.success) {
      toast.warning(`${res.error}. Você pode preencher manualmente.`);
      return;
    }
    const d = res.data as Record<string, string>;
    s.set({
      legalName: d.legalName ?? "",
      tradeName: d.tradeName ?? "",
      cnae: d.cnae ?? "",
      zipCode: d.zipCode ?? "",
      street: d.street ?? "",
      number: d.number ?? "",
      district: d.district ?? "",
      city: d.city ?? "",
      state: d.state ?? "",
    });
    toast.success("Dados carregados da Receita.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="document">CNPJ</Label>
        <div className="flex gap-2">
          <Input
            id="document"
            value={formatCNPJ(s.document)}
            onChange={(e) => {
              const digits = onlyDigits(e.target.value);
              s.set({ document: digits });
            }}
            placeholder="00.000.000/0000-00"
            maxLength={18}
            inputMode="numeric"
          />
          <Button type="button" variant="outline" onClick={fetchCnpj} disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Buscamos os dados automaticamente. Se a consulta falhar, preencha à mão.
        </p>
      </div>
      <Button onClick={onNext} disabled={!isValidCNPJ(s.document)}>
        Continuar
      </Button>
    </div>
  );
}
