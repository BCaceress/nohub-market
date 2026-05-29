"use client";

import { AlertTriangle, Search, SlidersHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function BalanceTable({ rows, organizationId }: Props) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [editRow, setEditRow] = useState<BalanceRow | null>(null);
  const [minQtyValue, setMinQtyValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const locations = Array.from(
    new Map(rows.map((r) => [r.location.id, r.location.name])).entries(),
  ).map(([id, name]) => ({ id, name }));

  const filtered = rows.filter((r) => {
    if (locationFilter !== "all" && r.location.id !== locationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q) ||
        (r.variant?.name ?? "").toLowerCase().includes(q) ||
        (r.lot?.code ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

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

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar produto, SKU, lote…"
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {locations.length > 1 && (
          <select
            className="h-8 rounded-md border border-input bg-background px-3 text-sm"
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
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "item" : "itens"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Produto</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Físico</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">Custo médio</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum item encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const isBelowMin =
                  row.minQuantity !== null && row.quantityOnHand <= row.minQuantity;
                const isExpiring =
                  row.lot?.expiryDate &&
                  new Date(row.lot.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                return (
                  <TableRow
                    key={row.id}
                    className={isBelowMin ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {row.product.name}
                          {row.variant && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              · {row.variant.name}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.product.sku} · {row.product.unit}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{row.location.name}</span>
                    </TableCell>
                    <TableCell>
                      {row.lot ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono">{row.lot.code}</span>
                          {isExpiring && (
                            <Badge variant="destructive" className="text-[10px] py-0">
                              Vencendo
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm">
                        {row.quantityOnHand.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm text-amber-600">
                        {row.quantityReserved.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isBelowMin && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <span
                          className={`font-mono text-sm font-medium ${isBelowMin ? "text-amber-600" : "text-green-600 dark:text-green-400"}`}
                        >
                          {row.quantityAvailable.toLocaleString("pt-BR", {
                            maximumFractionDigits: 3,
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.averageCost !== null ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.averageCost.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.minQuantity !== null ? (
                        <span className="font-mono text-xs">
                          {row.minQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
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
      </div>

      {/* Min qty dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Estoque mínimo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {editRow && (
              <p className="text-sm text-muted-foreground">
                {editRow.product.name} — {editRow.location.name}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-qty">Quantidade mínima (deixe vazio para remover)</Label>
              <Input
                id="min-qty"
                type="number"
                min="0"
                step="0.001"
                value={minQtyValue}
                onChange={(e) => setMinQtyValue(e.target.value)}
                placeholder="ex: 10"
              />
            </div>
            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
            <div className="flex gap-2 justify-end">
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
