"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableEmpty,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createVariantAction, updateVariantAction, deleteVariantAction } from "../actions/variant-actions";
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";

type Variant = {
  id: string;
  name: string;
  sku: string | null;
  attributes: Record<string, string>;
  isActive: boolean;
  position: number;
};

interface Props {
  organizationId: string;
  productId: string;
  variants: Variant[];
}

export function VariantEditor({ organizationId, productId, variants: initialVariants }: Props) {
  const [isPending, startTransition] = useTransition();
  const [variants, setVariants] = useState(initialVariants);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

  const [form, setForm] = useState({ name: "", sku: "", attrKey: "", attrValue: "", attributes: {} as Record<string, string> });

  function openNew() {
    setEditingVariant(null);
    setForm({ name: "", sku: "", attrKey: "", attrValue: "", attributes: {} });
    setDialogOpen(true);
  }

  function openEdit(v: Variant) {
    setEditingVariant(v);
    setForm({ name: v.name, sku: v.sku ?? "", attrKey: "", attrValue: "", attributes: v.attributes ?? {} });
    setDialogOpen(true);
  }

  function addAttr() {
    if (!form.attrKey.trim()) return;
    setForm((f) => ({ ...f, attributes: { ...f.attributes, [f.attrKey.trim()]: f.attrValue }, attrKey: "", attrValue: "" }));
  }

  function removeAttr(key: string) {
    setForm((f) => {
      const attrs = { ...f.attributes };
      delete attrs[key];
      return { ...f, attributes: attrs };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input = { name: form.name, sku: form.sku || undefined, attributes: form.attributes, isActive: true, position: editingVariant?.position ?? variants.length };
      const result = editingVariant
        ? await updateVariantAction(organizationId, editingVariant.id, input)
        : await createVariantAction(organizationId, productId, input);

      if (result.success) {
        toast.success(editingVariant ? "Variante atualizada!" : "Variante criada!");
        setDialogOpen(false);
        // Refresh by reloading page data (server component will refetch)
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(variantId: string) {
    startTransition(async () => {
      const result = await deleteVariantAction(organizationId, variantId);
      if (result.success) {
        setVariants((vs) => vs.filter((v) => v.id !== variantId));
        toast.success("Variante removida");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Cada variante tem SKU, código de barras e preço próprios.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar variante
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variante</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Atributos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.length === 0 ? (
            <TableEmpty
              icon={<GitBranch className="h-5 w-5 text-muted-foreground" />}
              title="Nenhuma variante"
              description="Adicione variantes como tamanhos, sabores ou volumes."
            />
          ) : (
            variants.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="font-mono text-xs">{v.sku ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(v.attributes ?? {}).map(([k, val]) => (
                      <Badge key={k} variant="secondary" className="text-xs">
                        {k}: {String(val)}
                      </Badge>
                    ))}
                    {Object.keys(v.attributes ?? {}).length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={v.isActive ? "success" : "secondary"}>
                    {v.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(v.id)}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVariant ? "Editar variante" : "Nova variante"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: 350ml, Vermelho, P" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="REF-001-350ML" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Atributos</Label>
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Chave" value={form.attrKey} onChange={(e) => setForm((f) => ({ ...f, attrKey: e.target.value }))} />
                <Input className="flex-1" placeholder="Valor" value={form.attrValue} onChange={(e) => setForm((f) => ({ ...f, attrValue: e.target.value }))} />
                <Button type="button" variant="outline" onClick={addAttr} className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(form.attributes).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeAttr(k)}>
                    {k}: {v} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
