"use client";

import { Check, ChevronsUpDown, Package, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Product = { id: string; name: string; sku: string | null; unit: string };

type Props = {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  placeholder?: string;
};

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function ProductCombobox({
  products,
  value,
  onChange,
  id,
  placeholder = "Busque por nome ou SKU…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = products.find((p) => p.id === value);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return products.slice(0, 50);
    const terms = q.split(/\s+/);
    return products
      .filter((p) => {
        const hay = normalize(`${p.name} ${p.sku ?? ""}`);
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 50);
  }, [products, query]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Focus search when opening + decide se abre pra cima (auto-flip)
  useEffect(() => {
    if (open) {
      setActive(0);
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        const DROPDOWN_H = 340; // altura aproximada do painel
        const below = window.innerHeight - rect.bottom;
        const above = rect.top;
        setDropUp(below < DROPDOWN_H && above > below);
      }
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setQuery("");
  }, [open]);

  // Keep active item in view
  useEffect(() => {
    const node = listRef.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function pick(p: Product) {
    onChange(p.id);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[active];
      if (p) pick(p);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg px-3.5 py-2 text-left",
          "border border-input bg-card text-sm shadow-xs transition-[border-color,box-shadow] duration-150",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
          open && "border-primary ring-4 ring-[var(--primary-ring)]",
        )}
      >
        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-medium text-foreground">{selected.name}</span>
            {selected.sku && (
              <span className="shrink-0 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {selected.sku}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground/60">Selecione o produto</span>
        )}
        {selected ? (
          <X
            className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          />
        ) : (
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 w-full overflow-hidden rounded-lg border border-input bg-popover shadow-lg",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <ul ref={listRef} className="max-h-72 overflow-y-auto p-1">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado
              </li>
            ) : (
              results.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(p)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                      i === active ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.sku && (
                      <span className="shrink-0 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {p.sku}
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] text-muted-foreground">{p.unit}</span>
                    {p.id === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
