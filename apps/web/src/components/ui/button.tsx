import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
type Size = "default" | "sm" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/70 active:scale-[0.98]",
  outline:
    "border border-border bg-card shadow-sm hover:bg-secondary hover:text-secondary-foreground active:scale-[0.98]",
  ghost:
    "hover:bg-secondary hover:text-secondary-foreground active:scale-[0.98]",
  link:
    "text-accent underline-offset-4 hover:underline h-auto p-0 shadow-none",
  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90 active:scale-[0.98]",
};

const sizes: Record<Size, string> = {
  default: "h-10 px-4 py-2 text-sm",
  sm:      "h-8 px-3 py-1.5 text-xs",
  lg:      "h-11 px-6 py-2.5 text-sm",
  icon:    "h-9 w-9 p-0",
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
        // Base
        "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium",
        // Transitions
        "transition-all duration-150",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
