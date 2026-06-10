"use client";

import { formatCNPJ, formatCPF } from "@nohub/shared/brazilian";
import {
  FileText,
  MapPin,
  MoreVertical,
  Phone,
  Power,
  PowerOff,
  Search,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import {
  deleteCustomerAction,
  toggleCustomerActiveAction,
} from "@/features/app/actions/customer-actions";

type Customer = {
  id: string;
  personType: string;
  name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contactName: string | null;
  addressCity: string | null;
  addressState: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  _count: { orders: number; invoices: number };
};

interface Props {
  organizationId: string;
  customers: Customer[];
}

function formatDoc(personType: string, document: string | null): string | null {
  if (!document) return null;
  return personType === "PJ" ? formatCNPJ(document) : formatCPF(document);
}

export function CustomerListClient({ organizationId, customers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    const digits = q.replace(/\D/g, "");
    return customers.filter((c) => {
      if (c.name?.toLowerCase().includes(q)) return true;
      if (digits && c.document?.includes(digits)) return true;
      if (
        digits &&
        (c.phone?.replace(/\D/g, "").includes(digits) ||
          c.whatsapp?.replace(/\D/g, "").includes(digits))
      )
        return true;
      return false;
    });
  }, [customers, search]);

  const handleToggleActive = (customer: Customer) => {
    const isActive = !customer.deletedAt;
    if (!isActive) {
      startTransition(async () => {
        const result = await toggleCustomerActiveAction(organizationId, customer.id, true);
        if (result.success) toast.success("Cliente reativado");
        else toast.error(result.error || "Erro ao reativar cliente");
      });
    } else {
      setConfirmDeactivate(customer);
    }
  };

  const handleConfirmDeactivate = () => {
    if (!confirmDeactivate) return;
    startTransition(async () => {
      const result = await toggleCustomerActiveAction(organizationId, confirmDeactivate.id, false);
      if (result.success) {
        toast.success("Cliente inativado");
        setConfirmDeactivate(null);
      } else {
        toast.error(result.error || "Erro ao inativar cliente");
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    startTransition(async () => {
      const result = await deleteCustomerAction(organizationId, confirmDelete.id);
      if (result.success) {
        toast.success("Cliente removido");
        setConfirmDelete(null);
      } else {
        toast.error(result.error || "Erro ao remover cliente");
      }
    });
  };

  return (
    <>
      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF/CNPJ ou telefone…"
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border divide-y">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado para “{search}”.
          </div>
        ) : (
          filtered.map((customer) => {
            const isActive = !customer.deletedAt;
            const doc = formatDoc(customer.personType, customer.document);
            return (
              <div
                key={customer.id}
                className="flex items-center gap-4 px-4 py-4 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary relative">
                  <User className="h-4 w-4" />
                  <span
                    className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ${
                      isActive
                        ? "bg-emerald-500 ring-emerald-500/20"
                        : "bg-rose-500 ring-rose-500/20"
                    }`}
                    title={isActive ? "Ativo" : "Inativo"}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/app/customers/${customer.id}`}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {customer.name ?? "Cliente sem nome"}
                    </Link>
                    <Badge variant="outline" className="text-[10px]">
                      {customer.personType === "PJ" ? "PJ" : "PF"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                    {doc && <span>{doc}</span>}
                    {customer.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    )}
                    {customer.email && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <span className="text-[9px]">✉</span>
                        <a
                          href={`mailto:${customer.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {customer.email}
                        </a>
                      </span>
                    )}
                    {(customer.addressCity || customer.addressState) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[customer.addressCity, customer.addressState].filter(Boolean).join(" — ")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-6 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span>
                      {customer._count.orders} pedido{customer._count.orders !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>
                      {customer._count.invoices} nota{customer._count.invoices !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

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
                      <Link href={`/app/customers/${customer.id}`}>
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        Ver detalhes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer rounded-md text-[13px]"
                      onSelect={() => handleToggleActive(customer)}
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
                      onSelect={() => setConfirmDelete(customer)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar cliente?</DialogTitle>
            <DialogDescription>
              O cliente “{confirmDeactivate?.name}” será inativado. Você poderá reativá-lo depois.
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

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover cliente?</DialogTitle>
            <DialogDescription>
              O cliente “{confirmDelete?.name}” será removido. O histórico de pedidos é preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isPending}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
