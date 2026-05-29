import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-lg px-3.5 py-2.5",
        "border border-input bg-card text-sm text-foreground",
        "placeholder:text-muted-foreground/60",
        "shadow-xs transition-[border-color,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "resize-none",
        className,
      )}
      {...props}
    />
  );
}
