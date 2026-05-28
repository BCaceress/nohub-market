import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

interface PageHeaderProps {
  backHref?: string;
  backLabel?: string;
  /** Icon element rendered in the colored badge */
  icon?: React.ReactNode;
  /** Icon badge tone */
  iconTone?: "primary" | "neutral" | "success" | "warning" | "info";
  /** Page title */
  title: string;
  /** Subtitle / description */
  description?: string;
  /** Slot rendered on the right side of the header */
  actions?: React.ReactNode;
  /** Extra badges / chips rendered after the title block */
  meta?: React.ReactNode;
  /** Children rendered as a 'tools' row below the header (filters, tabs, etc) */
  children?: React.ReactNode;
}

const TONE: Record<NonNullable<PageHeaderProps["iconTone"]>, string> = {
  primary: "bg-primary-soft text-primary",
  neutral: "bg-surface-1 text-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

/**
 * Standardized page header used across all app pages.
 */
export function PageHeader({
  backHref,
  backLabel,
  icon,
  iconTone = "primary",
  title,
  description,
  actions,
  meta,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel ?? "Voltar"}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon && (
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-border ${TONE[iconTone]}`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-foreground">
                {title}
              </h1>
              {meta}
            </div>
            {description && (
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children}
    </div>
  );
}
