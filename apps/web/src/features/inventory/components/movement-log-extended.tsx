"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Trash2,
  ClipboardList,
  LockKeyhole,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Movement = {
  id: string;
  type: string;
  quantity: number;
  previousQty: number;
  newQty: number;
  unitCost: number | null;
  reason: string | null;
  note: string | null;
  actorName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date | string;
  product: { id: string; name: string; unit: string };
  variant: { id: string; name: string } | null;
  location: { id: string; name: string };
  lot: { id: string; code: string; expiryDate: Date | null } | null;
};

type Location = { id: string; name: string };

const TYPE_CONFIG: Record<
  string,
  { label: string; variant: "success" | "destructive" | "info" | "warning" | "secondary"; icon: React.ReactNode }
> = {
  INBOUND:            { label: "Entrada",        variant: "success",     icon: <ArrowDownToLine className="h-3 w-3" /> },
  IN:                 { label: "Entrada",        variant: "success",     icon: <ArrowDownToLine className="h-3 w-3" /> },
  OUTBOUND:           { label: "Saída",          variant: "secondary",   icon: <ArrowUpFromLine className="h-3 w-3" /> },
  OUT:                { label: "Saída",          variant: "secondary",   icon: <ArrowUpFromLine className="h-3 w-3" /> },
  LOSS:               { label: "Perda",          variant: "destructive", icon: <Trash2 className="h-3 w-3" /> },
  TRANSFER_IN:        { label: "Transf. entrada",variant: "info",        icon: <ArrowLeftRight className="h-3 w-3" /> },
  TRANSFER_OUT:       { label: "Transf. saída",  variant: "info",        icon: <ArrowLeftRight className="h-3 w-3" /> },
  ADJUSTMENT:         { label: "Ajuste",         variant: "warning",     icon: <ClipboardList className="h-3 w-3" /> },
  RESERVATION:        { label: "Reserva",        variant: "warning",     icon: <LockKeyhole className="h-3 w-3" /> },
  RESERVATION_RELEASE:{ label: "Lib. reserva",   variant: "secondary",   icon: <LockKeyhole className="h-3 w-3" /> },
};

const REASON_LABELS: Record<string, string> = {
  PURCHASE:        "Compra",
  SALE:            "Venda",
  INVENTORY_COUNT: "Inventário",
  DAMAGE:          "Avaria",
  EXPIRY:          "Vencimento",
  THEFT:           "Furto",
  TRANSFER:        "Transferência",
  MANUAL:          "Manual",
  RETURN:          "Devolução",
  INITIAL:         "Saldo inicial",
};

const MOVEMENT_TYPES = [
  { value: "",                  label: "Todos os tipos"   },
  { value: "INBOUND",           label: "Entradas"         },
  { value: "OUTBOUND",          label: "Saídas"           },
  { value: "LOSS",              label: "Perdas"           },
  { value: "TRANSFER_IN",       label: "Transf. recebidas"},
  { value: "TRANSFER_OUT",      label: "Transf. enviadas" },
  { value: "ADJUSTMENT",        label: "Ajustes"          },
  { value: "RESERVATION",       label: "Reservas"         },
];

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return "há poucos segundos";
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

type Props = {
  movements: Movement[];
  locations: Location[];
  total: number;
  page: number;
  take: number;
};

export function MovementLogExtended({ movements, locations, total, page, take }: Props) {
  const router  = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    value ? p.set(key, value) : p.delete(key);
    p.delete("page");
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  }

  function goPage(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  const totalPages = Math.ceil(total / take);

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={searchParams.get("locationId") ?? ""}
          onChange={(e) => updateParam("locationId", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os locais</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <select
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm"
        >
          {MOVEMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-muted-foreground">
          {total} movimentaç{total !== 1 ? "ões" : "ão"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Ant → Nov</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Obs</TableHead>
              <TableHead>Por</TableHead>
              <TableHead>Quando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TrendingDown className="h-6 w-6 opacity-40" />
                    <p className="text-sm">Nenhuma movimentação encontrada.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => {
                const cfg = TYPE_CONFIG[m.type] ?? { label: m.type, variant: "secondary" as const, icon: null };
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{m.product.name}</p>
                        {m.variant && (
                          <p className="text-xs text-muted-foreground">{m.variant.name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.location.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.reason ? (REASON_LABELS[m.reason] ?? m.reason) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {m.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                      {" "}<span className="text-xs text-muted-foreground">{m.product.unit}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {m.previousQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                      {" → "}
                      {m.newQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {m.lot?.code ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {m.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {m.actorName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(m.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            Próxima
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
