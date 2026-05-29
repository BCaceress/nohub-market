import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard shortcut chip — Linear-style.
 * Usage: <Kbd>⌘</Kbd> <Kbd>K</Kbd>
 */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-border bg-surface-1 px-1.5",
        "font-mono text-[10px] font-medium text-muted-foreground",
        "shadow-[inset_0_-1px_0_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}
