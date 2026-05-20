"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiveStockDialog } from "@/features/inventory/receive-stock-dialog";
import { TransferDialog } from "@/features/inventory/transfer-dialog";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Search,
  Package,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";

type Product = { id: string; name: string; unit: string };

type StockEntry = {
  id: string;
  quantity: number | string;
  minQuantity: number | string | null;
  maxQuantity: number | string | null;
  expiryDate: Date | string | null;
  batchCode: string | null;
  shelfLocation: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    unit: string;
    category: string | null;
    price: number | string;
    costPrice: number | string | null;
    imageUrl: string | null;
    active: boolean;
  };
};

interface Props {
  organizationId: string;
  location: { id: string; name: string };
  allLocations: { id: string; name: string }[];
  entries: StockEntry[];
  products: Product[];
}

export function UnitStockClient({
  organizationId,
  location,
  allLocations,
  entries,
  products,
}: Props) {
  const [search, setSearch] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [showLowOnly, setShowLowOnly] = useState(false);

  const filtered = entries.filter((e) => {
    const matchSearch =
      !search ||
      e.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.product.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.product.barcode ?? "").includes(search);
    const matchLow =
      !showLowOnly ||
      (e.minQuantity !== null && Number(e.quantity) <= Number(e.minQuantity));
    return matchSearch && matchLow;
  });

  function handleReceive(entry?: StockEntry) {
    setSelectedProduct(entry ? { id: entry.product.id, name: entry.product.name, unit: entry.product.unit } : undefined);
    setReceiveOpen(true);
  }

  function handleTransfer(entry?: StockEntry) {
    setSelectedProduct(entry ? { id: entry.product.id, name: entry.product.name, unit: entry.product.unit } : undefined);
    setTransferOpen(true);
  }

  const isExpiringSoon = (date: Date | string | null) => {
    if (!date) return false;
    return new Date(date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  };

  const isLowStock = (entry: StockEntry) =>
    entry.minQuantity !== null && Number(entry.quantity) <= Number(entry.minQuantity);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar produto, SKU ou código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showLowOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLowOnly((v) => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Estoque baixo
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleTransfer()}>
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transferir
          </Button>
          <Button size="sm" onClick={() => handleReceive()}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Registrar entrada
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Qtd. atual</TableHead>
            <TableHead className="text-right">Mín / Máx</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead>Lote / Posição</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty
              icon={<Package className="h-5 w-5 text-muted-foreground" />}
              title="Nenhum item encontrado"
              description={
                showLowOnly
                  ? "Não há itens com estoque abaixo do mínimo."
                  : "Registre a primeira entrada para começar."
              }
              action={
                !showLowOnly ? (
                  <Button size="sm" onClick={() => handleReceive()}>
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Registrar entrada
                  </Button>
                ) : undefined
              }
            />
          ) : (
            filtered.map((entry) => {
              const low = isLowStock(entry);
              const exp = isExpiringSoon(entry.expiryDate);
              return (
                <TableRow key={entry.id} data-selected={low ? "true" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {low && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm leading-snug">{entry.product.name}</p>
                        {entry.product.sku && (
                          <p className="text-xs text-muted-foreground">SKU {entry.product.sku}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.product.category ? (
                      <Badge variant="secondary">{entry.product.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono text-sm font-semibold ${
                        low ? "text-amber-600 dark:text-amber-400" : ""
                      }`}
                    >
                      {Number(entry.quantity).toLocaleString("pt-BR", {
                        maximumFractionDigits: 3,
                      })}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {entry.product.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {entry.minQuantity !== null
                      ? Number(entry.minQuantity).toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })
                      : "—"}
                    {" / "}
                    {entry.maxQuantity !== null
                      ? Number(entry.maxQuantity).toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {entry.expiryDate ? (
                      <div className="flex items-center gap-1.5">
                        {exp && <CalendarClock className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <span className={`text-xs ${exp ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                          {new Date(entry.expiryDate).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.batchCode && <span className="block">Lote: {entry.batchCode}</span>}
                    {entry.shelfLocation && <span className="block">{entry.shelfLocation}</span>}
                    {!entry.batchCode && !entry.shelfLocation && "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleReceive(entry)}
                      >
                        Entrada
                      </Button>
                      {allLocations.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleTransfer(entry)}
                        >
                          Transferir
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Dialogs */}
      {receiveOpen && (
        <ReceiveStockDialog
          open={receiveOpen}
          onClose={() => {
            setReceiveOpen(false);
            setSelectedProduct(undefined);
          }}
          organizationId={organizationId}
          location={location}
          product={selectedProduct}
          products={products}
        />
      )}
      {transferOpen && (
        <TransferDialog
          open={transferOpen}
          onClose={() => {
            setTransferOpen(false);
            setSelectedProduct(undefined);
          }}
          organizationId={organizationId}
          locations={allLocations}
          products={products}
          defaultFromLocationId={location.id}
          defaultProductId={selectedProduct?.id}
        />
      )}
    </>
  );
}
