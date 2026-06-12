"use client";

import {
  ChevronDown,
  ChevronRight,
  Folder,
  MoreVertical,
  Pencil,
  Plus,
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
  updateCategoryAction,
} from "../actions/category-actions";

/* ── Types ──────────────────────────────────────────────────── */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  iconColor: string | null;
  parentId: string | null;
  position: number;
  children: Category[];
  _count: { products: number };
};

interface Props {
  organizationId: string;
  categories: Category[];
  taxRegime: string | null;
  onCategoryCreated?: (cat: { id: string; name: string; parentId: string | null }) => void;
}

/* ── Actions menu ─────────────────────────────────────────────── */

function CatActionsMenu({
  cat,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
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
        <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(cat)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={() => onDelete(cat)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Subcategory row ──────────────────────────────────────────── */

function SubcategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: Category;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
      <button
        type="button"
        onClick={() => onEdit(cat)}
        className="flex-1 truncate text-left text-sm font-medium transition-colors hover:text-primary cursor-pointer"
        title="Editar subcategoria"
      >
        {cat.name}
      </button>
      <span className="shrink-0 text-[11px] text-muted-foreground/60">
        {cat._count?.products ?? 0} prod.
      </span>
      <CatActionsMenu cat={cat} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

/* ── Root row (list) ──────────────────────────────────────────── */

function RootRow({
  cat,
  divider,
  onEdit,
  onDelete,
  onAddSubcategory,
}: {
  cat: Category;
  divider: boolean;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onAddSubcategory: (parentCat: Category) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = cat.children ?? [];

  return (
    <div className={cn(divider && "border-t border-border")}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          <span className="shrink-0 text-muted-foreground/50">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
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
        <CatActionsMenu cat={cat} onEdit={onEdit} onDelete={onDelete} />
      </div>

      {/* Subcategorias */}
      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 px-3 py-2">
          {children.length === 0 ? (
            <button
              type="button"
              onClick={() => onAddSubcategory(cat)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-4 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar subcategoria
            </button>
          ) : (
            <div className="flex flex-col">
              {children.map((child) => (
                <SubcategoryRow key={child.id} cat={child} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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

/* ── Main component ──────────────────────────────────────────── */

export type CategoryEditorHandle = { openNew: () => void };

export const CategoryEditor = forwardRef<CategoryEditorHandle, Props>(function CategoryEditor(
  { organizationId, categories: initial, onCategoryCreated }: Props,
  ref,
) {
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>(initial);

  // Category dialog
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [subparentId, setSubparentId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: "" });
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input whenever dialog opens
  useEffect(() => {
    if (catDialog) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [catDialog]);

  // Subcategoria: sem picker de ícone (herda do pai)
  const isSubcategory =
    subparentId !== null || (editingCat !== null && editingCat.parentId !== null);

  /* ── Expose openNew to parent via ref ──────────────────────── */
  useImperativeHandle(ref, () => ({ openNew: () => openNew() }));

  /* ── Category CRUD ─────────────────────────────────────────── */

  const EMPTY_CAT_FORM = { name: "" };

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
    setCatForm({ name: cat.name });
    setCatDialog(true);
  }

  function handleCatSubmit(e: React.FormEvent, mode: "save" | "saveAndNew" = "save") {
    e.preventDefault();
    startTransition(async () => {
      const parentId = subparentId ?? editingCat?.parentId ?? null;
      const input = {
        name: catForm.name,
        parentId: parentId ?? undefined,
        position: 0,
      };

      if (editingCat) {
        const result = await updateCategoryAction(organizationId, editingCat.id, input);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setCategories((prev) => treeUpdate(prev, editingCat.id, { name: catForm.name }));
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
        children: [],
        _count: { products: 0 },
      };
      setCategories((prev) => treeInsert(prev, newNode, parentId));
      onCategoryCreated?.({ id: result.data.id, name: catForm.name, parentId });
      toast.success("Categoria criada!");

      if (mode === "saveAndNew") {
        setCatForm((f) => ({ ...f, name: "" }));
        setTimeout(() => nameInputRef.current?.focus(), 30);
        return;
      }

      // Categoria raiz recém-criada → encadeia para cadastro de subcategorias
      if (!parentId) {
        setEditingCat(null);
        setSubparentId(newNode.id);
        setCatForm(EMPTY_CAT_FORM);
        setTimeout(() => nameInputRef.current?.focus(), 30);
        return;
      }

      setCatDialog(false);
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
            Categorias organizam o catálogo em grupos e subgrupos de produtos.
          </p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Criar primeira categoria
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {rootCategories.map((cat, i) => (
            <RootRow
              key={cat.id}
              cat={cat}
              divider={i > 0}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAddSubcategory={openNewSubcategory}
            />
          ))}
        </div>
      )}

      {/* ── Dialog: categoria ──────────────────────────────────── */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-lg" onClose={() => setCatDialog(false)}>
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

            <div className="flex gap-2.5 justify-end pt-1 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setCatDialog(false)}>
                {isSubcategory && !editingCat ? "Concluir" : "Cancelar"}
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
    </>
  );
});
