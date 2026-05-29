"use client";

import { type HTMLAttributes, type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimalist CSS-driven tooltip. No portal, no Radix.
 * Wrap any element to add a hover tooltip.
 */
export function Tooltip({
  label,
  side = "bottom",
  shortcut,
  delay = 200,
  className,
  children,
  ...props
}: {
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  shortcut?: ReactNode;
  delay?: number;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  const [open, setOpen] = useState(false);
  const id = useId();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onEnter = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => setOpen(true), delay);
  };
  const onLeave = () => {
    if (timer) clearTimeout(timer);
    setOpen(false);
  };

  const pos: Record<typeof side, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper de tooltip — eventos hover/focus apenas mostram a dica; a interatividade real fica nos filhos
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      aria-describedby={open ? id : undefined}
      {...props}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-md animate-in-up",
            pos[side],
          )}
        >
          {label}
          {shortcut && <span className="font-mono text-[10px] opacity-70">{shortcut}</span>}
        </span>
      )}
    </span>
  );
}
