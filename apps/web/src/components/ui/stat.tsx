import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  iconTone?: "primary" | "success" | "warning" | "destructive" | "info" | "neutral";
  trend?: { value: number; suffix?: string };
  className?: string;
  href?: string;
}

const ICON_TONE: Record<NonNullable<StatProps["iconTone"]>, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-1 text-foreground",
};

/**
 * KPI / metric card.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  iconTone = "neutral",
  trend,
  className,
}: StatProps) {
  const up = trend && trend.value >= 0;
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs",
        "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{label}</p>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              ICON_TONE[iconTone],
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <p className="font-display text-[34px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>

      <div className="flex items-center gap-2 text-[12px]">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              up ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "+" : ""}
            {trend.value}
            {trend.suffix ?? "%"}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>

      {/* Decorative aurora on hover */}
      <span
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(closest-side, rgb(249 115 22 / 0.10), transparent)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
