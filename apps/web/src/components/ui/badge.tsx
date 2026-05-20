import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";

const variants: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground",
  secondary:
    "bg-secondary text-secondary-foreground",
  destructive:
    "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60",
  outline:
    "border border-border text-muted-foreground bg-transparent",
  success:
    "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/60",
  warning:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60",
  info:
    "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
