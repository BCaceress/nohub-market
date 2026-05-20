import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // Layout
        "flex h-10 w-full rounded-lg px-3.5 py-2",
        // Colors
        "border border-input bg-card text-sm text-foreground",
        // Placeholder
        "placeholder:text-muted-foreground/60",
        // Shadow & transition
        "shadow-xs transition-[border-color,box-shadow] duration-150",
        // Focus
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        // File input reset
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
