"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import type { CustomerFull } from "../actions/customer-actions";
import { CustomerForm } from "./customer-form";

interface Props {
  organizationId: string;
  customer: CustomerFull;
}

export function CustomerEditSheet({ organizationId, customer }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5 mr-2" />
        Editar cliente
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} className="w-full max-w-2xl">
        <SheetHeader
          title="Editar cliente"
          description={`Atualize as informações de ${customer.name ?? "cliente"}`}
          onClose={() => setOpen(false)}
        />
        <SheetBody>
          <CustomerForm
            organizationId={organizationId}
            customerId={customer.id}
            onSaved={() => setOpen(false)}
            initialValues={{
              personType: (customer.personType as "PF" | "PJ") ?? "PF",
              name: customer.name ?? "",
              document: customer.document ?? "",
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              whatsapp: customer.whatsapp ?? "",
              contactName: customer.contactName ?? "",
              addressStreet: customer.addressStreet ?? "",
              addressNumber: customer.addressNumber ?? "",
              addressComplement: customer.addressComplement ?? "",
              addressDistrict: customer.addressDistrict ?? "",
              addressCity: customer.addressCity ?? "",
              addressState: customer.addressState ?? "",
              addressZip: customer.addressZip ?? "",
              notes: customer.notes ?? "",
            }}
          />
        </SheetBody>
      </Sheet>
    </>
  );
}
