"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReceiveStockDialog } from "@/features/inventory/receive-stock-dialog";
import { TransferDialog } from "@/features/inventory/transfer-dialog";
import { ArrowDownToLine, ArrowLeftRight } from "lucide-react";

type Location = { id: string; name: string };
type Product = { id: string; name: string; unit: string };

interface Props {
  organizationId: string;
  locations: Location[];
  products: Product[];
}

export function InventoryDashboardClient({ organizationId, locations, products }: Props) {
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  if (locations.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight className="h-4 w-4" />
          Transferir
        </Button>
        <Button onClick={() => setReceiveOpen(true)}>
          <ArrowDownToLine className="h-4 w-4" />
          Registrar entrada
        </Button>
      </div>

      {receiveOpen && (
        <ReceiveStockDialog
          open={receiveOpen}
          onClose={() => setReceiveOpen(false)}
          organizationId={organizationId}
          location={locations[0]!}
          products={products}
        />
      )}

      {transferOpen && (
        <TransferDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          organizationId={organizationId}
          locations={locations}
          products={products}
        />
      )}
    </>
  );
}
