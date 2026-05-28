import { cn } from "@/lib/utils";

export function Table({
  className,
  containerClassName,
  ...props
}: React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        containerClassName,
      )}
    >
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
  return <thead className={cn("bg-surface-1/60", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn("border-t border-border bg-surface-1/60 font-medium", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-surface-1/50 data-[selected=true]:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle",
        "border-b border-border first:pl-5 last:pr-5",
        "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-[13.5px] text-foreground first:pl-5 last:pr-5",
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
  return <caption className={cn("py-4 text-xs text-muted-foreground", className)} {...props} />;
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
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          {icon && (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-1 text-muted-foreground ring-1 ring-border">
              {icon}
            </div>
          )}
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && (
            <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
          {action && <div className="mt-5">{action}</div>}
        </div>
      </td>
    </tr>
  );
}
