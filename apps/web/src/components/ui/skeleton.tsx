import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

export function SkeletonRow({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: count }, (_, i) => `skeleton-row-${i + 1}`).map((key) => (
        <Skeleton key={key} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
