"use client";

import { useRouter } from "next/navigation";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";

const STATUS: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  OPEN: { variant: "info", label: "Aberta" },
  CLOSED: { variant: "outline", label: "Encerrada" },
  CONVERTED: { variant: "success", label: "Convertida" },
};

type QuotationItem = {
  id: string;
  product: { id: string; name: string } | null;
  quantity: unknown;
};

type SupplierResponse = {
  id: string;
  supplierId: string;
  selected: boolean;
  receivedAt: Date | null;
  totalPrice: unknown;
  leadTimeDays: number | null;
  supplier: { id: string; name: string } | null;
};

type Quotation = {
  id: string;
  description: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  items: QuotationItem[];
  supplierResponses: SupplierResponse[];
};

type Props = {
  open: boolean;
  quotations: Quotation[];
  onClose: () => void;
  onCreate: () => void;
};

export function QuotationsPanel({ open, quotations, onClose, onCreate }: Props) {
  const router = useRouter();

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-3xl">
      <SheetHeader
        title="Cotações"
        description="Compare respostas de fornecedores e selecione a melhor proposta."
        onClose={onClose}
        actions={
          <Button size="sm" onClick={onCreate}>
            + Nova
          </Button>
        }
      />
      <SheetBody className="space-y-4">
        {quotations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <p className="text-base">Nenhuma cotação criada.</p>
            <Button size="sm" className="mt-3" onClick={onCreate}>
              Criar primeira cotação
            </Button>
          </div>
        ) : (
          quotations.map((q) => {
            const respondedCount = q.supplierResponses.filter((r) => r.receivedAt).length;
            const meta = STATUS[q.status];

            return (
              <div key={q.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border bg-surface-1 px-5 py-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground">{q.description}</h3>
                      <Badge variant={meta?.variant ?? "outline"}>{meta?.label ?? q.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {q.items.length} iten(s) · {respondedCount}/{q.supplierResponses.length}{" "}
                      respostas · criada {new Date(q.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {q.status === "OPEN" && (
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => router.push(`/app/purchasing/quotations/${q.id}`)}
                    >
                      Gerenciar
                    </Button>
                  )}
                </div>

                {q.supplierResponses.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-1 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Fornecedor</th>
                          <th className="px-4 py-2 text-right font-medium">Total</th>
                          <th className="px-4 py-2 text-right font-medium">Prazo</th>
                          <th className="px-4 py-2 text-left font-medium">Respondeu?</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {q.supplierResponses.map((r) => (
                          <tr key={r.id} className={r.selected ? "bg-success-soft/50" : ""}>
                            <td className="px-4 py-3 text-foreground">
                              {r.supplier?.name ?? r.supplierId}
                              {r.selected && (
                                <span className="ml-2 text-xs font-medium text-success">
                                  ✓ Selecionado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {r.totalPrice != null
                                ? Number(r.totalPrice).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {r.leadTimeDays ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {r.receivedAt ? (
                                <span className="text-success">
                                  {new Date(r.receivedAt).toLocaleDateString("pt-BR")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Aguardando</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </SheetBody>
    </Sheet>
  );
}
