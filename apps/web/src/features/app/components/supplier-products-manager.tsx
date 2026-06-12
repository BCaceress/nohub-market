"use client";

import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
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
  listSupplierMappingsAction,
  searchOrgProductsAction,
} from "@/features/app/actions/supplier-actions";
import {
  createProductSupplierAction,
  deleteProductSupplierAction,
  updateProductSupplierAction,
} from "@/features/purchasing/actions/purchasing-actions";

type Mapping = {
  id: string;
  supplierId: string;
  productId: string;
  variantId: string | null;
  supplierProductCode: string;
  supplierProductName: string;
  purchaseUnit: string | null;
  defaultPackQuantity: number | null;
  minOrderQuantity: number | null;
  barcode: string | null;
  leadTimeDays: number | null;
  discountPercent: number | null;
  lastCost: number | null;
  previousCost: number | null;
  lastPurchaseAt: string | null;
  isPreferred: boolean;
  active: boolean;
  product: { id: string; name: string; sku: string; imageUrl: string | null };
  variant: { id: string; name: string } | null;
};

type ProductOption = { id: string; name: string; sku: string | null };

interface Props {
  supplierId: string;
  initialMappings: Mapping[];
}

const PURCHASE_UNITS = ["UN", "CX", "FARDO", "PCT", "DZ", "BANDEJA", "CENTO", "KG", "G", "L", "ML"];

const EMPTY_FORM = {
  productId: "",
  productName: "",
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

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function SupplierProductsManager({ supplierId, initialMappings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Product search state
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleProductSearch(q: string) {
    setProductSearch(q);
    setForm((f) => ({ ...f, productId: "", productName: "" }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await searchOrgProductsAction(q || undefined);
      setProductOptions(results);
      setShowDropdown(true);
    }, 250);
  }

  function selectProduct(p: ProductOption) {
    setForm((f) => ({
      ...f,
      productId: p.id,
      productName: p.name,
      supplierProductName: f.supplierProductName || p.name,
    }));
    setProductSearch(p.name);
    setShowDropdown(false);
  }

  function refresh() {
    startTransition(async () => {
      const fresh = await listSupplierMappingsAction(supplierId);
      setMappings(fresh as Mapping[]);
    });
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setProductSearch("");
    setProductOptions([]);
    setDialogOpen(true);
  }

  function openEdit(m: Mapping) {
    setEditing(m);
    setForm({
      productId: m.productId,
      productName: m.product.name,
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
    setProductSearch(m.product.name);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing && !form.productId) {
      toast.error("Selecione um produto");
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
            supplierId,
            productId: form.productId,
          });

      if (result.success) {
        toast.success(editing ? "Vínculo atualizado" : "Produto vinculado");
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
        toast.success("Vínculo removido");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Produtos que este fornecedor atende — código, preço e condições por produto.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Vincular produto
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Cód. no fornecedor</TableHead>
            <TableHead className="text-right">Último custo</TableHead>
            <TableHead className="text-right">Anterior</TableHead>
            <TableHead>Embalagem</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.length === 0 ? (
            <TableEmpty
              icon={<Search className="h-5 w-5 text-muted-foreground" />}
              title="Nenhum produto vinculado"
              description="Vincule os produtos que este fornecedor atende para comparar preços na hora de comprar."
            />
          ) : (
            mappings.map((m) => (
              <TableRow key={m.id} className={m.active ? undefined : "opacity-50"}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      {m.isPreferred && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      )}
                      <span className="font-medium text-sm">{m.product.name}</span>
                    </div>
                    {m.variant && (
                      <span className="text-xs text-muted-foreground">{m.variant.name}</span>
                    )}
                    {!m.active && (
                      <Badge variant="secondary" className="text-xs w-fit">
                        inativo
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{m.supplierProductCode}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {fmtMoney(m.lastCost)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmtMoney(m.previousCost)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {m.purchaseUnit
                    ? `${m.purchaseUnit}${m.defaultPackQuantity ? ` × ${m.defaultPackQuantity}` : ""}`
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {m.leadTimeDays != null ? `${m.leadTimeDays}d` : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(m)}
                      disabled={isPending}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(m.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar vínculo" : "Vincular produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {/* Product picker */}
            <div className="flex flex-col gap-1.5">
              <Label>Produto *</Label>
              {editing ? (
                <Input value={editing.product.name} disabled />
              ) : (
                <div ref={searchRef} className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar produto…"
                    value={productSearch}
                    onChange={(e) => handleProductSearch(e.target.value)}
                    onFocus={() => {
                      if (productOptions.length > 0) setShowDropdown(true);
                      else handleProductSearch(productSearch);
                    }}
                  />
                  {showDropdown && productOptions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md max-h-60 overflow-y-auto">
                      {productOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                          onMouseDown={() => selectProduct(p)}
                        >
                          <span className="text-sm font-medium">{p.name}</span>
                          {p.sku && <span className="text-xs text-muted-foreground">{p.sku}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
