"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startInventoryCountAction } from "@/features/inventory/actions/inventory-count-actions";

type Location = { id: string; name: string };

type Props = {
  organizationId: string;
  locations: Location[];
};

export function StartCountButton({ organizationId, locations }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");

  function handleStart() {
    if (!locationId) {
      setError("Selecione um local.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await startInventoryCountAction(organizationId, {
        locationId,
        note: note || undefined,
      });
      if (!res.success) {
        setError(res.error);
      } else {
        setOpen(false);
        router.push(`/app/inventory/count/${res.data.countId}`);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Nova contagem
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar contagem física</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="loc">Local *</Label>
              <select
                id="loc"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setError(null);
                }}
              >
                <option value="">Selecione o local</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Observação</Label>
              <Textarea
                id="note"
                rows={2}
                placeholder="Inventário anual, auditoria, etc."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleStart} disabled={isPending || !locationId}>
                {isPending ? "Iniciando…" : "Iniciar contagem"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
