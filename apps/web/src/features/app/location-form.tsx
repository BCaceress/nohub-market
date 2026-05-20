"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { onlyDigits } from "@nohub/shared/brazilian";
import {
  createLocationAction,
  updateLocationAction,
  type LocationInput,
} from "./actions/location-actions";

type Location = {
  id: string;
  name: string;
  type: string;
  isSelfService: boolean;
  is24h: boolean;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
};

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border border-input"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export function LocationForm({
  organizationId,
  location,
}: {
  organizationId: string;
  location?: Location;
}) {
  const router = useRouter();
  const [form, setForm] = useState<LocationInput>({
    name: location?.name ?? "",
    type: (location?.type as LocationInput["type"]) ?? "STORE",
    isSelfService: location?.isSelfService ?? false,
    is24h: location?.is24h ?? false,
    zipCode: location?.zipCode ?? "",
    street: location?.street ?? "",
    number: location?.number ?? "",
    complement: location?.complement ?? "",
    district: location?.district ?? "",
    city: location?.city ?? "",
    state: location?.state ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(partial: Partial<LocationInput>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = location
      ? await updateLocationAction(organizationId, location.id, form)
      : await createLocationAction(organizationId, form);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(location ? "Unidade atualizada!" : "Unidade criada!");
    router.push("/app/locations");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Nome da unidade *</Label>
          <Input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ex: Loja Centro"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Tipo</Label>
          <Select
            value={form.type}
            onChange={(e) => set({ type: e.target.value as LocationInput["type"] })}
          >
            <option value="STORE">Loja / Ponto de venda</option>
            <option value="DC">Centro de distribuição</option>
            <option value="HYBRID">Híbrido</option>
          </Select>
        </div>
        <div className="flex flex-col gap-3 justify-end">
          <Checkbox
            label="Autoatendimento"
            checked={form.isSelfService}
            onChange={(v) => set({ isSelfService: v })}
          />
          <Checkbox
            label="Funciona 24h"
            checked={form.is24h}
            onChange={(v) => set({ is24h: v })}
          />
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">Endereço (opcional)</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label>CEP</Label>
          <Input
            value={form.zipCode ?? ""}
            onChange={(e) => {
              const d = onlyDigits(e.target.value).slice(0, 8);
              const fmt = d.length >= 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
              set({ zipCode: fmt });
            }}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>UF</Label>
          <Input
            value={form.state ?? ""}
            onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="SP"
            maxLength={2}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Cidade</Label>
          <Input
            value={form.city ?? ""}
            onChange={(e) => set({ city: e.target.value })}
            placeholder="São Paulo"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2 flex flex-col gap-2">
          <Label>Rua</Label>
          <Input
            value={form.street ?? ""}
            onChange={(e) => set({ street: e.target.value })}
            placeholder="Av. Paulista"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Número</Label>
          <Input
            value={form.number ?? ""}
            onChange={(e) => set({ number: e.target.value })}
            placeholder="100"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Complemento</Label>
          <Input
            value={form.complement ?? ""}
            onChange={(e) => set({ complement: e.target.value })}
            placeholder="Sala 2"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Bairro</Label>
          <Input
            value={form.district ?? ""}
            onChange={(e) => set({ district: e.target.value })}
            placeholder="Bela Vista"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : location ? "Salvar alterações" : "Criar unidade"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/locations")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
