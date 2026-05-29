"use client";

import {
  Building2,
  Check,
  ChevronDown,
  Globe2,
  Moon,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setSelectedLocationAction } from "@/features/app/actions/selected-location-actions";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { cn } from "@/lib/utils";

export type LocationKind = "STORE" | "DC" | "HYBRID" | "WAREHOUSE" | "DARK_STORE";

export interface LocationOption {
  id: string;
  name: string;
  type: LocationKind;
  city?: string | null;
  state?: string | null;
}

interface LocationSwitcherProps {
  organizationId: string;
  locations: LocationOption[];
  selectedId: string;
  allowAll?: boolean;
}

const TYPE_ICON: Record<LocationKind, React.ElementType> = {
  STORE: ShoppingBag,
  DC: Building2,
  HYBRID: Sparkles,
  WAREHOUSE: Warehouse,
  DARK_STORE: Moon,
};

export function LocationSwitcher({
  organizationId,
  locations,
  selectedId,
  allowAll = true,
}: LocationSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (locations.length === 0) return null;

  const isAll = selectedId === ALL_LOCATIONS;
  const selected = locations.find((l) => l.id === selectedId);
  const SelectedIcon = isAll ? Globe2 : selected ? TYPE_ICON[selected.type] : Store;
  const label = isAll ? "Todas as unidades" : (selected?.name ?? "Selecionar unidade");

  // Single-location org: render static badge, no dropdown.
  if (locations.length === 1 && !allowAll) {
    const only = locations[0];
    if (!only) return null;
    const Icon = TYPE_ICON[only.type];
    return (
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground shadow-xs",
        )}
        title={only.name}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Icon className="h-3 w-3" />
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{only.name}</span>
      </div>
    );
  }

  function choose(id: string) {
    setOpen(false);
    if (id === selectedId) return;
    startTransition(async () => {
      const res = await setSelectedLocationAction(organizationId, id);
      if (res.success) router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={pending}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground shadow-xs",
          "transition-colors duration-150 hover:bg-surface-1 hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isAll && "border-accent/40 bg-accent-soft/30",
          pending && "opacity-60",
        )}
        aria-label="Trocar unidade"
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md",
            isAll ? "bg-accent text-accent-foreground" : "bg-accent-soft text-accent",
          )}
        >
          <SelectedIcon className="h-3 w-3" />
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[280px] rounded-xl border-border bg-popover p-1.5 shadow-lg"
      >
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle px-2 pt-1 pb-1">
          Unidade ativa
        </DropdownMenuLabel>

        {allowAll && locations.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => choose(ALL_LOCATIONS)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors",
                "hover:bg-surface-1",
                isAll && "bg-accent-soft/40",
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Globe2 className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate font-semibold">Todas as unidades</p>
                <p className="text-[11px] text-muted-foreground">Visão consolidada</p>
              </div>
              {isAll && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle px-2">
              Trocar para
            </DropdownMenuLabel>
          </>
        )}

        <div className="max-h-[280px] overflow-y-auto">
          {locations.map((loc) => {
            const Icon = TYPE_ICON[loc.type];
            const active = loc.id === selectedId;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => choose(loc.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors",
                  "hover:bg-surface-1",
                  active && "bg-surface-1",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate font-medium">{loc.name}</p>
                  {(loc.city || loc.state) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[loc.city, loc.state].filter(Boolean).join(" / ")}
                    </p>
                  )}
                </div>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-md text-[13px]">
          <Link href="/app/locations/new">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            Nova unidade
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-md text-[13px]">
          <Link href="/app/locations">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            Gerenciar unidades
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
