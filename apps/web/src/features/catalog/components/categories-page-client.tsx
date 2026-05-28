"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FolderOpen, Info, Plus } from "lucide-react";
import { useRef } from "react";
import { CategoryEditor, type CategoryEditorHandle } from "./category-editor";

interface Props {
  organizationId: string;
  categories: never[];
  taxRegime: string | null;
  regimeLabel: string | null;
}

export function CategoriesPageClient({
  organizationId,
  categories,
  taxRegime,
  regimeLabel,
}: Props) {
  const editorRef = useRef<CategoryEditorHandle>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/app/products"
        backLabel="Produtos"
        icon={<FolderOpen className="h-5 w-5 text-primary" />}
        title="Categorias"
        description="Organize produtos e configure dados fiscais padrão por categoria."
        meta={
          regimeLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              Regime: <strong className="text-foreground font-medium">{regimeLabel}</strong>
            </span>
          ) : undefined
        }
        actions={
          <Button size="sm" onClick={() => editorRef.current?.openNew()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nova categoria
          </Button>
        }
      />

      <CategoryEditor
        ref={editorRef}
        organizationId={organizationId}
        categories={categories}
        taxRegime={taxRegime}
      />
    </div>
  );
}
