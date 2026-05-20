import { cn } from "@/lib/utils";

/* Wrapper — adds overflow, border and rounded corners */
export function Table({
  className,
  containerClassName,
  ...props
}: React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", containerClassName)}>
      <div className="overflow-x-auto">
        <table className={cn("w-full text-sm", className)} {...props} />
      </div>
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-border bg-muted/40", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...props} />
  );
}

export function TableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn("border-t border-border bg-muted/40 font-medium", className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/30 data-[selected=true]:bg-accent/5",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 align-middle text-sm",
        "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn("py-4 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export function TableEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={99}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {icon && (
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              {icon}
            </div>
          )}
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </td>
    </tr>
  );
}
