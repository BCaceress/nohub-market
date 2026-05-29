import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "link" | "destructive" | "soft";

type Size = "default" | "sm" | "lg" | "xl" | "icon" | "icon-sm" | "icon-lg";

const variants: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] active:scale-[0.98]",
  secondary:
    "bg-secondary text-secondary-foreground shadow-xs hover:bg-[var(--surface-2)] active:scale-[0.98]",
  outline:
    "border border-border bg-card text-foreground shadow-xs hover:bg-surface-1 hover:border-border-strong active:scale-[0.98]",
  ghost: "text-foreground hover:bg-surface-1 active:bg-surface-2 active:scale-[0.98]",
  link: "text-primary underline-offset-4 hover:underline h-auto p-0 shadow-none",
  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
  soft: "bg-primary-soft text-primary-soft-foreground hover:bg-[color-mix(in_srgb,var(--primary-soft)_70%,var(--primary)_8%)] active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-5 text-sm",
  xl: "h-14 px-7 text-base touch-target",
  icon: "h-10 w-10 p-0",
  "icon-sm": "h-8 w-8 p-0",
  "icon-lg": "h-12 w-12 p-0 touch-target",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium tracking-tight",
        "transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
