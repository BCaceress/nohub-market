"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { ImportWizard } from "@/features/catalog/components/import-wizard";
import { Download } from "lucide-react";
import { useState } from "react";

type FiscalTemplate = {
  id: string;
  productName: string;
  suggestedNcm: string;
  suggestedCest: string | null;
  defaultCfopInternal: string | null;
  segment: string;
  barcode: string | null;
};

export function ImportModalButton({
  organizationId,
  templates,
}: {
  organizationId: string;
  templates: FiscalTemplate[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-3.5 w-3.5" />
        Importar
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} className="w-full max-w-[640px]">
        <SheetHeader
          title="Importar produtos"
          description="Arraste uma planilha (.xlsx / .csv) ou escolha um template fiscal."
          onClose={() => setOpen(false)}
        />
        <SheetBody>
          <ImportWizard organizationId={organizationId} templates={templates} />
        </SheetBody>
      </Sheet>
    </>
  );
}
