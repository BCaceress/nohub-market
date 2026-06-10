"use client";

import { formatCNPJ, onlyDigits } from "@nohub/shared/brazilian";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSupplierAction,
  lookupCnpjAction,
  type SupplierInput,
  updateSupplierAction,
} from "../actions/supplier-actions";

const WEEKDAYS = [
  { value: "MONDAY", label: "Seg" },
  { value: "TUESDAY", label: "Ter" },
  { value: "WEDNESDAY", label: "Qua" },
  { value: "THURSDAY", label: "Qui" },
  { value: "FRIDAY", label: "Sex" },
  { value: "SATURDAY", label: "Sáb" },
];

const EMPTY: SupplierInput = {
  name: "",
  tradeName: "",
  document: "",
  email: "",
  phone: "",
  website: "",
  contactName: "",
  segment: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressDistrict: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  defaultPaymentTerms: null,
  defaultLeadTimeDays: null,
  minOrderAmount: null,
  deliveryDays: [],
  defaultDiscountPercent: null,
  freightFixedAmount: null,
  freightFreeAbove: null,
  freightNotes: "",
  notes: "",
};

interface Props {
  organizationId: string;
  supplierId?: string;
  initialValues?: Partial<SupplierInput>;
}

export function SupplierForm({ organizationId, supplierId, initialValues }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<SupplierInput>({ ...EMPTY, ...initialValues });
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  function set(partial: Partial<SupplierInput>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function toggleDay(day: string) {
    const days = (form.deliveryDays ?? []) as string[];
    if (days.includes(day)) {
      set({ deliveryDays: days.filter((d) => d !== day) });
    } else {
      set({ deliveryDays: [...days, day] });
    }
  }

  async function handleCnpjLookup() {
    const digits = onlyDigits(form.document ?? "");
    if (digits.length !== 14) {
      toast.error("Digite um CNPJ válido (14 dígitos)");
      return;
    }
    setLookingUp(true);
    const res = await lookupCnpjAction(digits);
    setLookingUp(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    set({
      name: d.razaoSocial || form.name,
      tradeName: d.nomeFantasia || form.tradeName,
      email: d.email || form.email,
      phone: d.telefone || form.phone,
      segment: d.segmento || form.segment,
      addressStreet: d.logradouro || form.addressStreet,
      addressNumber: d.numero || form.addressNumber,
      addressComplement: d.complemento || form.addressComplement,
      addressDistrict: d.bairro || form.addressDistrict,
      addressCity: d.municipio || form.addressCity,
      addressState: d.uf || form.addressState,
      addressZip: d.cep || form.addressZip,
    });
    toast.success("Dados preenchidos via CNPJ");
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Razão Social é obrigatória");
      return;
    }
    setSaving(true);
    const payload: SupplierInput = {
      ...form,
      document: form.document ? onlyDigits(form.document) : undefined,
    };

    const res = supplierId
      ? await updateSupplierAction(organizationId, supplierId, payload)
      : await createSupplierAction(organizationId, payload);

    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(supplierId ? "Fornecedor atualizado!" : "Fornecedor criado!");
    if (!supplierId && res.success && "data" in res && res.data) {
      router.push(`/app/suppliers/${(res.data as { id: string }).id}`);
    } else {
      router.refresh();
    }
  }

  const paymentTermsDays =
    form.defaultPaymentTerms && typeof form.defaultPaymentTerms === "object"
      ? ((form.defaultPaymentTerms as { termsDays?: number }).termsDays ?? "")
      : "";

  return (
    <div className="flex flex-col gap-5 pb-16">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        {/* ── Esquerda: Dados Cadastrais ────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <SectionTitle>Dados Cadastrais</SectionTitle>

          {/* CNPJ com lookup */}
          <div className="flex flex-col gap-2">
            <Label>
              CNPJ <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.document ? formatCNPJ(form.document) : ""}
                onChange={(e) => set({ document: e.target.value })}
                placeholder="XX.XXX.XXX/XXXX-XX"
                className="flex-1"
              />
              <Button
                type="button"
                size="default"
                onClick={handleCnpjLookup}
                disabled={lookingUp}
                className="shrink-0"
              >
                {lookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Busca preenche nome, endereço e segmento automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>
                Razão Social <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Razão social da empresa"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Nome Fantasia</Label>
              <Input
                value={form.tradeName ?? ""}
                onChange={(e) => set({ tradeName: e.target.value })}
                placeholder="Nome comercial"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="E-mail de contato"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Contato Principal</Label>
              <Input
                value={form.contactName ?? ""}
                onChange={(e) => set({ contactName: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Segmento</Label>
              <Input
                value={form.segment ?? ""}
                onChange={(e) => set({ segment: e.target.value })}
                placeholder="Categoria do fornecedor"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Website</Label>
            <Input
              value={form.website ?? ""}
              onChange={(e) => set({ website: e.target.value })}
              placeholder="https://..."
            />
          </div>

          {/* Endereço */}
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8 flex flex-col gap-2">
                <Label>Logradouro</Label>
                <Input
                  value={form.addressStreet ?? ""}
                  onChange={(e) => set({ addressStreet: e.target.value })}
                  placeholder="Rua, Av., Travessa..."
                />
              </div>
              <div className="col-span-4 flex flex-col gap-2">
                <Label>Número</Label>
                <Input
                  value={form.addressNumber ?? ""}
                  onChange={(e) => set({ addressNumber: e.target.value })}
                  placeholder="Nº"
                />
              </div>
              <div className="col-span-6 flex flex-col gap-2">
                <Label>Complemento</Label>
                <Input
                  value={form.addressComplement ?? ""}
                  onChange={(e) => set({ addressComplement: e.target.value })}
                  placeholder="Ap., sala, andar..."
                />
              </div>
              <div className="col-span-6 flex flex-col gap-2">
                <Label>Bairro</Label>
                <Input
                  value={form.addressDistrict ?? ""}
                  onChange={(e) => set({ addressDistrict: e.target.value })}
                  placeholder="Bairro"
                />
              </div>
              <div className="col-span-4 flex flex-col gap-2">
                <Label>CEP</Label>
                <Input
                  value={form.addressZip ?? ""}
                  onChange={(e) => set({ addressZip: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
              <div className="col-span-5 flex flex-col gap-2">
                <Label>Cidade</Label>
                <Input
                  value={form.addressCity ?? ""}
                  onChange={(e) => set({ addressCity: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="col-span-3 flex flex-col gap-2">
                <Label>Estado</Label>
                <Input
                  value={form.addressState ?? ""}
                  onChange={(e) => set({ addressState: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Direita: Condições + Observações + Ações ─────────── */}
        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
            <SectionTitle>Condições Comerciais</SectionTitle>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Pgto (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={paymentTermsDays}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    set({
                      defaultPaymentTerms: days > 0 ? { termsDays: days, type: "NET" } : null,
                    });
                  }}
                  placeholder="Prazo em dias"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Entrega (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.defaultLeadTimeDays ?? ""}
                  onChange={(e) =>
                    set({ defaultLeadTimeDays: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Lead time"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Pedido mín. (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.minOrderAmount ?? ""}
                  onChange={(e) =>
                    set({ minOrderAmount: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Valor mínimo"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.defaultDiscountPercent ?? ""}
                  onChange={(e) =>
                    set({
                      defaultDiscountPercent: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="% de desconto"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Frete
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Valor fixo (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.freightFixedAmount ?? ""}
                    onChange={(e) =>
                      set({ freightFixedAmount: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder="Valor do frete"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Grátis acima (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.freightFreeAbove ?? ""}
                    onChange={(e) =>
                      set({ freightFreeAbove: e.target.value ? Number(e.target.value) : null })
                    }
                    placeholder="Valor do pedido"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Obs. de frete</Label>
                <Input
                  value={form.freightNotes ?? ""}
                  onChange={(e) => set({ freightNotes: e.target.value })}
                  placeholder="Condições especiais de frete"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Dias de entrega</Label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map((d) => {
                  const active = ((form.deliveryDays ?? []) as string[]).includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
            <SectionTitle>Observações</SectionTitle>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Observações internas sobre este fornecedor"
              rows={4}
              className="flex w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 shadow-xs focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-(--primary-ring) resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.back()} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {supplierId ? "Salvar alterações" : "Cadastrar fornecedor"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
