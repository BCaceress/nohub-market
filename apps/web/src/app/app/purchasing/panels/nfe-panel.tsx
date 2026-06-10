"use client";

import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { importNfeXmlAction } from "@/features/purchasing/actions/purchasing-actions";

const STATUS: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  PENDING: { variant: "outline", label: "Pendente" },
  PARSED: { variant: "warning", label: "Aguardando Mapeamento" },
  MAPPED: { variant: "info", label: "Mapeado" },
  CONFIRMED: { variant: "success", label: "Confirmado" },
  REJECTED: { variant: "destructive", label: "Rejeitado" },
};

type NfeImport = {
  id: string;
  accessKey: string;
  status: string;
  uploadedAt: Date;
  supplierId: string | null;
  purchaseOrderId: string | null;
};

type Location = { id: string; name: string };

type Props = {
  open: boolean;
  imports: NfeImport[];
  locations: Location[];
  onClose: () => void;
};

export function NfePanel({ open, imports, locations, onClose }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !locationId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlContent = e.target?.result as string;
      startTransition(async () => {
        const r = await importNfeXmlAction({ locationId, xmlContent, autoMap: true });
        if (!r.success) {
          setError(r.error);
        } else {
          setError(null);
          if (r.mappingPending) {
            setSuccess(`NFe importada. ${r.unmappedCount} item(ns) precisam de mapeamento manual.`);
          } else {
            setSuccess("NFe importada e mapeada automaticamente. Pronta para confirmação.");
          }
          router.refresh();
        }
      });
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-2xl">
      <SheetHeader
        title="Importar NFe de Entrada"
        description="Faça upload do XML da nota; os itens são mapeados aos produtos automaticamente."
        onClose={onClose}
      />
      <SheetBody className="space-y-6">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nfe-location">Unidade destino</Label>
              <Select
                id="nfe-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nfe-xml">Arquivo XML</Label>
              <input
                id="nfe-xml"
                ref={fileInputRef}
                type="file"
                accept=".xml,text/xml"
                className="flex h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-3 py-2 text-sm text-muted-foreground shadow-xs file:mr-3 file:rounded file:border-0 file:bg-primary-soft file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary-soft-foreground"
              />
            </div>
          </div>
          <Button onClick={handleFileUpload}>
            <UploadCloud className="h-4 w-4" /> Importar NFe
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
            {success}
          </div>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Histórico de Importações</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-1 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Chave de Acesso</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {imports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhuma importação registrada.
                    </td>
                  </tr>
                ) : (
                  imports.map((imp) => {
                    const meta = STATUS[imp.status];
                    return (
                      <tr key={imp.id} className="transition-colors hover:bg-surface-1">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {imp.accessKey}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={meta?.variant ?? "outline"}>
                            {meta?.label ?? imp.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(imp.uploadedAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          {imp.purchaseOrderId && (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/app/purchasing/orders/${imp.purchaseOrderId}`)
                              }
                              className="cursor-pointer text-xs text-primary hover:underline"
                            >
                              Ver Pedido
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SheetBody>
    </Sheet>
  );
}
