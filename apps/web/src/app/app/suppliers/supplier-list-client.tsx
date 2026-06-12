"use client";

import { formatCNPJ } from "@nohub/shared/brazilian";
import {
  MapPin,
  MoreVertical,
  Package,
  Phone,
  Power,
  PowerOff,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteSupplierAction,
  toggleSupplierActiveAction,
} from "@/features/app/actions/supplier-actions";

type Supplier = {
  id: string;
  name: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  contactName: string | null;
  addressCity: string | null;
  addressState: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  _count: { purchaseOrders: number; supplierProductMappings: number };
};

interface Props {
  organizationId: string;
  suppliers: Supplier[];
}

export function SupplierListClient({ organizationId, suppliers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Supplier | null>(null);

  const handleToggleActive = (supplier: Supplier) => {
    const isActive = !supplier.deletedAt;
    if (!isActive) {
      startTransition(async () => {
        const result = await toggleSupplierActiveAction(organizationId, supplier.id, true);
        if (result.success) {
          toast.success("Fornecedor reativado");
        } else {
          toast.error(result.error || "Erro ao reativar fornecedor");
        }
      });
    } else {
      setConfirmDeactivate(supplier);
    }
  };

  const handleConfirmDeactivate = () => {
    if (!confirmDeactivate) return;
    startTransition(async () => {
      const result = await toggleSupplierActiveAction(organizationId, confirmDeactivate.id, false);
      if (result.success) {
        toast.success("Fornecedor inativado");
        setConfirmDeactivate(null);
      } else {
        toast.error(result.error || "Erro ao inativar fornecedor");
      }
    });
  };

  const handleDelete = (supplier: Supplier) => {
    setConfirmDelete(supplier);
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    startTransition(async () => {
      const result = await deleteSupplierAction(organizationId, confirmDelete.id);
      if (result.success) {
        toast.success("Fornecedor deletado");
        setConfirmDelete(null);
      } else {
        toast.error(result.error || "Erro ao deletar fornecedor");
      }
    });
  };

  return (
    <>
      <div className="rounded-xl border divide-y">
        {suppliers.map((supplier) => {
          const isActive = !supplier.deletedAt;
          return (
            <div
              key={supplier.id}
              className="flex items-center gap-4 px-4 py-4 hover:bg-muted/40 transition-colors group"
            >
              {/* Status indicator + Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary relative">
                <Package className="h-4 w-4" />
                <span
                  className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ${
                    isActive ? "bg-emerald-500 ring-emerald-500/20" : "bg-rose-500 ring-rose-500/20"
                  }`}
                  title={isActive ? "Ativo" : "Inativo"}
                />
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/app/suppliers/${supplier.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {supplier.name}
                  </Link>
                  {supplier.tradeName && supplier.tradeName !== supplier.name && (
                    <span className="text-xs text-muted-foreground">· {supplier.tradeName}</span>
                  )}
                  {supplier.segment && (
                    <Badge variant="outline" className="text-[10px]">
                      {supplier.segment}
                    </Badge>
                  )}
                </div>

                {/* Secondary info */}
                <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                  {supplier.document && <span>{formatCNPJ(supplier.document)}</span>}
                  {supplier.contactName && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[9px]">👤</span>
                      {supplier.contactName}
                    </span>
                  )}
                  {supplier.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {supplier.phone}
                    </span>
                  )}
                  {supplier.email && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <span className="text-[9px]">✉</span>
                      <a
                        href={`mailto:${supplier.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {supplier.email}
                      </a>
                    </span>
                  )}
                  {(supplier.addressCity || supplier.addressState) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[supplier.addressCity, supplier.addressState].filter(Boolean).join(" — ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats - hidden on mobile */}
              <div className="hidden sm:flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  <span>
                    {supplier._count.supplierProductMappings} produto
                    {supplier._count.supplierProductMappings !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>
                    {supplier._count.purchaseOrders} pedido
                    {supplier._count.purchaseOrders !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Ações"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-45 rounded-lg border-border bg-popover p-1 shadow-lg"
                >
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md text-[13px]">
                    <Link href={`/app/suppliers/${supplier.id}`}>
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      Ver detalhes
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[13px]"
                    onSelect={() => handleToggleActive(supplier)}
                    disabled={isPending}
                  >
                    {isActive ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                        Inativar
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5 text-muted-foreground" />
                        Ativar
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-1 my-1" />
                  <DropdownMenuItem
                    className="cursor-pointer rounded-md text-[13px] text-destructive focus:text-destructive"
                    onSelect={() => handleDelete(supplier)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Deletar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {/* Confirm deactivate dialog */}
      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar fornecedor?</DialogTitle>
            <DialogDescription>
              O fornecedor "{confirmDeactivate?.name}" será inativado. Você poderá reativá-lo
              depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivate(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeactivate} disabled={isPending}>
              Inativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deletar fornecedor?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O fornecedor "{confirmDelete?.name}" será
              permanentemente removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isPending}>
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
