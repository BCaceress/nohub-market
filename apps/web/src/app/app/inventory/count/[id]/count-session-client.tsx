"use client";

import { AlertTriangle, CheckCircle2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addCountItemAction,
  closeInventoryCountAction,
} from "@/features/inventory/actions/inventory-count-actions";

type CountItem = {
  id: string;
  productId: string;
  variantId: string | null;
  lotId: string | null;
  systemQuantity: number;
  countedQuantity: number | null;
  divergence: number | null;
  adjustmentMovementId: string | null;
  product: { id: string; name: string; sku: string | null; unit: string };
};

type Count = {
  id: string;
  status: string;
  items: CountItem[];
  location: { id: string; name: string };
};

type Props = {
  organizationId: string;
  count: Count;
  isClosed: boolean;
};

export function CountSessionClient({ organizationId, count, isClosed }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editItem, setEditItem] = useState<CountItem | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);

  // Track local overrides to show immediate feedback
  const [localCounted, setLocalCounted] = useState<Record<string, number>>({});

  const items = count.items.map((item) => ({
    ...item,
    countedQuantity: item.id in localCounted ? localCounted[item.id]! : item.countedQuantity,
    divergence:
      item.id in localCounted ? localCounted[item.id]! - item.systemQuantity : item.divergence,
  }));

  const countedCount = items.filter((i) => i.countedQuantity !== null).length;
  const divergentCount = items.filter(
    (i) => i.divergence !== null && Math.abs(i.divergence) >= 0.001,
  ).length;

  function openEdit(item: CountItem) {
    setEditItem(item);
    const current = item.id in localCounted ? localCounted[item.id] : item.countedQuantity;
    setInputValue(current?.toString() ?? "");
    setError(null);
  }

  function handleSaveCount() {
    if (!editItem) return;
    const qty = parseFloat(inputValue);
    if (Number.isNaN(qty) || qty < 0) {
      setError("Valor inválido.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await addCountItemAction(organizationId, count.id, {
        productId: editItem.productId,
        variantId: editItem.variantId ?? undefined,
        lotId: editItem.lotId ?? undefined,
        systemQuantity: editItem.systemQuantity,
        countedQuantity: qty,
      });
      if (!res.success) {
        setError(res.error);
      } else {
        setLocalCounted((prev) => ({ ...prev, [editItem.id]: qty }));
        setEditItem(null);
      }
    });
  }

  function handleClose() {
    setCloseError(null);
    startTransition(async () => {
      const res = await closeInventoryCountAction(organizationId, count.id);
      if (!res.success) {
        setCloseError(res.error);
        setCloseConfirm(false);
      } else {
        setCloseConfirm(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      {/* Progress */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-5 py-4">
        <div className="text-center">
          <p className="text-2xl font-bold">{countedCount}</p>
          <p className="text-xs text-muted-foreground">Contados</p>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-bold">{items.length - countedCount}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="text-center">
          <p
            className={`text-2xl font-bold ${divergentCount > 0 ? "text-amber-600" : "text-green-600 dark:text-green-400"}`}
          >
            {divergentCount}
          </p>
          <p className="text-xs text-muted-foreground">Divergências</p>
        </div>
        {!isClosed && (
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={() => setCloseConfirm(true)}
              disabled={isPending || countedCount === 0}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Encerrar contagem
            </Button>
          </div>
        )}
      </div>

      {closeError && <p className="text-sm text-red-500">{closeError}</p>}

      {/* Items table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Produto</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Sistema</TableHead>
              <TableHead className="text-right">Contado</TableHead>
              <TableHead className="text-right">Divergência</TableHead>
              {!isClosed && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const counted = item.countedQuantity;
              const div = item.divergence;

              return (
                <TableRow
                  key={item.id}
                  className={
                    counted === null
                      ? ""
                      : div !== null && Math.abs(div) >= 0.001
                        ? "bg-amber-50/40 dark:bg-amber-950/10"
                        : "bg-green-50/20 dark:bg-green-950/5"
                  }
                >
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.product.sku} · {item.product.unit}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {item.lotId ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.systemQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {counted !== null ? (
                      <span className="font-mono text-sm font-medium">
                        {counted.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {div !== null ? (
                      <div className="flex items-center justify-end gap-1.5">
                        {Math.abs(div) < 0.001 ? (
                          <Minus className="h-3.5 w-3.5 text-green-500" />
                        ) : div > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <span
                          className={`font-mono text-sm ${
                            Math.abs(div) < 0.001
                              ? "text-muted-foreground"
                              : div > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {div > 0 ? "+" : ""}
                          {div.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {!isClosed && (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEdit(item)}
                        disabled={isPending}
                      >
                        {counted !== null ? "Editar" : "Contar"}
                      </Button>
                    </TableCell>
                  )}
                  {isClosed && item.adjustmentMovementId && (
                    <TableCell>
                      <span title="Ajuste gerado">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar contagem</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium">{editItem.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  Saldo no sistema:{" "}
                  {editItem.systemQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
                  {editItem.product.unit}
                </p>
              </div>
              <Input
                type="number"
                min="0"
                step="0.001"
                placeholder="Quantidade contada"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveCount()}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditItem(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCount} disabled={isPending}>
                  {isPending ? "Salvando…" : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close confirm dialog */}
      <Dialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encerrar contagem?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              O sistema irá gerar ajustes automáticos para os <strong>{divergentCount}</strong>{" "}
              item(ns) com divergência. Esta ação não pode ser desfeita.
            </p>
            {countedCount < items.length && (
              <p className="text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                {items.length - countedCount} item(ns) ainda não foram contados e serão ignorados.
              </p>
            )}
            {closeError && <p className="text-xs text-red-500">{closeError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCloseConfirm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleClose} disabled={isPending}>
                {isPending ? "Encerrando…" : "Confirmar encerramento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
