import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-lg px-3.5 py-2",
          "border border-input bg-card text-sm text-foreground",
          "placeholder:text-muted-foreground/60",
          "shadow-xs transition-[border-color,box-shadow] duration-150",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-1",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "[&[type=number]]:tabular-nums",
          className,
        )}
        {...props}
      />
    );
  },
);
