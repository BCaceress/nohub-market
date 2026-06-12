"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import type { SupplierFull, SupplierInput } from "../actions/supplier-actions";
import { SupplierForm } from "./supplier-form";

interface Props {
  organizationId: string;
  supplier: SupplierFull;
}

export function SupplierEditSheet({ organizationId, supplier }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5 mr-2" />
        Editar fornecedor
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} className="w-full max-w-2xl">
        <SheetHeader
          title="Editar fornecedor"
          description={`Atualize as informações do fornecedor ${supplier.name}`}
          onClose={() => setOpen(false)}
        />
        <SheetBody>
          <SupplierForm
            organizationId={organizationId}
            supplierId={supplier.id}
            initialValues={{
              name: supplier.name,
              tradeName: supplier.tradeName ?? "",
              document: supplier.document ?? "",
              email: supplier.email ?? "",
              phone: supplier.phone ?? "",
              website: supplier.website ?? "",
              contactName: supplier.contactName ?? "",
              segment: supplier.segment ?? "",
              addressStreet: supplier.addressStreet ?? "",
              addressNumber: supplier.addressNumber ?? "",
              addressComplement: supplier.addressComplement ?? "",
              addressDistrict: supplier.addressDistrict ?? "",
              addressCity: supplier.addressCity ?? "",
              addressState: supplier.addressState ?? "",
              addressZip: supplier.addressZip ?? "",
              defaultPaymentTerms:
                supplier.defaultPaymentTerms as SupplierInput["defaultPaymentTerms"],
              defaultLeadTimeDays: supplier.defaultLeadTimeDays ?? undefined,
              minOrderAmount: supplier.minOrderAmount ? Number(supplier.minOrderAmount) : undefined,
              deliveryDays: supplier.deliveryDays as string[] | null,
              defaultDiscountPercent: supplier.defaultDiscountPercent
                ? Number(supplier.defaultDiscountPercent)
                : undefined,
              freightFixedAmount: supplier.freightFixedAmount
                ? Number(supplier.freightFixedAmount)
                : undefined,
              freightFreeAbove: supplier.freightFreeAbove
                ? Number(supplier.freightFreeAbove)
                : undefined,
              freightNotes: supplier.freightNotes ?? "",
              notes: supplier.notes ?? "",
            }}
          />
        </SheetBody>
      </Sheet>
    </>
  );
}
