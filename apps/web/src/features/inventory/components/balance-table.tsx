"use client";

import { AlertTriangle, CalendarClock, PackageX, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { updateMinQuantityAction } from "../actions/inventory-actions";

type BalanceRow = {
  id: string;
  productId: string;
  variantId: string | null;
  locationId: string;
  lotId: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  averageCost: number | null;
  minQuantity: number | null;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    isActive: boolean;
    productType: string;
  };
  variant: { id: string; name: string } | null;
  location: { id: string; name: string };
  lot: { id: string; code: string; expiryDate: Date | null } | null;
};

type Props = {
  rows: BalanceRow[];
  organizationId: string;
};

type StatusKey = "all" | "low" | "expiring" | "out";

const EXPIRY_WINDOW = 30 * 24 * 60 * 60 * 1000;

function rowFlags(row: BalanceRow) {
  const isOut = row.quantityOnHand <= 0;
  const isBelowMin = !isOut && row.minQuantity !== null && row.quantityOnHand <= row.minQuantity;
  const isExpiring =
    !!row.lot?.expiryDate && new Date(row.lot.expiryDate) <= new Date(Date.now() + EXPIRY_WINDOW);
  return { isOut, isBelowMin, isExpiring };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function BalanceTable({ rows, organizationId }: Props) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [editRow, setEditRow] = useState<BalanceRow | null>(null);
  const [minQtyValue, setMinQtyValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const locations = useMemo(
    () =>
      Array.from(new Map(rows.map((r) => [r.location.id, r.location.name])).entries()).map(
        ([id, name]) => ({ id, name }),
      ),
    [rows],
  );

  // Status counts across the location-scoped set (independent of search / status chip)
  const counts = useMemo(() => {
    const base = rows.filter((r) => locationFilter === "all" || r.location.id === locationFilter);
    let low = 0;
    let expiring = 0;
    let out = 0;
    for (const r of base) {
      const f = rowFlags(r);
      if (f.isOut) out++;
      if (f.isBelowMin) low++;
      if (f.isExpiring) expiring++;
    }
    return { all: base.length, low, expiring, out };
  }, [rows, locationFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (locationFilter !== "all" && r.location.id !== locationFilter) return false;
      if (statusFilter !== "all") {
        const f = rowFlags(r);
        if (statusFilter === "low" && !f.isBelowMin) return false;
        if (statusFilter === "expiring" && !f.isExpiring) return false;
        if (statusFilter === "out" && !f.isOut) return false;
      }
      if (q) {
        return (
          r.product.name.toLowerCase().includes(q) ||
          r.product.sku.toLowerCase().includes(q) ||
          (r.variant?.name ?? "").toLowerCase().includes(q) ||
          (r.lot?.code ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, locationFilter, statusFilter]);

  function openEdit(row: BalanceRow) {
    setEditRow(row);
    setMinQtyValue(row.minQuantity?.toString() ?? "");
    setErrorMsg(null);
  }

  function handleSaveThreshold() {
    if (!editRow) return;
    setErrorMsg(null);
    startTransition(async () => {
      const val = minQtyValue.trim() === "" ? null : parseFloat(minQtyValue);
      if (val !== null && Number.isNaN(val)) {
        setErrorMsg("Valor inválido");
        return;
      }
      const res = await updateMinQuantityAction(organizationId, {
        locationId: editRow.locationId,
        productId: editRow.productId,
        variantId: editRow.variantId ?? undefined,
        minQuantity: val,
      });
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setEditRow(null);
      }
    });
  }

  const chips: { key: StatusKey; label: string; count: number; tone: string }[] = [
    {
      key: "all",
      label: "Todos",
      count: counts.all,
      tone: "data-[on=true]:bg-primary-soft data-[on=true]:text-primary-soft-foreground data-[on=true]:border-primary/25",
    },
    {
      key: "low",
      label: "Baixo",
      count: counts.low,
      tone: "data-[on=true]:bg-warning-soft data-[on=true]:text-warning data-[on=true]:border-warning/30",
    },
    {
      key: "expiring",
      label: "Vencendo",
      count: counts.expiring,
      tone: "data-[on=true]:bg-destructive-soft data-[on=true]:text-destructive data-[on=true]:border-destructive/25",
    },
    {
      key: "out",
      label: "Esgotado",
      count: counts.out,
      tone: "data-[on=true]:bg-surface-2 data-[on=true]:text-foreground data-[on=true]:border-border-strong",
    },
  ];

  const hasFilters = search.trim() !== "" || statusFilter !== "all" || locationFilter !== "all";

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, SKU ou lote…"
              className="h-9 pl-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {locations.length > 1 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-ring/30"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="all">Todos os locais</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setLocationFilter("all");
              }}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        {/* Status segmented chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              data-on={statusFilter === c.key}
              onClick={() => setStatusFilter(c.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-surface-1",
                c.tone,
              )}
            >
              {c.label}
              <span className="rounded-full bg-surface-2/80 px-1.5 py-px text-[10.5px] font-semibold tabular-nums text-foreground/70 data-[on=true]:bg-background/50">
                {c.count}
              </span>
            </button>
          ))}
          <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "item" : "itens"}
          </span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Local</TableHead>
            <TableHead className="text-right">Físico</TableHead>
            <TableHead className="text-right">Reservado</TableHead>
            <TableHead className="min-w-44">Disponível</TableHead>
            <TableHead className="text-right">Custo médio</TableHead>
            <TableHead className="text-right">Mínimo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty
              icon={<Search className="h-5 w-5" />}
              title="Nenhum item encontrado"
              description="Ajuste a busca ou os filtros de status para ver outros saldos."
            />
          ) : (
            filtered.map((row) => {
              const { isOut, isBelowMin, isExpiring } = rowFlags(row);
              const onHand = row.quantityOnHand;
              const availPct =
                onHand > 0 ? Math.max(0, Math.min(100, (row.quantityAvailable / onHand) * 100)) : 0;
              const resPct =
                onHand > 0 ? Math.max(0, Math.min(100, (row.quantityReserved / onHand) * 100)) : 0;

              return (
                <TableRow key={row.id} className="group">
                  {/* Produto */}
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1 h-7 w-1 shrink-0 rounded-full",
                          isOut
                            ? "bg-border-strong"
                            : isBelowMin
                              ? "bg-warning"
                              : isExpiring
                                ? "bg-destructive"
                                : "bg-success/70",
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium leading-tight">
                          {row.product.name}
                          {row.variant && (
                            <span className="font-normal text-muted-foreground">
                              {" · "}
                              {row.variant.name}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <span className="font-mono">{row.product.sku}</span>
                          <span className="text-border-strong">·</span>
                          <span>{row.product.unit}</span>
                          {row.lot && (
                            <>
                              <span className="text-border-strong">·</span>
                              <span className="font-mono">lote {row.lot.code}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Local */}
                  <TableCell>
                    <span className="text-[13px] text-muted-foreground">{row.location.name}</span>
                  </TableCell>

                  {/* Físico */}
                  <TableCell className="text-right">
                    <span className="font-mono text-[13px] tabular-nums">{fmt(onHand)}</span>
                  </TableCell>

                  {/* Reservado */}
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-mono text-[13px] tabular-nums",
                        row.quantityReserved > 0 ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {row.quantityReserved > 0 ? fmt(row.quantityReserved) : "—"}
                    </span>
                  </TableCell>

                  {/* Disponível + bar */}
                  <TableCell>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {isBelowMin && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                        )}
                        <span
                          className={cn(
                            "font-mono text-[13px] font-semibold tabular-nums",
                            isOut
                              ? "text-muted-foreground"
                              : isBelowMin
                                ? "text-warning"
                                : "text-success",
                          )}
                        >
                          {fmt(row.quantityAvailable)}
                        </span>
                      </div>
                      <div
                        className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
                        title={`Disponível ${fmt(row.quantityAvailable)} · Reservado ${fmt(row.quantityReserved)}`}
                      >
                        <div
                          className={cn("h-full", isBelowMin ? "bg-warning" : "bg-success")}
                          style={{ width: `${availPct}%` }}
                        />
                        <div className="h-full bg-warning/40" style={{ width: `${resPct}%` }} />
                      </div>
                    </div>
                  </TableCell>

                  {/* Custo médio */}
                  <TableCell className="text-right">
                    {row.averageCost !== null ? (
                      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                        {row.averageCost.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Mínimo */}
                  <TableCell className="text-right">
                    {row.minQuantity !== null ? (
                      <span className="font-mono text-[12px] tabular-nums">
                        {fmt(row.minQuantity)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {isOut ? (
                      <Badge variant="outline" className="gap-1">
                        <PackageX className="h-3 w-3" />
                        Esgotado
                      </Badge>
                    ) : isBelowMin ? (
                      <Badge variant="warning" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Baixo
                      </Badge>
                    ) : isExpiring ? (
                      <Badge variant="destructive" className="gap-1">
                        <CalendarClock className="h-3 w-3" />
                        Vencendo
                      </Badge>
                    ) : (
                      <Badge variant="success" dotColor="success">
                        OK
                      </Badge>
                    )}
                  </TableCell>

                  {/* Action */}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => openEdit(row)}
                      title="Definir estoque mínimo"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* ── Min qty dialog ──────────────────────────────────────── */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Estoque mínimo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {editRow && (
              <div className="rounded-lg border border-border bg-surface-1/50 px-3 py-2.5">
                <p className="text-[13px] font-medium">{editRow.product.name}</p>
                <p className="text-[12px] text-muted-foreground">{editRow.location.name}</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-qty">Quantidade mínima</Label>
              <Input
                id="min-qty"
                type="number"
                min="0"
                step="0.001"
                value={minQtyValue}
                onChange={(e) => setMinQtyValue(e.target.value)}
                placeholder="ex: 10"
                autoFocus
              />
              <p className="text-[11.5px] text-muted-foreground">
                Deixe vazio para remover o alerta de estoque baixo.
              </p>
            </div>
            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditRow(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveThreshold} disabled={isPending}>
                {isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
