import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg pl-3.5 pr-9 py-2",
          "border border-input bg-card text-sm text-foreground",
          "shadow-xs transition-[border-color,box-shadow] duration-150",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-1",
          className,
        )}
        {...props}
      />
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
