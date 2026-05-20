"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  setCategoryTaxDefaultAction,
} from "../actions/category-actions";
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  FolderOpen, Folder, Tag, Info,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

type TaxDefault = {
  ncm: string | null;
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
} | null;

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  taxDefault: TaxDefault;
  children: Category[];
  _count: { products: number };
};

interface Props {
  organizationId: string;
  categories: Category[];
  taxRegime: string | null;
}

/* ── Tax origin labels ───────────────────────────────────────── */

const TAX_ORIGIN_OPTIONS = [
  { value: "NACIONAL",                    label: "0 — Nacional" },
  { value: "IMPORTADO_DIRETO",            label: "1 — Importado direto" },
  { value: "IMPORTADO_NACIONAL",          label: "2 — Importado, nacional" },
  { value: "NACIONAL_MAIS_40_IMPORTADO",  label: "3 — Nacional, > 40% importado" },
  { value: "NACIONAL_MENOS_40_IMPORTADO", label: "4 — Nacional, ≤ 40% importado" },
  { value: "NACIONAL_SEM_SIMILAR",        label: "5 — Nacional, sem similar" },
  { value: "ESTRANGEIRO_DIRETO",          label: "6 — Estrangeiro direto" },
  { value: "ESTRANGEIRO_NACIONAL",        label: "7 — Estrangeiro, mercado interno" },
  { value: "NACIONAL_MENOS_70_IMPORTADO", label: "8 — Nacional, > 70% importado" },
];

const ICMS_CST_OPTIONS = [
  { value: "00", label: "00 — Tributado integralmente" },
  { value: "10", label: "10 — Tributado + ST" },
  { value: "20", label: "20 — Com redução de BC" },
  { value: "40", label: "40 — Isento" },
  { value: "41", label: "41 — Não tributado" },
  { value: "60", label: "60 — ICMS cobrado ant. por ST" },
  { value: "90", label: "90 — Outros" },
];

const ICMS_CSOSN_OPTIONS = [
  { value: "101", label: "101 — Tributado com crédito" },
  { value: "102", label: "102 — Tributado sem crédito" },
  { value: "103", label: "103 — Isenção p/ faixa de receita" },
  { value: "400", label: "400 — Não tributado" },
  { value: "500", label: "500 — ICMS cobrado ant. por ST" },
  { value: "900", label: "900 — Outros" },
];

const PIS_COFINS_CST_OPTIONS = [
  { value: "01", label: "01 — Alíquota básica" },
  { value: "06", label: "06 — Alíquota zero" },
  { value: "07", label: "07 — Isenta" },
  { value: "08", label: "08 — Sem incidência" },
  { value: "09", label: "09 — Suspensão" },
  { value: "49", label: "49 — Outras saídas" },
  { value: "99", label: "99 — Outras entradas" },
];

/* ── Category row ─────────────────────────────────────────────── */

function CategoryRow({
  cat,
  depth,
  organizationId,
  allCategories,
  taxRegime,
  onEdit,
  onDelete,
  onTaxEdit,
}: {
  cat: Category;
  depth: number;
  organizationId: string;
  allCategories: Category[];
  taxRegime: string | null;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onTaxEdit: (cat: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = cat.children.length > 0;

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/40 group transition-colors`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground/60"
          onClick={() => setExpanded((e) => !e)}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5 inline-block" />
          )}
        </button>

        {/* Icon */}
        {hasChildren ? (
          expanded ? <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" /> : <Folder className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Tag className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        )}

        {/* Name */}
        <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>

        {/* Product count */}
        <Badge variant="secondary" className="text-xs opacity-70">
          {cat._count.products} prod.
        </Badge>

        {/* Tax status */}
        {cat.taxDefault?.ncm ? (
          <Badge variant="success" className="text-xs">NCM {cat.taxDefault.ncm}</Badge>
        ) : (
          <Badge variant="warning" className="text-xs">Sem fiscal</Badge>
        )}

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            title="Editar fiscal padrão"
            onClick={() => onTaxEdit(cat)}
          >
            <Info className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => onEdit(cat)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(cat)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded &&
        cat.children.map((child) => (
          <CategoryRow
            key={child.id}
            cat={child}
            depth={depth + 1}
            organizationId={organizationId}
            allCategories={allCategories}
            taxRegime={taxRegime}
            onEdit={onEdit}
            onDelete={onDelete}
            onTaxEdit={onTaxEdit}
          />
        ))
      }
    </>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function CategoryEditor({ organizationId, categories: initial, taxRegime }: Props) {
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>(initial);

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: "", parentId: "" });

  // Tax dialog
  const [taxDialog, setTaxDialog] = useState(false);
  const [taxCat, setTaxCat] = useState<Category | null>(null);
  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI";

  const [taxForm, setTaxForm] = useState({
    ncm: "", cest: "", cfopInternal: "5102", cfopInterstate: "6102",
    origin: "NACIONAL", icmsCst: "", icmsCsosn: "",
    icmsRate: "", pisCst: "01", pisRate: "", cofinsCst: "01", cofinsRate: "",
  });

  /* ── Category CRUD ─────────────────────────────────────────── */

  function openNew() {
    setEditingCat(null);
    setCatForm({ name: "", parentId: "" });
    setCatDialog(true);
  }

  function openEdit(cat: Category) {
    setEditingCat(cat);
    setCatForm({ name: cat.name, parentId: cat.parentId ?? "" });
    setCatDialog(true);
  }

  function handleCatSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input = { name: catForm.name, parentId: catForm.parentId || undefined, position: 0 };
      const result = editingCat
        ? await updateCategoryAction(organizationId, editingCat.id, input)
        : await createCategoryAction(organizationId, input);

      if (result.success) {
        toast.success(editingCat ? "Categoria atualizada!" : "Categoria criada!");
        setCatDialog(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(cat: Category) {
    if (!confirm(`Excluir categoria "${cat.name}"? Produtos não serão afetados.`)) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(organizationId, cat.id);
      if (result.success) {
        toast.success("Categoria removida");
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      } else {
        toast.error(result.error);
      }
    });
  }

  /* ── Tax default ────────────────────────────────────────────── */

  function openTaxEdit(cat: Category) {
    setTaxCat(cat);
    const t = cat.taxDefault;
    setTaxForm({
      ncm: t?.ncm ?? "",
      cest: t?.cest ?? "",
      cfopInternal: t?.cfopInternal ?? "5102",
      cfopInterstate: t?.cfopInterstate ?? "6102",
      origin: t?.origin ?? "NACIONAL",
      icmsCst: t?.icmsCst ?? "",
      icmsCsosn: t?.icmsCsosn ?? "",
      icmsRate: t?.icmsRate?.toString() ?? "",
      pisCst: t?.pisCst ?? "01",
      pisRate: t?.pisRate?.toString() ?? "",
      cofinsCst: t?.cofinsCst ?? "01",
      cofinsRate: t?.cofinsRate?.toString() ?? "",
    });
    setTaxDialog(true);
  }

  function handleTaxSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taxCat) return;
    startTransition(async () => {
      const result = await setCategoryTaxDefaultAction(organizationId, {
        categoryId: taxCat.id,
        ncm: taxForm.ncm,
        cest: taxForm.cest || undefined,
        cfopInternal: taxForm.cfopInternal || undefined,
        cfopInterstate: taxForm.cfopInterstate || undefined,
        origin: taxForm.origin as never,
        icmsCst: (isSimples ? undefined : taxForm.icmsCst || undefined) as never,
        icmsCsosn: (isSimples ? taxForm.icmsCsosn || undefined : undefined) as never,
        icmsRate: taxForm.icmsRate ? Number(taxForm.icmsRate) : undefined,
        pisCst: taxForm.pisCst || undefined,
        pisRate: taxForm.pisRate ? Number(taxForm.pisRate) : undefined,
        cofinsCst: taxForm.cofinsCst || undefined,
        cofinsRate: taxForm.cofinsRate ? Number(taxForm.cofinsRate) : undefined,
      });
      if (result.success) {
        toast.success("Fiscal padrão da categoria salvo!");
        setTaxDialog(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  /* ── Flat list (root-only) ──────────────────────────────────── */
  const rootCategories = categories.filter((c) => !c.parentId);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {categories.length} categoria{categories.length !== 1 ? "s" : ""}. O fiscal padrão é herdado pelos produtos sem configuração própria (RN-C13).
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Nova categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-14 text-center">
          <Folder className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Nenhuma categoria</p>
          <p className="text-xs text-muted-foreground mt-1">Crie categorias para organizar e agilizar a configuração fiscal.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {rootCategories.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              depth={0}
              organizationId={organizationId}
              allCategories={categories}
              taxRegime={taxRegime}
              onEdit={openEdit}
              onDelete={handleDelete}
              onTaxEdit={openTaxEdit}
            />
          ))}
        </div>
      )}

      {/* Category dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCatSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome *</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Bebidas, Laticínios…"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria pai (opcional)</Label>
              <select
                value={catForm.parentId}
                onChange={(e) => setCatForm((f) => ({ ...f, parentId: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">Nível raiz</option>
                {categories
                  .filter((c) => c.id !== editingCat?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setCatDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tax default dialog */}
      <Dialog open={taxDialog} onOpenChange={setTaxDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fiscal padrão — {taxCat?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1 mb-3">
            Aplicado a todos os produtos desta categoria que não têm configuração própria (RN-C13).
          </p>

          <form onSubmit={handleTaxSubmit} className="flex flex-col gap-4">
            {/* NCM / CEST */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>NCM * (8 dígitos)</Label>
                <Input
                  value={taxForm.ncm}
                  onChange={(e) => setTaxForm((f) => ({ ...f, ncm: e.target.value.replace(/\D/g, "").slice(0, 8) }))}
                  placeholder="22021000"
                  maxLength={8}
                  pattern="\d{8}"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CEST (7 dígitos)</Label>
                <Input
                  value={taxForm.cest}
                  onChange={(e) => setTaxForm((f) => ({ ...f, cest: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
                  placeholder="0300400"
                  maxLength={7}
                />
              </div>
            </div>

            {/* CFOP */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>CFOP interno</Label>
                <Input
                  value={taxForm.cfopInternal}
                  onChange={(e) => setTaxForm((f) => ({ ...f, cfopInternal: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="5102"
                  maxLength={4}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CFOP interestadual</Label>
                <Input
                  value={taxForm.cfopInterstate}
                  onChange={(e) => setTaxForm((f) => ({ ...f, cfopInterstate: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="6102"
                  maxLength={4}
                />
              </div>
            </div>

            {/* Origem */}
            <div className="flex flex-col gap-1.5">
              <Label>Origem</Label>
              <select
                value={taxForm.origin}
                onChange={(e) => setTaxForm((f) => ({ ...f, origin: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {TAX_ORIGIN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* ICMS */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{isSimples ? "ICMS CSOSN" : "ICMS CST"}</Label>
                <select
                  value={isSimples ? taxForm.icmsCsosn : taxForm.icmsCst}
                  onChange={(e) =>
                    isSimples
                      ? setTaxForm((f) => ({ ...f, icmsCsosn: e.target.value }))
                      : setTaxForm((f) => ({ ...f, icmsCst: e.target.value }))
                  }
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">Selecionar…</option>
                  {(isSimples ? ICMS_CSOSN_OPTIONS : ICMS_CST_OPTIONS).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota ICMS (%)</Label>
                <Input
                  type="number" min="0" max="100" step="0.01"
                  value={taxForm.icmsRate}
                  onChange={(e) => setTaxForm((f) => ({ ...f, icmsRate: e.target.value }))}
                  placeholder="12.00"
                />
              </div>
            </div>

            {/* PIS / COFINS */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>PIS CST</Label>
                <select
                  value={taxForm.pisCst}
                  onChange={(e) => setTaxForm((f) => ({ ...f, pisCst: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">Selecionar…</option>
                  {PIS_COFINS_CST_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota PIS (%)</Label>
                <Input
                  type="number" min="0" max="100" step="0.0001"
                  value={taxForm.pisRate}
                  onChange={(e) => setTaxForm((f) => ({ ...f, pisRate: e.target.value }))}
                  placeholder="0.65"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>COFINS CST</Label>
                <select
                  value={taxForm.cofinsCst}
                  onChange={(e) => setTaxForm((f) => ({ ...f, cofinsCst: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value="">Selecionar…</option>
                  {PIS_COFINS_CST_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota COFINS (%)</Label>
                <Input
                  type="number" min="0" max="100" step="0.0001"
                  value={taxForm.cofinsRate}
                  onChange={(e) => setTaxForm((f) => ({ ...f, cofinsRate: e.target.value }))}
                  placeholder="3.00"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setTaxDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar fiscal padrão"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
