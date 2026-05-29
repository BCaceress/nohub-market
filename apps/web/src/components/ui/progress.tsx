import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
