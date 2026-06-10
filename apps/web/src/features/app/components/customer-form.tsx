"use client";

import { formatCNPJ, formatCPF, onlyDigits } from "@nohub/shared/brazilian";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CustomerInput,
  createCustomerAction,
  lookupCustomerCepAction,
  updateCustomerAction,
} from "../actions/customer-actions";
import { lookupCnpjAction } from "../actions/supplier-actions";

const EMPTY: CustomerInput = {
  personType: "PF",
  name: "",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
  contactName: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressDistrict: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  notes: "",
};

interface Props {
  organizationId: string;
  customerId?: string;
  initialValues?: Partial<CustomerInput>;
  /** Quando embutido em sheet de edição — chamado após salvar com sucesso. */
  onSaved?: () => void;
}

export function CustomerForm({ organizationId, customerId, initialValues, onSaved }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerInput>({ ...EMPTY, ...initialValues });
  const [saving, setSaving] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  const isPJ = form.personType === "PJ";

  function set(partial: Partial<CustomerInput>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  const docMasked = form.document
    ? isPJ
      ? formatCNPJ(form.document)
      : formatCPF(form.document)
    : "";

  async function handleCnpjLookup() {
    const digits = onlyDigits(form.document ?? "");
    if (digits.length !== 14) {
      toast.error("Digite um CNPJ válido (14 dígitos)");
      return;
    }
    setLookingUpCnpj(true);
    const res = await lookupCnpjAction(digits);
    setLookingUpCnpj(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    set({
      name: d.nomeFantasia || d.razaoSocial || form.name,
      email: d.email || form.email,
      phone: d.telefone || form.phone,
      addressStreet: d.logradouro || form.addressStreet,
      addressNumber: d.numero || form.addressNumber,
      addressComplement: d.complemento || form.addressComplement,
      addressDistrict: d.bairro || form.addressDistrict,
      addressCity: d.municipio || form.addressCity,
      addressState: d.uf || form.addressState,
      addressZip: d.cep ? onlyDigits(d.cep) : form.addressZip,
    });
    toast.success("Dados preenchidos via CNPJ");
  }

  async function handleCepLookup() {
    const digits = onlyDigits(form.addressZip ?? "");
    if (digits.length !== 8) {
      toast.error("Digite um CEP válido (8 dígitos)");
      return;
    }
    setLookingUpCep(true);
    const res = await lookupCustomerCepAction(digits);
    setLookingUpCep(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    set({
      addressStreet: d.street || form.addressStreet,
      addressDistrict: d.district || form.addressDistrict,
      addressCity: d.city || form.addressCity,
      addressState: d.state || form.addressState,
    });
    toast.success("Endereço preenchido via CEP");
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload: CustomerInput = {
      ...form,
      document: form.document ? onlyDigits(form.document) : undefined,
    };

    const res = customerId
      ? await updateCustomerAction(organizationId, customerId, payload)
      : await createCustomerAction(organizationId, payload);

    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(customerId ? "Cliente atualizado!" : "Cliente criado!");
    if (!customerId && "data" in res && res.data) {
      router.push(`/app/customers/${(res.data as { id: string }).id}`);
    } else {
      onSaved?.();
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-16">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        {/* ── Esquerda: Identificação + Endereço ──────────────────── */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <SectionTitle>Identificação</SectionTitle>

          {/* Tipo de pessoa */}
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              {(["PF", "PJ"] as const).map((t) => {
                const active = form.personType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set({ personType: t })}
                    className={`cursor-pointer rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Documento — CPF ou CNPJ (com lookup) */}
          <div className="flex flex-col gap-2">
            <Label>{isPJ ? "CNPJ" : "CPF"}</Label>
            <div className="flex gap-2">
              <Input
                value={docMasked}
                onChange={(e) => set({ document: e.target.value })}
                placeholder={isPJ ? "XX.XXX.XXX/XXXX-XX" : "XXX.XXX.XXX-XX"}
                className="flex-1"
              />
              {isPJ && (
                <Button
                  type="button"
                  onClick={handleCnpjLookup}
                  disabled={lookingUpCnpj}
                  className="shrink-0"
                >
                  {lookingUpCnpj ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>
                {isPJ ? "Razão social / Nome" : "Nome"} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={isPJ ? "Nome da empresa" : "Nome completo"}
              />
            </div>
            {isPJ && (
              <div className="flex flex-col gap-2">
                <Label>Contato</Label>
                <Input
                  value={form.contactName ?? ""}
                  onChange={(e) => set({ contactName: e.target.value })}
                  placeholder="Pessoa de contato"
                />
              </div>
            )}
          </div>

          {/* Endereço */}
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Endereço
            </p>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4 flex flex-col gap-2">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.addressZip ?? ""}
                    onChange={(e) => set({ addressZip: e.target.value })}
                    placeholder="00000-000"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCepLookup}
                    disabled={lookingUpCep}
                    className="shrink-0"
                    aria-label="Buscar CEP"
                  >
                    {lookingUpCep ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
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
              <div className="col-span-8 flex flex-col gap-2">
                <Label>Complemento</Label>
                <Input
                  value={form.addressComplement ?? ""}
                  onChange={(e) => set({ addressComplement: e.target.value })}
                  placeholder="Ap., bloco, referência..."
                />
              </div>
              <div className="col-span-5 flex flex-col gap-2">
                <Label>Bairro</Label>
                <Input
                  value={form.addressDistrict ?? ""}
                  onChange={(e) => set({ addressDistrict: e.target.value })}
                  placeholder="Bairro"
                />
              </div>
              <div className="col-span-4 flex flex-col gap-2">
                <Label>Cidade</Label>
                <Input
                  value={form.addressCity ?? ""}
                  onChange={(e) => set({ addressCity: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="col-span-3 flex flex-col gap-2">
                <Label>UF</Label>
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

        {/* ── Direita: Contato + Observações + Ações ──────────────── */}
        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
            <SectionTitle>Contato</SectionTitle>
            <div className="flex flex-col gap-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp ?? ""}
                onChange={(e) => set({ whatsapp: e.target.value })}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
            <SectionTitle>Observações</SectionTitle>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Observações internas sobre este cliente"
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
              {customerId ? "Salvar alterações" : "Cadastrar cliente"}
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
