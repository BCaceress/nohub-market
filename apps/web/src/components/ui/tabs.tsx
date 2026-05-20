"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/* ── Context ────────────────────────────────────────────────── */

const TabsCtx = createContext<{
  value: string;
  onValueChange: (v: string) => void;
}>({ value: "", onValueChange: () => {} });

/* ── Root ───────────────────────────────────────────────────── */

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </TabsCtx.Provider>
  );
}

/* ── List (tab bar) ─────────────────────────────────────────── */

export function TabsList({
  className,
  variant = "underline",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "underline" | "pills";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        variant === "underline" && "flex gap-0 border-b border-border",
        variant === "pills" && "flex gap-1 rounded-lg bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

/* ── Trigger ────────────────────────────────────────────────── */

export function TabsTrigger({
  value,
  children,
  className,
  variant = "underline",
  icon,
  badge,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  variant?: "underline" | "pills";
  icon?: React.ReactNode;
  badge?: number | string;
}) {
  const { value: active, onValueChange } = useContext(TabsCtx);
  const isActive = active === value;

  if (variant === "pills") {
    return (
      <button
        role="tab"
        type="button"
        aria-selected={isActive}
        onClick={() => onValueChange(value)}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          isActive
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {icon}
        {children}
        {badge !== undefined && (
          <span
            className={cn(
              "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/20 text-muted-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={() => onValueChange(value)}
      className={cn(
        "relative flex items-center gap-2 border-b-2 px-4 py-2.5 -mb-px text-sm font-medium transition-colors",
        isActive
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
        className,
      )}
    >
      {icon}
      {children}
      {badge !== undefined && (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── Content ────────────────────────────────────────────────── */

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: active } = useContext(TabsCtx);
  if (active !== value) return null;
  return <div className={cn("mt-0", className)}>{children}</div>;
}
