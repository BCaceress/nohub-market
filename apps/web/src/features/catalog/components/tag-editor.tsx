"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  bulkCreateTagsAction,
  createTagAction,
  deleteTagAction,
  updateTagAction,
} from "../actions/tag-actions";

/* ── Grupos ──────────────────────────────────────────────────── */

export const TAG_GROUPS: {
  id: string;
  label: string;
  color: string;
  scope: "SUBCATEGORY" | "PRODUCT";
}[] = [
  { id: "tipo", label: "Embalagem / Formato", color: "#3b82f6", scope: "PRODUCT" },
  { id: "volume", label: "Tamanho / Volume", color: "#8b5cf6", scope: "PRODUCT" },
  { id: "temperatura", label: "Temperatura", color: "#06b6d4", scope: "SUBCATEGORY" },
  { id: "dieta", label: "Dieta / Alimentação", color: "#10b981", scope: "SUBCATEGORY" },
  { id: "publico", label: "Público", color: "#f59e0b", scope: "SUBCATEGORY" },
  { id: "ocasiao", label: "Ocasião", color: "#ec4899", scope: "SUBCATEGORY" },
  { id: "comercial", label: "Comercial", color: "#ef4444", scope: "PRODUCT" },
  { id: "operacional", label: "Operacional", color: "#64748b", scope: "PRODUCT" },
  { id: "bebidas-alcoolicas", label: "Bebidas Alcoólicas", color: "#f97316", scope: "SUBCATEGORY" },
  { id: "energeticos", label: "Energéticos / Suplementos", color: "#84cc16", scope: "SUBCATEGORY" },
  { id: "ia", label: "IA / Recomendação", color: "#a855f7", scope: "SUBCATEGORY" },
  { id: "sazonalidade", label: "Sazonalidade", color: "#0ea5e9", scope: "SUBCATEGORY" },
  { id: "localizacao", label: "Localização Interna", color: "#78716c", scope: "PRODUCT" },
  { id: "marketplace", label: "Marketplace / App", color: "#14b8a6", scope: "PRODUCT" },
  { id: "geral", label: "Geral", color: "#94a3b8", scope: "PRODUCT" },
];

/* ── Sugestões pré-definidas ─────────────────────────────────── */

const TAG_SUGGESTIONS: { name: string; group: string }[] = [
  // Embalagem / Formato
  { name: "lata", group: "tipo" },
  { name: "garrafa", group: "tipo" },
  { name: "pet", group: "tipo" },
  { name: "vidro", group: "tipo" },
  { name: "long-neck", group: "tipo" },
  { name: "dose", group: "tipo" },
  { name: "combo", group: "tipo" },
  { name: "kit", group: "tipo" },
  { name: "refil", group: "tipo" },
  // Tamanho / Volume
  { name: "269ml", group: "volume" },
  { name: "350ml", group: "volume" },
  { name: "473ml", group: "volume" },
  { name: "600ml", group: "volume" },
  { name: "1l", group: "volume" },
  { name: "2l", group: "volume" },
  { name: "5l", group: "volume" },
  { name: "mini", group: "volume" },
  { name: "familia", group: "volume" },
  // Temperatura
  { name: "gelado", group: "temperatura" },
  { name: "temperatura-ambiente", group: "temperatura" },
  { name: "congelado", group: "temperatura" },
  { name: "resfriado", group: "temperatura" },
  // Dieta / Alimentação
  { name: "zero", group: "dieta" },
  { name: "sem-acucar", group: "dieta" },
  { name: "diet", group: "dieta" },
  { name: "light", group: "dieta" },
  { name: "vegano", group: "dieta" },
  { name: "sem-gluten", group: "dieta" },
  { name: "sem-lactose", group: "dieta" },
  { name: "fitness", group: "dieta" },
  { name: "proteico", group: "dieta" },
  { name: "organico", group: "dieta" },
  { name: "natural", group: "dieta" },
  // Público
  { name: "infantil", group: "publico" },
  { name: "adulto", group: "publico" },
  { name: "premium", group: "publico" },
  { name: "economico", group: "publico" },
  { name: "gourmet", group: "publico" },
  // Ocasião
  { name: "churrasco", group: "ocasiao" },
  { name: "festa", group: "ocasiao" },
  { name: "balada", group: "ocasiao" },
  { name: "happy-hour", group: "ocasiao" },
  { name: "cinema", group: "ocasiao" },
  { name: "lanche", group: "ocasiao" },
  { name: "cafe-da-manha", group: "ocasiao" },
  { name: "almoco", group: "ocasiao" },
  { name: "jantinha", group: "ocasiao" },
  // Comercial
  { name: "promocao", group: "comercial" },
  { name: "mais-vendido", group: "comercial" },
  { name: "lancamento", group: "comercial" },
  { name: "oferta", group: "comercial" },
  { name: "leve-mais", group: "comercial" },
  { name: "queima-estoque", group: "comercial" },
  { name: "alto-giro", group: "comercial" },
  // Operacional
  { name: "baixo-giro", group: "operacional" },
  { name: "fracionado", group: "operacional" },
  { name: "controla-validade", group: "operacional" },
  { name: "controla-lote", group: "operacional" },
  { name: "refrigerado", group: "operacional" },
  { name: "freezer", group: "operacional" },
  // Bebidas Alcoólicas
  { name: "pilsen", group: "bebidas-alcoolicas" },
  { name: "ipa", group: "bebidas-alcoolicas" },
  { name: "lager", group: "bebidas-alcoolicas" },
  { name: "sem-alcool", group: "bebidas-alcoolicas" },
  { name: "importada", group: "bebidas-alcoolicas" },
  { name: "artesanal", group: "bebidas-alcoolicas" },
  { name: "whisky", group: "bebidas-alcoolicas" },
  { name: "vodka", group: "bebidas-alcoolicas" },
  { name: "gin", group: "bebidas-alcoolicas" },
  { name: "vinho", group: "bebidas-alcoolicas" },
  { name: "espumante", group: "bebidas-alcoolicas" },
  // Energéticos / Suplementos
  { name: "alta-cafeina", group: "energeticos" },
  { name: "sem-taurina", group: "energeticos" },
  { name: "pre-treino", group: "energeticos" },
  { name: "hidratacao", group: "energeticos" },
  { name: "isotonico", group: "energeticos" },
  // IA / Recomendação
  { name: "acompanha-pizza", group: "ia" },
  { name: "acompanha-churrasco", group: "ia" },
  { name: "mistura-drink", group: "ia" },
  { name: "combina-com-whisky", group: "ia" },
  { name: "snack", group: "ia" },
  { name: "sobremesa", group: "ia" },
  // Sazonalidade
  { name: "verao", group: "sazonalidade" },
  { name: "inverno", group: "sazonalidade" },
  { name: "pascoa", group: "sazonalidade" },
  { name: "natal", group: "sazonalidade" },
  { name: "copa-do-mundo", group: "sazonalidade" },
  { name: "festa-junina", group: "sazonalidade" },
  // Localização Interna
  { name: "geladeira-1", group: "localizacao" },
  { name: "geladeira-2", group: "localizacao" },
  { name: "freezer", group: "localizacao" },
  { name: "prateleira-a", group: "localizacao" },
  { name: "checkout", group: "localizacao" },
  // Marketplace / App
  { name: "destaque-home", group: "marketplace" },
  { name: "banner-principal", group: "marketplace" },
  { name: "delivery-rapido", group: "marketplace" },
  { name: "somente-app", group: "marketplace" },
  { name: "cashback", group: "marketplace" },
];

/* ── Types ──────────────────────────────────────────────────── */

type TagItem = {
  id: string;
  name: string;
  slug: string;
  group: string;
  color: string | null;
  description: string | null;
  scope: "SUBCATEGORY" | "PRODUCT";
  _count: { products: number };
};

type ScopeFilter = "ALL" | "SUBCATEGORY" | "PRODUCT";

interface Props {
  organizationId: string;
  tags: TagItem[];
}

/* ── Helper ─────────────────────────────────────────────────── */

function groupColor(groupId: string) {
  return TAG_GROUPS.find((g) => g.id === groupId)?.color ?? "#94a3b8";
}

function groupLabel(groupId: string) {
  return TAG_GROUPS.find((g) => g.id === groupId)?.label ?? groupId;
}

function groupScope(groupId: string): "SUBCATEGORY" | "PRODUCT" {
  return TAG_GROUPS.find((g) => g.id === groupId)?.scope ?? "PRODUCT";
}

function ScopeBadge({ scope }: { scope: "SUBCATEGORY" | "PRODUCT" }) {
  return scope === "SUBCATEGORY" ? (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
      Subcategoria
    </span>
  ) : (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
      Produto
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function TagEditor({ organizationId, tags: initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [tags, setTags] = useState<TagItem[]>(initial);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Tag dialog
  const [tagDialog, setTagDialog] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [tagForm, setTagForm] = useState<{
    name: string;
    group: string;
    color: string;
    description: string;
    scope: "SUBCATEGORY" | "PRODUCT";
  }>({ name: "", group: "geral", color: "", description: "", scope: "PRODUCT" });

  // Suggestions dialog
  const [suggestDialog, setSuggestDialog] = useState(false);
  const [suggestSearch, setSuggestSearch] = useState("");
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [suggestGroup, setSuggestGroup] = useState<string | null>(null);

  /* ── Filtered tags ─────────────────────────────────────────── */

  const filteredTags = useMemo(() => {
    return tags.filter((t) => {
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.group.toLowerCase().includes(search.toLowerCase());
      const matchesGroup = !activeGroup || t.group === activeGroup;
      const matchesScope = scopeFilter === "ALL" || t.scope === scopeFilter;
      return matchesSearch && matchesGroup && matchesScope;
    });
  }, [tags, search, activeGroup, scopeFilter]);

  const tagsByGroup = useMemo(() => {
    const grouped = new Map<string, TagItem[]>();
    for (const tag of filteredTags) {
      const list = grouped.get(tag.group) ?? [];
      list.push(tag);
      grouped.set(tag.group, list);
    }
    return grouped;
  }, [filteredTags]);

  const groupsWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of tags) {
      counts.set(tag.group, (counts.get(tag.group) ?? 0) + 1);
    }
    return counts;
  }, [tags]);

  const scopeCounts = useMemo(() => {
    const sub = tags.filter((t) => t.scope === "SUBCATEGORY").length;
    const prod = tags.filter((t) => t.scope === "PRODUCT").length;
    return { SUBCATEGORY: sub, PRODUCT: prod };
  }, [tags]);

  /* ── Tag CRUD ──────────────────────────────────────────────── */

  function openNew() {
    setEditingTag(null);
    const grp = activeGroup ?? "geral";
    setTagForm({ name: "", group: grp, color: "", description: "", scope: groupScope(grp) });
    setTagDialog(true);
  }

  function openEdit(tag: TagItem) {
    setEditingTag(tag);
    setTagForm({
      name: tag.name,
      group: tag.group,
      color: tag.color ?? "",
      description: tag.description ?? "",
      scope: tag.scope,
    });
    setTagDialog(true);
  }

  function handleTagSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input = {
        name: tagForm.name.trim(),
        group: tagForm.group,
        color: tagForm.color || undefined,
        description: tagForm.description || undefined,
        scope: tagForm.scope,
      };

      const result = editingTag
        ? await updateTagAction(organizationId, editingTag.id, input)
        : await createTagAction(organizationId, input);

      if (result.success) {
        toast.success(editingTag ? "Tag atualizada!" : "Tag criada!");
        setTagDialog(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(tag: TagItem) {
    if (
      !confirm(
        `Excluir tag "${tag.name}"? ${tag._count.products > 0 ? `Será desassociada de ${tag._count.products} produto(s).` : ""}`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteTagAction(organizationId, tag.id);
      if (result.success) {
        toast.success("Tag removida");
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
      } else {
        toast.error(result.error);
      }
    });
  }

  /* ── Suggestions ───────────────────────────────────────────── */

  const existingNames = useMemo(() => new Set(tags.map((t) => t.name)), [tags]);

  const filteredSuggestions = useMemo(() => {
    return TAG_SUGGESTIONS.filter((s) => {
      const notExists = !existingNames.has(s.name);
      const matchesSearch =
        !suggestSearch ||
        s.name.toLowerCase().includes(suggestSearch.toLowerCase()) ||
        s.group.toLowerCase().includes(suggestSearch.toLowerCase());
      const matchesGroup = !suggestGroup || s.group === suggestGroup;
      return notExists && matchesSearch && matchesGroup;
    });
  }, [existingNames, suggestSearch, suggestGroup]);

  const suggestionsByGroup = useMemo(() => {
    const grouped = new Map<string, typeof TAG_SUGGESTIONS>();
    for (const s of filteredSuggestions) {
      const list = grouped.get(s.group) ?? [];
      list.push(s);
      grouped.set(s.group, list);
    }
    return grouped;
  }, [filteredSuggestions]);

  function toggleSuggestion(name: string) {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      for (const s of filteredSuggestions) next.add(s.name);
      return next;
    });
  }

  function handleBulkImport() {
    if (selectedSuggestions.size === 0) return;
    startTransition(async () => {
      const selected = TAG_SUGGESTIONS.filter((s) => selectedSuggestions.has(s.name));
      const result = await bulkCreateTagsAction(organizationId, { tags: selected });
      if (result.success) {
        toast.success(
          `${result.data.count} tag${result.data.count !== 1 ? "s" : ""} importada${result.data.count !== 1 ? "s" : ""}!`,
        );
        setSuggestDialog(false);
        setSelectedSuggestions(new Set());
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }

  /* ── Render ─────────────────────────────────────────────────── */

  const totalCount = tags.length;
  const usedInProducts = tags.filter((t) => t._count.products > 0).length;

  return (
    <>
      {/* Stats + ações */}
      <div className="flex items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground font-semibold">{totalCount}</strong> tag
            {totalCount !== 1 ? "s" : ""}
          </span>
          <span className="text-border">|</span>
          <span>
            <strong className="text-foreground font-semibold">{usedInProducts}</strong> em uso
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSuggestSearch("");
              setSuggestGroup(null);
              setSelectedSuggestions(new Set());
              setSuggestDialog(true);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Sugestões
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Nova tag
          </Button>
        </div>
      </div>

      {/* Layout 2 colunas */}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Sidebar: grupos + scope filter */}
        <div className="flex flex-col gap-1">
          {/* Scope filter */}
          <div className="flex rounded-lg border border-border overflow-hidden mb-2 text-xs font-medium">
            {(["ALL", "SUBCATEGORY", "PRODUCT"] as ScopeFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`flex-1 py-1.5 transition-colors ${
                  scopeFilter === s
                    ? s === "SUBCATEGORY"
                      ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                      : s === "PRODUCT"
                        ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                        : "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "ALL"
                  ? `Todos (${totalCount})`
                  : s === "SUBCATEGORY"
                    ? `Subcat. (${scopeCounts.SUBCATEGORY})`
                    : `Produto (${scopeCounts.PRODUCT})`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActiveGroup(null)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              activeGroup === null
                ? "bg-primary text-primary-foreground font-medium"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <span>Todos os grupos</span>
          </button>
          {TAG_GROUPS.filter((g) => groupsWithCounts.has(g.id)).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroup(g.id === activeGroup ? null : g.id)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                activeGroup === g.id ? "font-medium" : "hover:bg-muted text-muted-foreground"
              }`}
              style={
                activeGroup === g.id
                  ? { backgroundColor: `${g.color}20`, color: g.color }
                  : undefined
              }
            >
              <span className="truncate flex-1 text-left">{g.label}</span>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: g.scope === "SUBCATEGORY" ? "#06b6d4" : "#a855f7",
                  }}
                  title={g.scope === "SUBCATEGORY" ? "Subcategoria" : "Produto"}
                />
                <span
                  className="text-xs rounded-full px-1.5 py-0.5 bg-muted"
                  style={
                    activeGroup === g.id
                      ? { backgroundColor: `${g.color}30`, color: g.color }
                      : undefined
                  }
                >
                  {groupsWithCounts.get(g.id) ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Conteúdo: tags */}
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-9"
              placeholder="Buscar tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {filteredTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-14 text-center">
              <Tag className="h-7 w-7 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">
                {tags.length === 0 ? "Nenhuma tag cadastrada" : "Nenhuma tag encontrada"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tags.length === 0
                  ? "Crie tags manualmente ou importe sugestões pré-definidas."
                  : "Tente ajustar a busca ou filtro de grupo."}
              </p>
              {tags.length === 0 && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSuggestDialog(true);
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Importar sugestões
                  </Button>
                  <Button size="sm" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5" />
                    Nova tag
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              {Array.from(tagsByGroup.entries()).map(([groupId, groupTags]) => {
                const gColor = groupColor(groupId);
                const gScope = groupScope(groupId);
                const isCollapsed = collapsedGroups.has(groupId);

                return (
                  <div key={groupId} className="border-b border-border last:border-0">
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupId)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: gColor }}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                        {groupLabel(groupId)}
                      </span>
                      <ScopeBadge scope={gScope} />
                      <span className="text-xs text-muted-foreground ml-1">{groupTags.length}</span>
                    </button>

                    {/* Tags */}
                    {!isCollapsed && (
                      <div className="flex flex-wrap gap-2 px-4 py-3">
                        {groupTags.map((tag) => (
                          <div
                            key={tag.id}
                            className="group flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary/40 transition-colors"
                            style={
                              tag.color
                                ? {
                                    borderColor: `${tag.color}40`,
                                    backgroundColor: `${tag.color}10`,
                                    color: tag.color,
                                  }
                                : {
                                    borderColor: `${gColor}30`,
                                    backgroundColor: `${gColor}08`,
                                    color: gColor,
                                  }
                            }
                          >
                            <span className="font-medium">{tag.name}</span>
                            {tag._count.products > 0 && (
                              <span
                                className="opacity-50 text-[10px]"
                                title={`${tag._count.products} produto(s)`}
                              >
                                ·{tag._count.products}
                              </span>
                            )}
                            <div className="flex gap-0.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => openEdit(tag)}
                                className="hover:opacity-70 transition-opacity"
                                title="Editar"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(tag)}
                                className="hover:opacity-70 transition-opacity"
                                title="Excluir"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog: nova / editar tag ─────────────────────────── */}
      <Dialog open={tagDialog} onOpenChange={setTagDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar tag" : "Nova tag"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleTagSubmit} className="flex flex-col gap-4 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                value={tagForm.name}
                onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: gelado, lata, premium…"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Use letras minúsculas, números e hífens.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Grupo</Label>
              <select
                value={tagForm.group}
                onChange={(e) => {
                  const grp = e.target.value;
                  setTagForm((f) => ({ ...f, group: grp, scope: groupScope(grp) }));
                }}
                className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {TAG_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope toggle */}
            <div className="flex flex-col gap-1.5">
              <Label>
                Escopo{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (derivado do grupo, pode ajustar)
                </span>
              </Label>
              <div className="flex rounded-lg border border-input overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setTagForm((f) => ({ ...f, scope: "SUBCATEGORY" }))}
                  className={`flex-1 py-2 px-3 transition-colors text-left ${
                    tagForm.scope === "SUBCATEGORY"
                      ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="block text-xs font-semibold">Subcategoria</span>
                  <span className="block text-[10px] opacity-70">Contextual (gelado, vegano)</span>
                </button>
                <div className="w-px bg-border" />
                <button
                  type="button"
                  onClick={() => setTagForm((f) => ({ ...f, scope: "PRODUCT" }))}
                  className={`flex-1 py-2 px-3 transition-colors text-left ${
                    tagForm.scope === "PRODUCT"
                      ? "bg-violet-500/15 text-violet-700 dark:text-violet-400 font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="block text-xs font-semibold">Produto</span>
                  <span className="block text-[10px] opacity-70">Atributo SKU (350ml, lata)</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cor (opcional)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tagForm.color || groupColor(tagForm.group)}
                  onChange={(e) => setTagForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-9 rounded-md border border-input cursor-pointer"
                />
                <Input
                  placeholder="#3b82f6"
                  value={tagForm.color}
                  onChange={(e) => setTagForm((f) => ({ ...f, color: e.target.value }))}
                  className="font-mono text-sm"
                />
                {tagForm.color && (
                  <button
                    type="button"
                    onClick={() => setTagForm((f) => ({ ...f, color: "" }))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-1 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setTagDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: sugestões ────────────────────────────────── */}
      <Dialog open={suggestDialog} onOpenChange={setSuggestDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões de tags
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-1">
            Selecione as tags que deseja importar para sua biblioteca. Tags já existentes são
            ocultadas automaticamente.
          </p>

          {/* Filtros */}
          <div className="flex gap-2 mt-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Buscar sugestões…"
                value={suggestSearch}
                onChange={(e) => setSuggestSearch(e.target.value)}
              />
            </div>
            <select
              value={suggestGroup ?? ""}
              onChange={(e) => setSuggestGroup(e.target.value || null)}
              className="h-8 rounded-lg border border-input bg-card px-2 text-sm focus-visible:outline-none"
            >
              <option value="">Todos os grupos</option>
              {TAG_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Contagem e seleção rápida */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredSuggestions.length} disponíveis · {selectedSuggestions.size} selecionadas
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="hover:text-foreground transition-colors underline"
              >
                Selecionar todas
              </button>
              {selectedSuggestions.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSuggestions(new Set())}
                  className="hover:text-foreground transition-colors underline"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Lista de sugestões */}
          <div className="overflow-y-auto flex-1 rounded-lg border border-border">
            {filteredSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma sugestão disponível — todas já foram importadas ou filtradas.
                </p>
              </div>
            ) : (
              Array.from(suggestionsByGroup.entries()).map(([groupId, groupSuggestions]) => {
                const gColor = groupColor(groupId);
                const gScope = groupScope(groupId);
                return (
                  <div key={groupId} className="border-b border-border last:border-0">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 sticky top-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: gColor }}
                      />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                        {groupLabel(groupId)}
                      </span>
                      <ScopeBadge scope={gScope} />
                      <span className="text-xs text-muted-foreground ml-1">
                        {groupSuggestions.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 px-3 py-2.5">
                      {groupSuggestions.map((s) => {
                        const isSelected = selectedSuggestions.has(s.name);
                        return (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => toggleSuggestion(s.name)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                              isSelected ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100"
                            }`}
                            style={{
                              borderColor: isSelected ? gColor : `${gColor}40`,
                              backgroundColor: isSelected ? `${gColor}20` : `${gColor}08`,
                              color: gColor,
                            }}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 justify-end pt-1 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setSuggestDialog(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={selectedSuggestions.size === 0 || isPending}
              onClick={handleBulkImport}
            >
              {isPending
                ? "Importando…"
                : `Importar ${selectedSuggestions.size > 0 ? selectedSuggestions.size : ""} tag${selectedSuggestions.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
