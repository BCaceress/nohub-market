"use client";

import {
  ChefHat,
  ChevronDown,
  Layers,
  Package,
  Plus,
  Scissors,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  {
    route: "?type=SIMPLE",
    label: "Produto Simples",
    desc: "Unitário padrão — com busca automática por código de barras",
    icon: <Package className="h-4 w-4 shrink-0 text-muted-foreground" />,
  },
  {
    route: "?type=KIT",
    label: "Kit / Combo",
    desc: "Produtos prontos vendidos juntos (cesta, combo, pack)",
    icon: <Layers className="h-4 w-4 shrink-0 text-amber-500" />,
  },
  {
    route: "?type=KIT&kind=RECIPE",
    label: "Produzido / Receita",
    desc: "Formado por insumos fracionados (drink, lanche, pizza)",
    icon: <ChefHat className="h-4 w-4 shrink-0 text-green-500" />,
  },
  {
    route: "?type=FRACTIONED",
    label: "Produto Fracionado",
    desc: "Vendido por peso ou volume (kg, g, l, ml…)",
    icon: <Scissors className="h-4 w-4 shrink-0 text-green-500" />,
  },
  {
    route: "?type=CUSTOM",
    label: "Produto Personalizado",
    desc: "Itens fixos + opções montadas na venda (ex: drink)",
    icon: <SlidersHorizontal className="h-4 w-4 shrink-0 text-sky-500" />,
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

  function navigate(route: string) {
    setOpen(false);
    router.push(`/app/products/new${route}`);
  }

  return (
    <div ref={ref} className="relative">
      {/* Split button */}
      <div className="flex items-stretch">
        {/* Main action — defaults to SIMPLE */}
        <Button
          size="sm"
          className="rounded-r-none border-r border-primary-foreground/20 pr-3"
          onClick={() => navigate("?type=SIMPLE")}
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
              key={opt.route}
              type="button"
              onClick={() => navigate(opt.route)}
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left cursor-pointer hover:bg-muted transition-colors"
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
