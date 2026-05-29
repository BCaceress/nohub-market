import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "soft"
  | "dot";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive-soft text-destructive border border-destructive/15",
  outline: "border border-border text-muted-foreground bg-card",
  success: "bg-success-soft text-success border border-success/15",
  warning: "bg-warning-soft text-warning border border-warning/20",
  info: "bg-info-soft text-info border border-info/15",
  soft: "bg-primary-soft text-primary-soft-foreground border border-primary/15",
  dot: "bg-card text-foreground border border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  /** Show colored dot before label */
  dotColor?: "primary" | "success" | "warning" | "destructive" | "info" | "muted";
}

const DOT: Record<NonNullable<BadgeProps["dotColor"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
};

export function Badge({
  className,
  variant = "default",
  dotColor,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    >
      {dotColor && (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[dotColor])} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
