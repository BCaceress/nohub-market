"use client";

import { Pencil, Star, Trash2, Truck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createProductSupplierAction,
  deleteProductSupplierAction,
  listProductSuppliersAction,
  updateProductSupplierAction,
} from "@/features/purchasing/actions/purchasing-actions";

/** Valor numérico vindo do Prisma (Decimal) ou já serializado. */
type Numeric = number | string | { toString(): string } | null;

export type ProductSupplierMapping = {
  id: string;
  supplierId: string;
  supplierProductCode: string;
  supplierProductName: string;
  purchaseUnit: string | null;
  defaultPackQuantity: Numeric;
  minOrderQuantity: Numeric;
  barcode: string | null;
  leadTimeDays: number | null;
  discountPercent: Numeric;
  lastCost: Numeric;
  previousCost: Numeric;
  lastPurchaseAt: string | Date | null;
  isPreferred: boolean;
  active: boolean;
  supplier: { id: string; name: string; defaultLeadTimeDays: number | null };
};

type SupplierOption = { id: string; name: string };

interface Props {
  productId: string;
  suppliers: SupplierOption[];
  initialMappings: ProductSupplierMapping[];
}

const PURCHASE_UNITS = ["UN", "CX", "FARDO", "PCT", "DZ", "BANDEJA", "CENTO", "KG", "G", "L", "ML"];

const EMPTY_FORM = {
  supplierId: "",
  supplierProductCode: "",
  supplierProductName: "",
  purchaseUnit: "",
  defaultPackQuantity: "",
  minOrderQuantity: "",
  barcode: "",
  leadTimeDays: "",
  discountPercent: "",
  lastCost: "",
  isPreferred: false,
  active: true,
};

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtMoney(v: Numeric): string {
  if (v == null) return "—";
  const n = Number(v.toString());
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: Numeric): string {
  if (v == null) return "—";
  const n = Number(v.toString());
  return Number.isFinite(n) ? String(n) : "—";
}

export function ProductSuppliersManager({ productId, suppliers, initialMappings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [mappings, setMappings] = useState(initialMappings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductSupplierMapping | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Fornecedores ainda não vinculados — base do select ao criar
  const linkedIds = new Set(mappings.map((m) => m.supplierId));
  const availableSuppliers = suppliers.filter((s) => !linkedIds.has(s.id));

  function refresh() {
    startTransition(async () => {
      const fresh = (await listProductSuppliersAction(productId)) as ProductSupplierMapping[];
      setMappings(fresh);
    });
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: ProductSupplierMapping) {
    setEditing(m);
    setForm({
      supplierId: m.supplierId,
      supplierProductCode: m.supplierProductCode,
      supplierProductName: m.supplierProductName,
      purchaseUnit: m.purchaseUnit ?? "",
      defaultPackQuantity: m.defaultPackQuantity == null ? "" : String(m.defaultPackQuantity),
      minOrderQuantity: m.minOrderQuantity == null ? "" : String(m.minOrderQuantity),
      barcode: m.barcode ?? "",
      leadTimeDays: m.leadTimeDays == null ? "" : String(m.leadTimeDays),
      discountPercent: m.discountPercent == null ? "" : String(m.discountPercent),
      lastCost: m.lastCost == null ? "" : String(m.lastCost),
      isPreferred: m.isPreferred,
      active: m.active,
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing && !form.supplierId) {
      toast.error("Selecione um fornecedor");
      return;
    }
    startTransition(async () => {
      const payload = {
        supplierProductCode: form.supplierProductCode,
        supplierProductName: form.supplierProductName,
        purchaseUnit: (form.purchaseUnit || null) as never,
        defaultPackQuantity: toNum(form.defaultPackQuantity),
        minOrderQuantity: toNum(form.minOrderQuantity),
        barcode: form.barcode || null,
        leadTimeDays: form.leadTimeDays ? Math.trunc(Number(form.leadTimeDays)) : null,
        discountPercent: toNum(form.discountPercent),
        lastCost: toNum(form.lastCost),
        isPreferred: form.isPreferred,
        active: form.active,
      };

      const result = editing
        ? await updateProductSupplierAction(editing.id, payload)
        : await createProductSupplierAction({
            ...payload,
            supplierId: form.supplierId,
            productId,
          });

      if (result.success) {
        toast.success(editing ? "Fornecedor atualizado" : "Fornecedor vinculado");
        setDialogOpen(false);
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProductSupplierAction(id);
      if (result.success) {
        setMappings((ms) => ms.filter((m) => m.id !== id));
        toast.success("Fornecedor removido");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Vincule os fornecedores deste produto — preço, embalagem e prazo de cada um. O
          preferencial é sugerido nas compras.
        </p>
        <Button size="sm" onClick={openNew} disabled={availableSuppliers.length === 0 && !editing}>
          <Truck className="h-3.5 w-3.5" />
          Vincular fornecedor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Cód. no fornecedor</TableHead>
            <TableHead>Preço atual</TableHead>
            <TableHead>Anterior</TableHead>
            <TableHead>Embalagem</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.length === 0 ? (
            <TableEmpty
              icon={<Truck className="h-5 w-5 text-muted-foreground" />}
              title="Nenhum fornecedor"
              description="Vincule fornecedores para comparar preço e prazo na hora de comprar."
            />
          ) : (
            mappings.map((m) => {
              const lead = m.leadTimeDays ?? m.supplier.defaultLeadTimeDays;
              return (
                <TableRow key={m.id} className={m.active ? undefined : "opacity-50"}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {m.isPreferred && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      )}
                      {m.supplier.name}
                      {!m.active && (
                        <Badge variant="secondary" className="text-xs">
                          inativo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.supplierProductCode}</TableCell>
                  <TableCell>{fmtMoney(m.lastCost)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtMoney(m.previousCost)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.purchaseUnit
                      ? `${m.purchaseUnit}${
                          m.defaultPackQuantity ? ` × ${fmtNum(m.defaultPackQuantity)}` : ""
                        }`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{lead != null ? `${lead}d` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fornecedor" : "Vincular fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Fornecedor *</Label>
              {editing ? (
                <Input value={editing.supplier.name} disabled />
              ) : (
                <Select
                  value={form.supplierId}
                  onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
                  required
                >
                  <option value="">Selecione…</option>
                  {availableSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Código no fornecedor *</Label>
                <Input
                  value={form.supplierProductCode}
                  onChange={(e) => setForm((f) => ({ ...f, supplierProductCode: e.target.value }))}
                  placeholder="CC002L"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Nome no fornecedor *</Label>
                <Input
                  value={form.supplierProductName}
                  onChange={(e) => setForm((f) => ({ ...f, supplierProductName: e.target.value }))}
                  placeholder="Coca-Cola 2L"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Preço de compra (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.lastCost}
                  onChange={(e) => setForm((f) => ({ ...f, lastCost: e.target.value }))}
                  placeholder="8,90"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>EAN do fornecedor</Label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                  placeholder="7894900011517"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Unidade de compra</Label>
                <Select
                  value={form.purchaseUnit}
                  onChange={(e) => setForm((f) => ({ ...f, purchaseUnit: e.target.value }))}
                >
                  <option value="">—</option>
                  {PURCHASE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Qtd. por embalagem</Label>
                <Input
                  inputMode="decimal"
                  value={form.defaultPackQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, defaultPackQuantity: e.target.value }))}
                  placeholder="6"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Pedido mínimo</Label>
                <Input
                  inputMode="decimal"
                  value={form.minOrderQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderQuantity: e.target.value }))}
                  placeholder="1"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Prazo de entrega (dias)</Label>
                <Input
                  inputMode="numeric"
                  value={form.leadTimeDays}
                  onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                  placeholder="3"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Desconto (%)</Label>
                <Input
                  inputMode="decimal"
                  value={form.discountPercent}
                  onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-500"
                  checked={form.isPreferred}
                  onChange={(e) => setForm((f) => ({ ...f, isPreferred: e.target.checked }))}
                />
                Fornecedor preferencial
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Ativo
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
