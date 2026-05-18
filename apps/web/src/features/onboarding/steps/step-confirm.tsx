"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCNPJ, onlyDigits } from "@nohub/shared/brazilian";
import { useState } from "react";
import { toast } from "sonner";
import { cepLookupAction, createOrganizationAction } from "../actions";
import { useOnboarding } from "../store";

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function StepConfirm({ onNext }: { onNext: () => void }) {
  const s = useOnboarding();
  const [saving, setSaving] = useState(false);

  async function fetchCep() {
    if (onlyDigits(s.zipCode).length !== 8) return;
    const res = await cepLookupAction(s.zipCode);
    if (res.success) {
      const d = res.data as Record<string, string>;
      s.set({
        street: d.street || s.street,
        district: d.district || s.district,
        city: d.city || s.city,
        state: d.state || s.state,
      });
    }
  }

  async function submit() {
    if (s.legalName.trim().length < 2) {
      toast.error("Informe a razão social");
      return;
    }
    setSaving(true);
    const res = await createOrganizationAction({
      document: s.document,
      legalName: s.legalName,
      tradeName: s.tradeName,
      cnae: s.cnae,
      taxRegime: s.taxRegime,
      zipCode: s.zipCode,
      street: s.street,
      number: s.number,
      complement: s.complement,
      district: s.district,
      city: s.city,
      state: s.state,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    s.set({ organizationId: res.data.organizationId });
    toast.success("Organização criada!");
    onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>CNPJ</Label>
        <Input value={formatCNPJ(s.document)} readOnly className="bg-muted text-muted-foreground" />
      </div>
      <Field label="Razão social" value={s.legalName} onChange={(v) => s.set({ legalName: v })} />
      <Field label="Nome fantasia" value={s.tradeName} onChange={(v) => s.set({ tradeName: v })} />
      <div className="flex flex-col gap-2">
        <Label>CEP</Label>
        <Input
          value={s.zipCode}
          onChange={(e) => s.set({ zipCode: e.target.value })}
          onBlur={fetchCep}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Rua" value={s.street} onChange={(v) => s.set({ street: v })} />
        </div>
        <Field label="Número" value={s.number} onChange={(v) => s.set({ number: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Bairro" value={s.district} onChange={(v) => s.set({ district: v })} />
        <Field label="Cidade" value={s.city} onChange={(v) => s.set({ city: v })} />
        <Field label="UF" value={s.state} onChange={(v) => s.set({ state: v })} />
      </div>
      <Button onClick={submit} disabled={saving}>
        {saving ? "Criando organização..." : "Criar organização e continuar"}
      </Button>
    </div>
  );
}
