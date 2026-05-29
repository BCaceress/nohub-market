"use client";

import { FolderOpen, Loader2, Plus } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import {
  clearCategoryIconsAction,
  getCategoriesAction,
} from "@/features/catalog/actions/category-actions";
import { CategoryEditor, type CategoryEditorHandle } from "./category-editor";

/* ── Types ──────────────────────────────────────────────── */

interface CategorySheetProps {
  organizationId: string;
  taxRegime?: string | null;
  onCategoryCreated?: (cat: { id: string; name: string; parentId: string | null }) => void;
}

export type CategorySheetHandle = {
  open: () => void;
  close: () => void;
};

/* ── Component ──────────────────────────────────────────── */

export const CategorySheet = forwardRef<CategorySheetHandle, CategorySheetProps>(
  function CategorySheet({ organizationId, taxRegime = null, onCategoryCreated }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [categories, setCategories] = useState<never[]>([]);
    const [loading, setLoading] = useState(false);
    const editorRef = useRef<CategoryEditorHandle>(null);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    useImperativeHandle(ref, () => ({ open, close }));

    // Fetch categories on open; clear icons on first open
    useEffect(() => {
      if (!isOpen) return;
      setLoading(true);
      clearCategoryIconsAction(organizationId).then(() =>
        getCategoriesAction(organizationId)
          .then((data) => setCategories(data as never[]))
          .finally(() => setLoading(false)),
      );
    }, [isOpen, organizationId]);

    return (
      <Sheet open={isOpen} onClose={close} className="w-full max-w-[480px]">
        <SheetHeader
          title={
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary shrink-0" />
              Categorias
            </span>
          }
          description="Organize produtos e configure dados fiscais padrão."
          onClose={close}
          actions={
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => editorRef.current?.openNew()}
              disabled={loading}
            >
              <Plus className="h-3 w-3" />
              Nova
            </Button>
          }
        />
        <SheetBody>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CategoryEditor
              ref={editorRef}
              organizationId={organizationId}
              categories={categories}
              taxRegime={taxRegime}
              onCategoryCreated={onCategoryCreated}
            />
          )}
        </SheetBody>
      </Sheet>
    );
  },
);

/* ── Trigger button ─────────────────────────────────────── */

export function CategorySheetTrigger({
  organizationId,
  taxRegime,
  onCategoryCreated,
}: CategorySheetProps) {
  const sheetRef = useRef<CategorySheetHandle>(null);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => sheetRef.current?.open()}
        className="gap-1.5"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Categorias
      </Button>

      <CategorySheet
        ref={sheetRef}
        organizationId={organizationId}
        taxRegime={taxRegime}
        onCategoryCreated={onCategoryCreated}
      />
    </>
  );
}
