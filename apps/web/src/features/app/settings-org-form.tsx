"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCEP, formatCNPJ, onlyDigits } from "@nohub/shared/brazilian";
import { useState } from "react";
import { toast } from "sonner";
import {
  type UpdateOrgInput,
  cepLookupForSettingsAction,
  updateOrgAction,
} from "./actions/org-actions";

type Org = {
  id: string;
  legalName: string;
  tradeName: string | null;
  document: string | null;
  taxRegime: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

function Field({
  label,
  value,
  onChange,
  readOnly,
  className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className={readOnly ? "bg-muted text-muted-foreground" : ""}
      />
    </div>
  );
}

export function SettingsOrgForm({ org }: { org: Org }) {
  const [form, setForm] = useState<UpdateOrgInput & { zipCode: string }>({
    legalName: org.legalName,
    tradeName: org.tradeName ?? "",
    taxRegime: (org.taxRegime as UpdateOrgInput["taxRegime"]) ?? undefined,
    zipCode: org.zipCode ? formatCEP(org.zipCode) : "",
    street: org.street ?? "",
    number: org.number ?? "",
    complement: org.complement ?? "",
    district: org.district ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(partial: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function fetchCep() {
    const digits = onlyDigits(form.zipCode);
    if (digits.length !== 8) return;
    const res = await cepLookupForSettingsAction(digits);
    if (res.success) {
      const d = res.data as Record<string, string>;
      set({
        street: d.street || form.street,
        district: d.district || form.district,
        city: d.city || form.city,
        state: d.state || form.state,
      });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateOrgAction(org.id, form);
    setSaving(false);
    if (res.success) {
      toast.success("Dados salvos com sucesso!");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* Dados da empresa */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="CNPJ" value={org.document ? formatCNPJ(org.document) : ""} readOnly />
        <div className="flex flex-col gap-2">
          <Label>Regime tributário</Label>
          <Select
            value={form.taxRegime ?? ""}
            onChange={(e) =>
              set({ taxRegime: (e.target.value as UpdateOrgInput["taxRegime"]) || undefined })
            }
          >
            <option value="">Selecione...</option>
            <option value="SIMPLES_NACIONAL">Simples Nacional</option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            <option value="LUCRO_REAL">Lucro Real</option>
            <option value="MEI">MEI</option>
          </Select>
        </div>
        <Field
          label="Razão social"
          value={form.legalName}
          onChange={(v) => set({ legalName: v })}
        />
        <Field
          label="Nome fantasia"
          value={form.tradeName ?? ""}
          onChange={(v) => set({ tradeName: v })}
        />
      </div>

      {/* Endereço */}
      <p className="text-sm font-medium text-muted-foreground">Endereço</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label>CEP</Label>
          <Input
            value={form.zipCode}
            onChange={(e) => {
              const digits = onlyDigits(e.target.value);
              const formatted =
                digits.length >= 5 ? `${digits.slice(0, 5)}-${digits.slice(5, 8)}` : digits;
              set({ zipCode: formatted });
            }}
            onBlur={fetchCep}
            placeholder="00000-000"
            maxLength={9}
            inputMode="numeric"
          />
        </div>
        <Field
          label="UF"
          value={form.state ?? ""}
          onChange={(v) => set({ state: v.toUpperCase().slice(0, 2) })}
        />
        <Field label="Cidade" value={form.city ?? ""} onChange={(v) => set({ city: v })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Rua" value={form.street ?? ""} onChange={(v) => set({ street: v })} />
        </div>
        <Field label="Número" value={form.number ?? ""} onChange={(v) => set({ number: v })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Complemento"
          value={form.complement ?? ""}
          onChange={(v) => set({ complement: v })}
        />
        <Field label="Bairro" value={form.district ?? ""} onChange={(v) => set({ district: v })} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
