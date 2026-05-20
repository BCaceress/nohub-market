"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCNPJ, onlyDigits } from "@nohub/shared/brazilian";
import {
  createSupplierAction,
  updateSupplierAction,
  deleteSupplierAction,
  type SupplierInput,
} from "./actions/supplier-actions";

type Supplier = {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
};

const EMPTY: SupplierInput = { name: "", document: "", email: "", phone: "" };

function SupplierDialog({
  open,
  onOpenChange,
  organizationId,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  supplier?: Supplier;
  onSaved: (s: Supplier) => void;
}) {
  const [form, setForm] = useState<SupplierInput>({
    name: supplier?.name ?? "",
    document: supplier?.document ? formatCNPJ(supplier.document) : "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(partial: Partial<SupplierInput>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function submit() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = { ...form, document: onlyDigits(form.document ?? "") || undefined };
    const res = supplier
      ? await updateSupplierAction(organizationId, supplier.id, payload)
      : await createSupplierAction(organizationId, payload);
    setSaving(false);
    if (!res.success) { toast.error(res.error); return; }

    toast.success(supplier ? "Fornecedor atualizado!" : "Fornecedor criado!");
    onOpenChange(false);
    // For create we reload; for update we patch locally
    if (!supplier && res.success && "data" in res) {
      onSaved({ id: (res.data as { id: string }).id, ...payload, document: payload.document ?? null, email: payload.email || null, phone: payload.phone || null });
    } else if (supplier) {
      onSaved({ ...supplier, ...payload, document: payload.document ?? null, email: payload.email || null, phone: payload.phone || null });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Distribuidora XYZ"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>CNPJ / CPF</Label>
            <Input
              value={form.document ?? ""}
              onChange={(e) => set({ document: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="contato@distribuidora.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Telefone / WhatsApp</Label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="(11) 91234-5678"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : supplier ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuppliersManager({
  organizationId,
  initialSuppliers,
}: {
  organizationId: string;
  initialSuppliers: Supplier[];
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [dialog, setDialog] = useState<{ open: boolean; supplier?: Supplier }>({
    open: false,
  });
  const [removing, setRemoving] = useState<string | null>(null);

  function openCreate() { setDialog({ open: true, supplier: undefined }); }
  function openEdit(s: Supplier) { setDialog({ open: true, supplier: s }); }

  function handleSaved(s: Supplier) {
    setSuppliers((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      if (idx >= 0) return prev.map((x) => (x.id === s.id ? s : x));
      return [...prev, s];
    });
  }

  async function handleDelete(id: string) {
    setRemoving(id);
    const res = await deleteSupplierAction(organizationId, id);
    setRemoving(null);
    if (!res.success) {
      toast.error(res.error);
    } else {
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Fornecedor removido");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{suppliers.length} fornecedor(es)</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo fornecedor
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Package className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="font-medium">Nenhum fornecedor cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre seus fornecedores para vincular ao catálogo.
          </p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar fornecedor
          </Button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border">
          {suppliers.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {s.document && (
                    <span className="text-xs text-muted-foreground">
                      {formatCNPJ(s.document)}
                    </span>
                  )}
                  {s.email && (
                    <span className="text-xs text-muted-foreground">{s.email}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => openEdit(s)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(s.id)}
                  disabled={removing === s.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SupplierDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        organizationId={organizationId}
        supplier={dialog.supplier}
        onSaved={handleSaved}
      />
    </>
  );
}
