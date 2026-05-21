"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Apple,
  Baby,
  Banana,
  Beef,
  Beer,
  Briefcase,
  Cake,
  Candy,
  Car,
  Carrot,
  ChevronDown,
  ChevronRight,
  Coffee,
  Cookie,
  CupSoda,
  Dumbbell,
  Egg,
  Fish,
  Flame,
  FlaskConical,
  Folder,
  FolderOpen,
  Gift,
  GlassWater,
  Grape,
  Heart,
  Home,
  IceCream,
  Info,
  Leaf,
  Milk,
  Package,
  Palette,
  Pencil,
  Pizza,
  Plus,
  Salad,
  Sandwich,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Utensils,
  Wheat,
  Wine,
  Zap,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCategoryAction,
  deleteCategoryAction,
  setCategoryTaxDefaultAction,
  updateCategoryAction,
} from "../actions/category-actions";

/* ── Icon palette ────────────────────────────────────────────── */

type IconDefinition = {
  id: string;
  label: string;
  Component: React.ElementType;
};

const ICON_OPTIONS: IconDefinition[] = [
  // Bebidas
  { id: "beer", label: "Cervejas", Component: Beer },
  { id: "wine", label: "Vinhos", Component: Wine },
  { id: "coffee", label: "Café / quentes", Component: Coffee },
  { id: "milk", label: "Laticínios / leite", Component: Milk },
  { id: "cup-soda", label: "Refrigerantes / sucos", Component: CupSoda },
  { id: "glass-water", label: "Água / bebidas", Component: GlassWater },
  // Frutas e vegetais
  { id: "apple", label: "Frutas", Component: Apple },
  { id: "banana", label: "Frutas tropicais", Component: Banana },
  { id: "grape", label: "Uvas / vitivinícola", Component: Grape },
  { id: "carrot", label: "Hortifruti", Component: Carrot },
  { id: "salad", label: "Saladas / naturais", Component: Salad },
  { id: "leaf", label: "Orgânicos / natural", Component: Leaf },
  // Proteínas e refeições
  { id: "beef", label: "Carnes / açougue", Component: Beef },
  { id: "fish", label: "Pescados", Component: Fish },
  { id: "egg", label: "Ovos", Component: Egg },
  { id: "utensils", label: "Gastronomia / restaurante", Component: Utensils },
  { id: "flame", label: "Grelhados / churrasco", Component: Flame },
  // Padaria e doces
  { id: "wheat", label: "Padaria / grãos", Component: Wheat },
  { id: "sandwich", label: "Lanches / padaria", Component: Sandwich },
  { id: "pizza", label: "Pizzas / fastfood", Component: Pizza },
  { id: "cake", label: "Bolos / confeitaria", Component: Cake },
  { id: "cookie", label: "Biscoitos / snacks", Component: Cookie },
  { id: "candy", label: "Doces / confeitaria", Component: Candy },
  { id: "ice-cream", label: "Sorvetes / gelados", Component: IceCream },
  // Supermercado e loja
  { id: "shopping-cart", label: "Mercearia", Component: ShoppingCart },
  { id: "shopping-bag", label: "Sacola / geral", Component: ShoppingBag },
  { id: "package", label: "Estoque / geral", Component: Package },
  { id: "tag", label: "Promoções / ofertas", Component: Tag },
  // Casa e saúde
  { id: "home", label: "Casa / limpeza", Component: Home },
  { id: "flask-conical", label: "Limpeza / químicos", Component: FlaskConical },
  { id: "heart", label: "Saúde / farmácia", Component: Heart },
  { id: "baby", label: "Bebê / infantil", Component: Baby },
  // Estilo de vida
  { id: "dumbbell", label: "Fitness / esporte", Component: Dumbbell },
  { id: "car", label: "Automotivo", Component: Car },
  // Destaques e negócios
  { id: "star", label: "Premium / destaque", Component: Star },
  { id: "gift", label: "Presentes", Component: Gift },
  { id: "zap", label: "Promoção / energéticos", Component: Zap },
  { id: "trending-up", label: "Eletrônicos / tech", Component: TrendingUp },
  { id: "briefcase", label: "Profissional / negócios", Component: Briefcase },
  { id: "palette", label: "Arte / criatividade", Component: Palette },
  { id: "shield", label: "Proteção / segurança", Component: Shield },
];

/* ── Color palette ───────────────────────────────────────────── */

const PRESET_COLORS = [
  { name: "Amber", value: "#f59e0b" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Purple", value: "#a855f7" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Green", value: "#10b981" },
  { name: "Lime", value: "#84cc16" },
  { name: "Slate", value: "#64748b" },
];

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
  icon: string | null;
  iconColor: string | null;
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

/* ── Icon picker ─────────────────────────────────────────────── */

type IconPickerValue = { iconId: string; color: string } | null;

function IconPicker({
  value,
  onChange,
}: {
  value: IconPickerValue;
  onChange: (v: IconPickerValue) => void;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const selectedColor = value?.color || "#f59e0b";

  function handleIconSelect(iconId: string) {
    onChange({ iconId, color: selectedColor });
  }

  function handleColorChange(color: string) {
    if (value) {
      onChange({ iconId: value.iconId, color });
    } else {
      // Se nenhum ícone escolhido, só atualiza a cor para quando selecionar
      onChange(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Preview do ícone selecionado */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        {value ? (
          <>
            {(() => {
              const iconDef = ICON_OPTIONS.find((o) => o.id === value.iconId);
              if (!iconDef) return null;
              return (
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    <iconDef.Component className="h-4 w-4" style={{ color: selectedColor }} />
                  </span>
                  <span className="text-sm font-medium">{iconDef.label}</span>
                </div>
              );
            })()}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onChange(null)}
            >
              Remover
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Clique em um ícone abaixo para selecionar</p>
        )}
      </div>

      {/* Grade de ícones — 3 linhas com scroll horizontal */}
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-2 pb-3">
        <div className="grid grid-rows-3 grid-flow-col gap-1.5" style={{ gridAutoColumns: "3rem" }}>
          {ICON_OPTIONS.map((opt) => {
            const isSelected = value?.iconId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.label}
                onClick={() => handleIconSelect(opt.id)}
                className={`flex h-11 w-12 flex-col items-center justify-center rounded-lg transition-all ${
                  isSelected ? "ring-2 ring-ring ring-offset-1" : "hover:bg-accent/60"
                }`}
                style={isSelected ? { backgroundColor: `${selectedColor}25` } : undefined}
              >
                <opt.Component
                  className="h-5 w-5"
                  style={{ color: isSelected ? selectedColor : undefined }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Cores — sempre visíveis abaixo dos ícones */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Cor do ícone</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.name}
              onClick={() => {
                if (value) {
                  onChange({ iconId: value.iconId, color: preset.value });
                }
              }}
              className={`h-7 w-7 rounded-md transition-all shrink-0 ${
                selectedColor === preset.value && value
                  ? "ring-2 ring-ring ring-offset-1 scale-110"
                  : value
                    ? "hover:scale-105 opacity-90 hover:opacity-100"
                    : "opacity-40 cursor-not-allowed"
              }`}
              style={{ backgroundColor: preset.value }}
              disabled={!value}
            />
          ))}

          {/* Quadrado cor customizada — abre color picker */}
          <button
            type="button"
            title="Cor customizada"
            onClick={() => value && colorInputRef.current?.click()}
            disabled={!value}
            className={`relative h-7 w-7 rounded-md border border-border overflow-hidden transition-all shrink-0 ${
              value ? "hover:scale-105 cursor-pointer" : "opacity-40 cursor-not-allowed"
            } ${
              value && !PRESET_COLORS.some((c) => c.value === selectedColor)
                ? "ring-2 ring-ring ring-offset-1 scale-110"
                : ""
            }`}
            style={{
              background:
                "conic-gradient(#ef4444, #f97316, #f59e0b, #84cc16, #10b981, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)",
            }}
          >
            <input
              ref={colorInputRef}
              type="color"
              className="sr-only"
              value={selectedColor}
              onChange={(e) => handleColorChange(e.target.value)}
            />
          </button>

          {/* Hex atual se for cor customizada */}
          {value && !PRESET_COLORS.some((c) => c.value === selectedColor) && (
            <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
              {selectedColor}
            </code>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Category row ─────────────────────────────────────────────── */

function CategoryRow({
  cat,
  depth,
  organizationId,
  allCategories,
  taxRegime,
  inheritedIcon,
  inheritedColor,
  onEdit,
  onDelete,
  onTaxEdit,
  onAddSubcategory,
}: {
  cat: Category;
  depth: number;
  organizationId: string;
  allCategories: Category[];
  taxRegime: string | null;
  inheritedIcon?: string | null;
  inheritedColor?: string | null;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onTaxEdit: (cat: Category) => void;
  onAddSubcategory: (parentCat: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (cat.children ?? []).length > 0;

  // Subcategoria herda ícone do pai
  const displayIconId = depth > 0 ? inheritedIcon : cat.icon;
  const displayColor = depth > 0 ? inheritedColor || "#f59e0b" : cat.iconColor || "#f59e0b";
  const iconDef = ICON_OPTIONS.find((opt) => opt.id === displayIconId);
  const IconComponent = iconDef?.Component;

  return (
    <>
      <div
        className={`flex items-center gap-2.5 py-2.5 pr-3 rounded-lg hover:bg-muted/40 group transition-colors ${
          depth === 0 ? "border-b border-border/50 last:border-0" : ""
        }`}
        style={{ paddingLeft: `${14 + depth * 22}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          className="h-4 w-4 shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5 inline-block" />
          )}
        </button>

        {/* Ícone */}
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${displayColor}20` }}
        >
          {IconComponent ? (
            <IconComponent className="h-3.5 w-3.5" style={{ color: displayColor }} />
          ) : hasChildren ? (
            expanded ? (
              <FolderOpen className="h-3.5 w-3.5" style={{ color: displayColor }} />
            ) : (
              <Folder className="h-3.5 w-3.5" style={{ color: displayColor }} />
            )
          ) : (
            <Tag className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </span>

        {/* Nome */}
        <span
          className={`flex-1 text-sm truncate ${depth === 0 ? "font-semibold" : "font-medium"}`}
        >
          {cat.name}
        </span>

        {/* Contagem de produtos */}
        <Badge variant="secondary" className="text-xs shrink-0 opacity-60">
          {cat._count?.products ?? 0} prod.
        </Badge>

        {/* Status fiscal */}
        {cat.taxDefault?.ncm ? (
          <Badge variant="success" className="text-xs shrink-0 font-mono">
            {cat.taxDefault.ncm}
          </Badge>
        ) : (
          <Badge variant="warning" className="text-xs shrink-0">
            Sem NCM
          </Badge>
        )}

        {/* Ações */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!hasChildren && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Adicionar subcategoria"
              onClick={() => onAddSubcategory(cat)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Fiscal padrão"
            onClick={() => onTaxEdit(cat)}
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Editar"
            onClick={() => onEdit(cat)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            title="Excluir"
            onClick={() => onDelete(cat)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filhos */}
      {hasChildren &&
        expanded &&
        (cat.children ?? []).map((child) => (
          <CategoryRow
            key={child.id}
            cat={child}
            depth={depth + 1}
            organizationId={organizationId}
            allCategories={allCategories}
            taxRegime={taxRegime}
            inheritedIcon={cat.icon}
            inheritedColor={cat.iconColor}
            onEdit={onEdit}
            onDelete={onDelete}
            onTaxEdit={onTaxEdit}
            onAddSubcategory={onAddSubcategory}
          />
        ))}
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
  const [subparentId, setSubparentId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: "", icon: null as IconPickerValue });

  // Tax dialog
  const [taxDialog, setTaxDialog] = useState(false);
  const [taxCat, setTaxCat] = useState<Category | null>(null);
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
  });

  // Subcategoria: sem picker de ícone (herda do pai)
  const isSubcategory =
    subparentId !== null || (editingCat !== null && editingCat.parentId !== null);

  /* ── Category CRUD ─────────────────────────────────────────── */

  function openNew() {
    setEditingCat(null);
    setSubparentId(null);
    setCatForm({ name: "", icon: null });
    setCatDialog(true);
  }

  function openNewSubcategory(parentCat: Category) {
    setEditingCat(null);
    setSubparentId(parentCat.id);
    setCatForm({ name: "", icon: null });
    setCatDialog(true);
  }

  function openEdit(cat: Category) {
    setEditingCat(cat);
    setSubparentId(null);
    setCatForm({
      name: cat.name,
      icon: cat.icon ? { iconId: cat.icon, color: cat.iconColor || "#f59e0b" } : null,
    });
    setCatDialog(true);
  }

  function handleCatSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input = {
        name: catForm.name,
        icon: isSubcategory ? undefined : catForm.icon?.iconId || undefined,
        iconColor: isSubcategory ? undefined : catForm.icon?.color || undefined,
        parentId: subparentId || undefined,
        position: 0,
      };
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
        toast.success("Fiscal padrão salvo!");
        setTaxDialog(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  const rootCategories = categories.filter((c) => !c.parentId);
  const totalCount = categories.length;
  const withTaxCount = categories.filter((c) => c.taxDefault?.ncm).length;

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground font-semibold">{totalCount}</strong> categoria
            {totalCount !== 1 ? "s" : ""}
          </span>
          <span className="text-border">|</span>
          <span>
            <strong className="text-foreground font-semibold">{withTaxCount}</strong> com NCM
          </span>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova categoria
        </Button>
      </div>

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
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="px-3 py-2">
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
                onAddSubcategory={openNewSubcategory}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dica fiscal */}
      {categories.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="h-3 w-3 shrink-0" />O fiscal padrão (NCM, ICMS, PIS, COFINS) é herdado
          pelos produtos sem configuração própria — RN-C13.
        </p>
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
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={
                  isSubcategory ? "Ex: Refrigerantes, Sucos…" : "Ex: Bebidas, Laticínios…"
                }
                required
                autoFocus
              />
            </div>

            {/* Ícone — apenas para categorias raiz */}
            {isSubcategory ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Subcategorias herdam o ícone e a cor da categoria pai automaticamente.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label>Ícone da categoria</Label>
                <IconPicker
                  value={catForm.icon}
                  onChange={(v) => setCatForm((f) => ({ ...f, icon: v }))}
                />
              </div>
            )}

            <div className="flex gap-2.5 justify-end pt-1 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setCatDialog(false)}>
                Cancelar
              </Button>
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
            <DialogTitle>Fiscal padrão — {taxCat?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1 mb-4">
            Aplicado a todos os produtos desta categoria sem configuração própria (RN-C13).
          </p>

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
}
