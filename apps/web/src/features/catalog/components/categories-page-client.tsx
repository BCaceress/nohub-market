"use client";

import { FolderOpen, Plus } from "lucide-react";
import { useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CategoryEditor, type CategoryEditorHandle } from "./category-editor";

interface Props {
  organizationId: string;
  categories: never[];
  taxRegime: string | null;
  regimeLabel: string | null;
}

export function CategoriesPageClient({ organizationId, categories, taxRegime }: Props) {
  const editorRef = useRef<CategoryEditorHandle>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/app/products"
        backLabel="Produtos"
        icon={<FolderOpen className="h-5 w-5 text-primary" />}
        title="Categorias"
        description="Organize produtos em categorias e subcategorias."
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
