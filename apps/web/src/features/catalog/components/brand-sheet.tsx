"use client";

import { Loader2, Plus, Tag } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { getBrandsAction, upsertBrandAction } from "@/features/catalog/actions/brand-actions";

/* ── Types ──────────────────────────────────────────────── */

type Brand = { id: string; name: string };

/* ── Helpers ─────────────────────────────────────────────── */

function normalizeBrandName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/((?:^|[\s-])\w)/g, (c) => c.toUpperCase());
}

interface BrandSheetProps {
  organizationId: string;
}

export type BrandSheetHandle = {
  open: () => void;
  close: () => void;
};

/* ── Component ──────────────────────────────────────────── */

export const BrandSheet = forwardRef<BrandSheetHandle, BrandSheetProps>(function BrandSheet(
  { organizationId },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useImperativeHandle(ref, () => ({ open, close }));

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getBrandsAction(organizationId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        setBrands(sorted);
      })
      .finally(() => setLoading(false));
  }, [isOpen, organizationId]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isOpen]);

  function handleAdd() {
    if (!newName.trim()) return;
    const normalized = normalizeBrandName(newName.trim());
    // Check case-insensitive duplicate before sending to server
    const existingByName = brands.find((b) => b.name.toLowerCase() === normalized.toLowerCase());
    if (existingByName) {
      toast.info("Marca já existe");
      setNewName("");
      return;
    }
    startTransition(async () => {
      const res = await upsertBrandAction(organizationId, normalized);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setBrands((prev) => {
        const exists = prev.find((b) => b.id === res.id);
        if (exists) {
          toast.info("Marca já existe");
          return prev;
        }
        const next = [...prev, { id: res.id, name: normalized }];
        next.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        return next;
      });
      toast.success(`Marca "${normalized}" adicionada`);
      setNewName("");
      inputRef.current?.focus();
    });
  }

  return (
    <Sheet open={isOpen} onClose={close} className="w-full max-w-100">
      <SheetHeader
        title={
          <span className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary shrink-0" />
            Marcas
          </span>
        }
        description="Cadastre e visualize as marcas do catálogo."
        onClose={close}
      />
      <SheetBody className="flex flex-col gap-4">
        {/* Add new brand */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da marca…"
            className="h-9 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            size="sm"
            className="h-9 gap-1.5 shrink-0"
            disabled={!newName.trim() || isPending}
            onClick={handleAdd}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar
          </Button>
        </div>

        {/* Brand list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Tag className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Nenhuma marca cadastrada</p>
              <p className="mt-0.5 text-xs text-muted-foreground max-w-50">
                Digite acima para adicionar a primeira marca.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {brands.length} marca{brands.length !== 1 ? "s" : ""}
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {brands.map((b, i) => (
                <div
                  key={b.id}
                  className={`group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/40 ${
                    i > 0 ? "border-t border-border/60" : ""
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                    <Tag className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {b.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetBody>
    </Sheet>
  );
});

/* ── Trigger button ─────────────────────────────────────── */

export function BrandSheetTrigger({ organizationId }: { organizationId: string }) {
  const sheetRef = useRef<BrandSheetHandle>(null);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => sheetRef.current?.open()}
        className="gap-1.5"
      >
        <Tag className="h-3.5 w-3.5" />
        Marcas
      </Button>

      <BrandSheet ref={sheetRef} organizationId={organizationId} />
    </>
  );
}
