"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, GitBranch, Layers, Package, Plus, Scissors } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  {
    type: "SIMPLE",
    label: "Produto Simples",
    desc: "Unitário padrão — com busca automática por código de barras",
    icon: <Package className="h-4 w-4 shrink-0 text-muted-foreground" />,
  },
  {
    type: "KIT",
    label: "Kit / Combo",
    desc: "Conjunto de produtos vendidos juntos",
    icon: <Layers className="h-4 w-4 shrink-0 text-amber-500" />,
  },
  {
    type: "FRACTIONED",
    label: "Produto Fracionado",
    desc: "Vendido por peso ou volume (kg, g, l, ml…)",
    icon: <Scissors className="h-4 w-4 shrink-0 text-green-500" />,
  },
  {
    type: "VARIANT_PARENT",
    label: "Produto com Variantes",
    desc: "Tem variações de tamanho, sabor, cor etc.",
    icon: <GitBranch className="h-4 w-4 shrink-0 text-blue-500" />,
  },
] as const;

export function NewProductDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function navigate(type: string) {
    setOpen(false);
    router.push(`/app/products/new?type=${type}`);
  }

  return (
    <div ref={ref} className="relative">
      {/* Split button */}
      <div className="flex items-stretch">
        {/* Main action — defaults to SIMPLE */}
        <Button
          size="sm"
          className="rounded-r-none border-r border-primary-foreground/20 pr-3"
          onClick={() => navigate("SIMPLE")}
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
        {/* Arrow trigger */}
        <Button
          size="sm"
          className="rounded-l-none px-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Escolher tipo de produto"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-xl border border-border bg-card shadow-lg py-1 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-100">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Tipo de produto
          </p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => navigate(opt.type)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
            >
              <span className="mt-0.5">{opt.icon}</span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-tight">{opt.label}</span>
                <span className="text-xs text-muted-foreground leading-snug">{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
