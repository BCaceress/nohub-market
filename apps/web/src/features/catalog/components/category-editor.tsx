"use client";

import {
  Boxes,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Folder,
  Info,
  Loader2,
  type LucideIcon,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Thermometer,
  Trash2,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createCategoryAction,
  deleteCategoryAction,
  setCategoryTaxDefaultAction,
  suggestSubcategoryTaxAction,
  type TaxSuggestion,
  updateCategoryAction,
} from "../actions/category-actions";

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
  ipiCst: string | null;
  ipiRate: { toString(): string } | null;
  unitTaxable: boolean;
} | null;

type Temperature = "AMBIENTE" | "REFRIGERADO" | "CONGELADO";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  iconColor: string | null;
  parentId: string | null;
  position: number;
  hasAgeRestriction?: boolean;
  storageTemperature?: Temperature | null;
  controlsExpiry?: boolean;
  controlsLot?: boolean;
  taxDefault: TaxDefault;
  children: Category[];
  _count: { products: number };
};

const TEMPERATURE_OPTIONS: { value: Temperature; label: string; emoji: string }[] = [
  { value: "AMBIENTE", label: "Ambiente", emoji: "🌡️" },
  { value: "REFRIGERADO", label: "Refrigerado", emoji: "❄️" },
  { value: "CONGELADO", label: "Congelado", emoji: "🧊" },
];

interface Props {
  organizationId: string;
  categories: Category[];
  taxRegime: string | null;
  onCategoryCreated?: (cat: { id: string; name: string; parentId: string | null }) => void;
}

/* ── Tax constants ───────────────────────────────────────────── */

const TAX_ORIGIN_OPTIONS = [
  { value: "NACIONAL", label: "0 — Nacional" },
  { value: "IMPORTADO_DIRETO", label: "1 — Importado direto" },
  { value: "IMPORTADO_NACIONAL", label: "2 — Importado, nacional" },
  { value: "NACIONAL_MAIS_40_IMPORTADO", label: "3 — Nacional, > 40% importado" },
  { value: "NACIONAL_MENOS_40_IMPORTADO", label: "4 — Nacional, ≤ 40% importado" },
  { value: "NACIONAL_SEM_SIMILAR", label: "5 — Nacional, sem similar" },
  { value: "ESTRANGEIRO_DIRETO", label: "6 — Estrangeiro direto" },
  { value: "ESTRANGEIRO_NACIONAL", label: "7 — Estrangeiro, mercado interno" },
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

/** Badges do perfil herdável de uma subcategoria — ícones lucide, estilo minimalista. */
function ProfileBadges({ cat }: { cat: Category }) {
  const tempIcon = cat.storageTemperature === "AMBIENTE" ? Thermometer : Snowflake;
  const tempLabel = TEMPERATURE_OPTIONS.find((t) => t.value === cat.storageTemperature)?.label;

  const chips: {
    key: string;
    icon: LucideIcon;
    label: string;
    tone: "fiscal" | "warn" | "muted";
  }[] = [];
  if (cat.taxDefault?.ncm)
    chips.push({ key: "ncm", icon: Receipt, label: cat.taxDefault.ncm, tone: "fiscal" });
  else chips.push({ key: "no-ncm", icon: Receipt, label: "Sem NCM", tone: "warn" });
  if (cat.hasAgeRestriction)
    chips.push({ key: "age", icon: ShieldAlert, label: "+18", tone: "muted" });
  if (cat.storageTemperature && tempLabel)
    chips.push({ key: "temp", icon: tempIcon, label: tempLabel, tone: "muted" });
  if (cat.controlsExpiry)
    chips.push({ key: "exp", icon: CalendarClock, label: "Validade", tone: "muted" });
  if (cat.controlsLot) chips.push({ key: "lot", icon: Boxes, label: "Lote", tone: "muted" });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <span
            key={c.key}
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              c.tone === "fiscal" && "font-mono text-emerald-600 dark:text-emerald-400",
              c.tone === "warn" && "text-amber-600 dark:text-amber-400",
              c.tone === "muted" && "text-muted-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

function CatActionsMenu({
  cat,
  onEdit,
  onDelete,
  onTaxEdit,
  onAddSubcategory,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onTaxEdit: (cat: Category) => void;
  onAddSubcategory: (parentCat: Category) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {!cat.parentId && (
          <DropdownMenuItem onClick={() => onAddSubcategory(cat)}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar subcategoria
          </DropdownMenuItem>
        )}
        {cat.parentId && (
          <DropdownMenuItem onClick={() => onTaxEdit(cat)}>
            <Info className="h-3.5 w-3.5" />
            Fiscal padrão
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onEdit(cat)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={() => onDelete(cat)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SubcategoryCard({
  cat,
  onEdit,
  onDelete,
  onTaxEdit,
  onAddSubcategory,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onTaxEdit: (cat: Category) => void;
  onAddSubcategory: (parentCat: Category) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-1/30 p-3.5 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onTaxEdit(cat)}
          className="flex-1 truncate text-left text-sm font-medium transition-colors hover:text-primary"
          title="Editar fiscal padrão"
        >
          {cat.name}
        </button>
        <span className="shrink-0 text-[11px] text-muted-foreground/60">
          {cat._count?.products ?? 0} prod.
        </span>
        <CatActionsMenu
          cat={cat}
          onEdit={onEdit}
          onDelete={onDelete}
          onTaxEdit={onTaxEdit}
          onAddSubcategory={onAddSubcategory}
        />
      </div>
      <ProfileBadges cat={cat} />
    </div>
  );
}

function RootCard({
  cat,
  onEdit,
  onDelete,
  onTaxEdit,
  onAddSubcategory,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onTaxEdit: (cat: Category) => void;
  onAddSubcategory: (parentCat: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = cat.children ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Folder className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-none">{cat.name}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground/70">
              {children.length} subcategoria{children.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>

        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 gap-1.5 sm:inline-flex"
          onClick={() => onAddSubcategory(cat)}
        >
          <Plus className="h-3.5 w-3.5" />
          Subcategoria
        </Button>
        <CatActionsMenu
          cat={cat}
          onEdit={onEdit}
          onDelete={onDelete}
          onTaxEdit={onTaxEdit}
          onAddSubcategory={onAddSubcategory}
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Subcategorias */}
      {expanded && (
        <div className="border-t border-border/60 p-3">
          {children.length === 0 ? (
            <button
              type="button"
              onClick={() => onAddSubcategory(cat)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/10 px-4 py-5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar subcategoria
            </button>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {children.map((child) => (
                <SubcategoryCard
                  key={child.id}
                  cat={child}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onTaxEdit={onTaxEdit}
                  onAddSubcategory={onAddSubcategory}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Tree helpers (pure) ─────────────────────────────────────── */

function treeInsert(tree: Category[], node: Category, parentId: string | null): Category[] {
  if (!parentId) return [...tree, node];
  return tree.map((cat) => {
    if (cat.id === parentId) return { ...cat, children: [...(cat.children ?? []), node] };
    if ((cat.children ?? []).length > 0)
      return { ...cat, children: treeInsert(cat.children, node, parentId) };
    return cat;
  });
}

function treeUpdate(tree: Category[], id: string, patch: Partial<Category>): Category[] {
  return tree.map((cat) => {
    if (cat.id === id) return { ...cat, ...patch };
    if ((cat.children ?? []).length > 0)
      return { ...cat, children: treeUpdate(cat.children, id, patch) };
    return cat;
  });
}

function treeRemove(tree: Category[], id: string): Category[] {
  return tree
    .filter((cat) => cat.id !== id)
    .map((cat) => ({
      ...cat,
      children: treeRemove(cat.children ?? [], id),
    }));
}

function treeUpdateTax(tree: Category[], id: string, tax: Category["taxDefault"]): Category[] {
  return tree.map((cat) => {
    if (cat.id === id) return { ...cat, taxDefault: tax };
    if ((cat.children ?? []).length > 0)
      return { ...cat, children: treeUpdateTax(cat.children, id, tax) };
    return cat;
  });
}

/* ── Main component ──────────────────────────────────────────── */

export type CategoryEditorHandle = { openNew: () => void };

export const CategoryEditor = forwardRef<CategoryEditorHandle, Props>(function CategoryEditor(
  { organizationId, categories: initial, taxRegime, onCategoryCreated }: Props,
  ref,
) {
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>(initial);

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [subparentId, setSubparentId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    hasAgeRestriction: false,
    storageTemperature: "" as "" | Temperature,
    controlsExpiry: false,
    controlsLot: false,
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input whenever dialog opens
  useEffect(() => {
    if (catDialog) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [catDialog]);

  // Tax dialog
  const [taxDialog, setTaxDialog] = useState(false);
  const [taxCat, setTaxCat] = useState<Category | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | undefined>(undefined);
  const [aiConfidence, setAiConfidence] = useState<TaxSuggestion["confidence"] | undefined>(
    undefined,
  );
  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI";

  const [taxForm, setTaxForm] = useState({
    ncm: "",
    cest: "",
    cfopInternal: "5102",
    cfopInterstate: "6102",
    origin: "NACIONAL",
    icmsCst: "",
    icmsCsosn: "",
    icmsRate: "",
    pisCst: "01",
    pisRate: "",
    cofinsCst: "01",
    cofinsRate: "",
    ipiCst: "",
    ipiRate: "",
  });

  // Subcategoria: sem picker de ícone (herda do pai)
  const isSubcategory =
    subparentId !== null || (editingCat !== null && editingCat.parentId !== null);

  /* ── Expose openNew to parent via ref ──────────────────────── */
  useImperativeHandle(ref, () => ({ openNew: () => openNew() }));

  /* ── Category CRUD ─────────────────────────────────────────── */

  const EMPTY_CAT_FORM = {
    name: "",
    hasAgeRestriction: false,
    storageTemperature: "" as "" | Temperature,
    controlsExpiry: false,
    controlsLot: false,
  };

  function openNew() {
    setEditingCat(null);
    setSubparentId(null);
    setCatForm(EMPTY_CAT_FORM);
    setCatDialog(true);
  }

  function openNewSubcategory(parentCat: Category) {
    setEditingCat(null);
    setSubparentId(parentCat.id);
    setCatForm(EMPTY_CAT_FORM);
    setCatDialog(true);
  }

  function openEdit(cat: Category) {
    setEditingCat(cat);
    setSubparentId(null);
    setCatForm({
      name: cat.name,
      hasAgeRestriction: cat.hasAgeRestriction ?? false,
      storageTemperature: cat.storageTemperature ?? "",
      controlsExpiry: cat.controlsExpiry ?? false,
      controlsLot: cat.controlsLot ?? false,
    });
    setCatDialog(true);
  }

  function handleCatSubmit(e: React.FormEvent, mode: "save" | "saveAndNew" = "save") {
    e.preventDefault();
    startTransition(async () => {
      const parentId = subparentId ?? editingCat?.parentId ?? null;
      // Perfil operacional só se aplica a subcategorias (Category filha)
      const isSub = parentId !== null;
      const input = {
        name: catForm.name,
        parentId: parentId ?? undefined,
        position: 0,
        hasAgeRestriction: isSub ? catForm.hasAgeRestriction : false,
        storageTemperature: isSub ? catForm.storageTemperature || undefined : undefined,
        controlsExpiry: isSub ? catForm.controlsExpiry : false,
        controlsLot: isSub ? catForm.controlsLot : false,
      };

      if (editingCat) {
        const result = await updateCategoryAction(organizationId, editingCat.id, input);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setCategories((prev) =>
          treeUpdate(prev, editingCat.id, {
            name: catForm.name,
            hasAgeRestriction: input.hasAgeRestriction,
            storageTemperature: (input.storageTemperature as Temperature) || null,
            controlsExpiry: input.controlsExpiry,
            controlsLot: input.controlsLot,
          }),
        );
        toast.success("Categoria atualizada!");
        setCatDialog(false);
        return;
      }

      const result = await createCategoryAction(organizationId, input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const newNode: Category = {
        id: result.data.id,
        name: catForm.name,
        slug: catForm.name.toLowerCase().replace(/\s+/g, "-"),
        icon: null,
        iconColor: null,
        parentId: parentId,
        position: 0,
        hasAgeRestriction: input.hasAgeRestriction,
        storageTemperature: (input.storageTemperature as Temperature) || null,
        controlsExpiry: input.controlsExpiry,
        controlsLot: input.controlsLot,
        taxDefault: null,
        children: [],
        _count: { products: 0 },
      };
      setCategories((prev) => treeInsert(prev, newNode, parentId));
      onCategoryCreated?.({ id: result.data.id, name: catForm.name, parentId });
      toast.success("Categoria criada!");

      if (mode === "saveAndNew") {
        setCatForm((f) => ({ ...f, name: "" }));
        setTimeout(() => nameInputRef.current?.focus(), 30);
      } else {
        setCatDialog(false);
      }
    });
  }

  function handleDelete(cat: Category) {
    if (!confirm(`Excluir categoria "${cat.name}"? Produtos não serão afetados.`)) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(organizationId, cat.id);
      if (result.success) {
        setCategories((prev) => treeRemove(prev, cat.id));
        toast.success("Categoria removida");
      } else {
        toast.error(result.error);
      }
    });
  }

  /* ── Tax default ────────────────────────────────────────────── */

  function openTaxEdit(cat: Category) {
    setTaxCat(cat);
    setAiNotes(undefined);
    setAiConfidence(undefined);
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
      ipiCst: t?.ipiCst ?? "",
      ipiRate: t?.ipiRate?.toString() ?? "",
    });
    setTaxDialog(true);

    // Auto-sugestão IA para subcategorias sem NCM cadastrado
    if (cat.parentId && !t?.ncm) {
      void triggerAiSuggestion(cat);
    }
  }

  async function triggerAiSuggestion(cat: Category) {
    setIsAiSuggesting(true);
    setAiNotes(undefined);
    setAiConfidence(undefined);

    // Busca nome da categoria pai
    const parentCat = cat.parentId ? categories.find((c) => c.id === cat.parentId) : undefined;

    const result = await suggestSubcategoryTaxAction({
      subcategoryName: cat.name,
      parentCategoryName: parentCat?.name,
      taxRegime,
    });

    setIsAiSuggesting(false);

    if (result.success) {
      const s = result.data;
      setAiNotes(s.notes);
      setAiConfidence(s.confidence);
      // Preenche apenas campos vazios com sugestão da IA
      setTaxForm((prev) => ({
        ncm: prev.ncm || s.ncm || prev.ncm,
        cest: prev.cest || s.cest || prev.cest,
        cfopInternal: prev.cfopInternal || s.cfopInternal || prev.cfopInternal,
        cfopInterstate: prev.cfopInterstate || s.cfopInterstate || prev.cfopInterstate,
        origin: prev.origin !== "NACIONAL" ? prev.origin : (s.origin ?? prev.origin),
        icmsCst: prev.icmsCst || s.icmsCst || prev.icmsCst,
        icmsCsosn: prev.icmsCsosn || s.icmsCsosn || prev.icmsCsosn,
        icmsRate: prev.icmsRate || s.icmsRate || prev.icmsRate,
        pisCst: prev.pisCst || s.pisCst || prev.pisCst,
        pisRate: prev.pisRate || s.pisRate || prev.pisRate,
        cofinsCst: prev.cofinsCst || s.cofinsCst || prev.cofinsCst,
        cofinsRate: prev.cofinsRate || s.cofinsRate || prev.cofinsRate,
        ipiCst: prev.ipiCst,
        ipiRate: prev.ipiRate,
      }));
    } else {
      toast.error(result.error ?? "IA indisponível");
    }
  }

  function handleTaxSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taxCat) return;
    startTransition(async () => {
      const payload = {
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
        ipiCst: taxForm.ipiCst || undefined,
        ipiRate: taxForm.ipiRate ? Number(taxForm.ipiRate) : undefined,
      };
      const result = await setCategoryTaxDefaultAction(organizationId, payload);
      if (result.success) {
        // Patch taxDefault in local tree — no flicker
        const newTax: Category["taxDefault"] = {
          ncm: taxForm.ncm || null,
          cest: taxForm.cest || null,
          cfopInternal: taxForm.cfopInternal || null,
          cfopInterstate: taxForm.cfopInterstate || null,
          origin: taxForm.origin,
          icmsCst: isSimples ? null : taxForm.icmsCst || null,
          icmsCsosn: isSimples ? taxForm.icmsCsosn || null : null,
          icmsRate: taxForm.icmsRate ? { toString: () => taxForm.icmsRate } : null,
          pisCst: taxForm.pisCst || null,
          pisRate: taxForm.pisRate ? { toString: () => taxForm.pisRate } : null,
          cofinsCst: taxForm.cofinsCst || null,
          cofinsRate: taxForm.cofinsRate ? { toString: () => taxForm.cofinsRate } : null,
          ipiCst: taxForm.ipiCst || null,
          ipiRate: taxForm.ipiRate ? { toString: () => taxForm.ipiRate } : null,
          unitTaxable: taxCat.taxDefault?.unitTaxable ?? false,
        };
        setCategories((prev) => treeUpdateTax(prev, taxCat.id, newTax));
        toast.success("Fiscal padrão salvo!");
        setTaxDialog(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const rootCategories = categories.filter((c) => !c.parentId);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      {/* Lista de categorias */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <Folder className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold">Nenhuma categoria cadastrada</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Categorias organizam o catálogo e permitem configurar dados fiscais padrão para um grupo
            de produtos.
          </p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Criar primeira categoria
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rootCategories.map((cat) => (
            <RootCard
              key={cat.id}
              cat={cat}
              onEdit={openEdit}
              onDelete={handleDelete}
              onTaxEdit={openTaxEdit}
              onAddSubcategory={openNewSubcategory}
            />
          ))}
        </div>
      )}

      {/* ── Dialog: categoria ──────────────────────────────────── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCat
                ? isSubcategory
                  ? "Editar subcategoria"
                  : "Editar categoria"
                : isSubcategory
                  ? "Nova subcategoria"
                  : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCatSubmit} className="flex flex-col gap-5 mt-1">
            {/* Nome */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                ref={nameInputRef}
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={
                  isSubcategory ? "Ex: Refrigerantes, Sucos…" : "Ex: Bebidas, Laticínios…"
                }
                required
                autoFocus
              />
            </div>

            {/* Perfil herdável — subcategorias */}
            {isSubcategory && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Perfil herdável pelos produtos
                </p>

                {/* Temperatura de armazenagem */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Temperatura de armazenagem</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPERATURE_OPTIONS.map((opt) => {
                      const active = catForm.storageTemperature === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setCatForm((f) => ({
                              ...f,
                              storageTemperature: active ? "" : opt.value,
                            }))
                          }
                          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
                            active
                              ? "border-primary bg-primary/10 font-medium text-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <span>{opt.emoji}</span>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Restrição de idade */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={catForm.hasAgeRestriction}
                    onChange={(e) =>
                      setCatForm((f) => ({ ...f, hasAgeRestriction: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Restrição de idade (+18)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Exige verificação de maioridade na venda
                    </p>
                  </div>
                </label>

                {/* Controla validade */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={catForm.controlsExpiry}
                    onChange={(e) =>
                      setCatForm((f) => ({ ...f, controlsExpiry: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Controla validade</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Produtos exigem data de validade no recebimento
                    </p>
                  </div>
                </label>

                {/* Controla lote */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={catForm.controlsLot}
                    onChange={(e) => setCatForm((f) => ({ ...f, controlsLot: e.target.checked }))}
                    className="h-4 w-4 rounded border border-input accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">Controla lote</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Rastreabilidade por lote no estoque
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-2.5 justify-end pt-1 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setCatDialog(false)}>
                Cancelar
              </Button>
              {!editingCat && isSubcategory && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending || !catForm.name.trim()}
                  onClick={(e) => handleCatSubmit(e as unknown as React.FormEvent, "saveAndNew")}
                >
                  Salvar e criar outra
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: fiscal padrão ─────────────────────────────── */}
      <Dialog open={taxDialog} onOpenChange={setTaxDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Fiscal padrão — {taxCat?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 -mt-1 mb-1">
            <p className="text-xs text-muted-foreground">
              Aplicado a todos os produtos desta subcategoria sem configuração própria (RN-C13).
            </p>
            {taxCat?.parentId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs shrink-0"
                disabled={isAiSuggesting}
                onClick={() => taxCat && void triggerAiSuggestion(taxCat)}
              >
                {isAiSuggesting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-blue-500" />
                )}
                {isAiSuggesting ? "Consultando IA…" : "Sugerir com IA"}
              </Button>
            )}
          </div>

          {/* Banner de sugestão IA */}
          {isAiSuggesting && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mb-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              IA identificando valores fiscais para "{taxCat?.name}"…
            </div>
          )}
          {!isAiSuggesting && aiNotes && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mb-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Sugestão IA</span>
                <span>{aiNotes}</span>
                {aiConfidence && (
                  <span className="opacity-70">
                    Confiança:{" "}
                    {aiConfidence === "high"
                      ? "alta"
                      : aiConfidence === "medium"
                        ? "média"
                        : "baixa"}
                    . Revise antes de salvar.
                  </span>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleTaxSubmit} className="flex flex-col gap-4">
            {/* NCM / CEST */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>
                  NCM <span className="text-destructive">*</span>{" "}
                  <span className="text-muted-foreground font-normal">(8 dígitos)</span>
                </Label>
                <Input
                  value={taxForm.ncm}
                  onChange={(e) =>
                    setTaxForm((f) => ({
                      ...f,
                      ncm: e.target.value.replace(/\D/g, "").slice(0, 8),
                    }))
                  }
                  placeholder="22021000"
                  maxLength={8}
                  pattern="\d{8}"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>
                  CEST{" "}
                  <span className="text-muted-foreground font-normal">(7 dígitos, opcional)</span>
                </Label>
                <Input
                  value={taxForm.cest}
                  onChange={(e) =>
                    setTaxForm((f) => ({
                      ...f,
                      cest: e.target.value.replace(/\D/g, "").slice(0, 7),
                    }))
                  }
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
                  onChange={(e) =>
                    setTaxForm((f) => ({
                      ...f,
                      cfopInternal: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                  placeholder="5102"
                  maxLength={4}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CFOP interestadual</Label>
                <Input
                  value={taxForm.cfopInterstate}
                  onChange={(e) =>
                    setTaxForm((f) => ({
                      ...f,
                      cfopInterstate: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
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
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
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
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota ICMS (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
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
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota PIS (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
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
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota COFINS (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  value={taxForm.cofinsRate}
                  onChange={(e) => setTaxForm((f) => ({ ...f, cofinsRate: e.target.value }))}
                  placeholder="3.00"
                />
              </div>
            </div>

            {/* IPI */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>IPI CST</Label>
                <Input
                  value={taxForm.ipiCst}
                  onChange={(e) =>
                    setTaxForm((f) => ({
                      ...f,
                      ipiCst: e.target.value.replace(/\D/g, "").slice(0, 3),
                    }))
                  }
                  placeholder="50"
                  maxLength={3}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Alíquota IPI (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxForm.ipiRate}
                  onChange={(e) => setTaxForm((f) => ({ ...f, ipiRate: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-1 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setTaxDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar fiscal padrão"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
});
