"use client";

import { AlertTriangle, DollarSign, Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import {
  bleedCashAction,
  closeCashSessionAction,
  openCashSessionAction,
  supplyCashAction,
} from "@/features/sales/actions/cash-actions";

type Location = { id: string; name: string };
type Movement = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: string;
};
export type OpenSession = {
  id: string;
  locationId: string;
  location: { name: string };
  openingAmount: number;
  status: string;
  openedAt: string;
  movements: Movement[];
  _count: { orders: number };
};
export type ClosedSession = {
  id: string;
  location: { name: string };
  closingAmount: number | null;
  divergence: number | null;
  openedAt: string;
  closedAt: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  locations: Location[];
  openSessions: OpenSession[];
  recentClosed: ClosedSession[];
  organizationId: string;
  actorId: string;
  defaultLocationId?: string;
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CashSheet({
  open,
  onClose,
  locations,
  openSessions,
  recentClosed,
  organizationId,
  actorId,
  defaultLocationId,
}: Props) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeSessionId, setCloseSessionId] = useState<string | null>(null);
  const [movementDialog, setMovementDialog] = useState<{
    sessionId: string;
    type: "BLEED" | "SUPPLY";
  } | null>(null);

  const [openLocationId, setOpenLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openNote, setOpenNote] = useState("");
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const [closingAmount, setClosingAmount] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpenLoading(true);
    setOpenError(null);
    const result = await openCashSessionAction({
      organizationId,
      locationId: openLocationId,
      operatorId: actorId,
      openingAmount: Number(openingAmount),
      note: openNote || undefined,
    });
    setOpenLoading(false);
    if (!result.success) {
      setOpenError(result.error);
      return;
    }
    setOpenDialog(false);
    setOpeningAmount("");
    setOpenNote("");
    router.refresh();
  };

  const handleClose = async () => {
    if (!closeSessionId) return;
    setCloseLoading(true);
    setCloseError(null);
    const result = await closeCashSessionAction({
      organizationId,
      sessionId: closeSessionId,
      closingAmount: Number(closingAmount),
      actorId,
      note: closeNote || undefined,
    });
    setCloseLoading(false);
    if (!result.success) {
      setCloseError(result.error);
      return;
    }
    setCloseSessionId(null);
    setClosingAmount("");
    setCloseNote("");
    router.refresh();
  };

  const handleMovement = async () => {
    if (!movementDialog) return;
    setMovementLoading(true);
    setMovementError(null);
    const fn = movementDialog.type === "BLEED" ? bleedCashAction : supplyCashAction;
    const result = await fn({
      sessionId: movementDialog.sessionId,
      organizationId,
      amount: Number(movementAmount),
      note: movementNote,
      actorId,
    });
    setMovementLoading(false);
    if (!result.success) {
      setMovementError(result.error ?? "Erro desconhecido");
      return;
    }
    setMovementDialog(null);
    setMovementAmount("");
    setMovementNote("");
    router.refresh();
  };

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-md">
      <SheetHeader
        title="Caixa"
        description="Abertura, sangria, suprimento e fechamento do caixa do PDV."
        onClose={onClose}
        actions={
          <Button size="sm" onClick={() => setOpenDialog(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Abrir
          </Button>
        }
      />
      <SheetBody className="space-y-4">
        {openSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Nenhum caixa aberto. Clique em &quot;Abrir&quot; para iniciar.
          </div>
        ) : (
          openSessions.map((session) => (
            <div key={session.id} className="rounded-lg border border-green-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{session.location.name}</p>
                <Badge className="bg-green-100 text-green-700">Aberto</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Aberto em{" "}
                {new Date(session.openedAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" · "}
                {session._count.orders} venda{session._count.orders !== 1 ? "s" : ""}
              </p>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Abertura</span>
                <span className="font-medium">{fmt(session.openingAmount)}</span>
              </div>
              <Separator className="my-3" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMovementDialog({ sessionId: session.id, type: "BLEED" });
                    setMovementAmount("");
                    setMovementNote("");
                    setMovementError(null);
                  }}
                >
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                  Sangria
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMovementDialog({ sessionId: session.id, type: "SUPPLY" });
                    setMovementAmount("");
                    setMovementNote("");
                    setMovementError(null);
                  }}
                >
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                  Suprimento
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setCloseSessionId(session.id);
                    setClosingAmount("");
                    setCloseNote("");
                    setCloseError(null);
                  }}
                >
                  <X className="mr-1 h-3 w-3" />
                  Fechar
                </Button>
              </div>
            </div>
          ))
        )}

        {recentClosed.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fechamentos recentes
            </h3>
            <div className="divide-y rounded-lg border">
              {recentClosed.map((session) => (
                <div key={session.id} className="flex items-center gap-4 px-3 py-2.5 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{session.location.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.openedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{fmt(session.closingAmount ?? 0)}</p>
                    {session.divergence !== null && session.divergence !== 0 && (
                      <p
                        className={`flex items-center justify-end gap-1 text-xs ${
                          session.divergence < 0 ? "text-red-500" : "text-green-600"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {session.divergence > 0 ? "+" : ""}
                        {fmt(session.divergence)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetBody>

      {/* Dialog — Abrir Caixa */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Abrir Caixa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Local</Label>
              <Select value={openLocationId} onChange={(e) => setOpenLocationId(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Valor de abertura (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Input
                placeholder="Observação"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
              />
            </div>
            {openError && (
              <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {openError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOpen} disabled={openLoading}>
              {openLoading ? "Abrindo…" : "Abrir Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Fechar Caixa */}
      <Dialog
        open={!!closeSessionId}
        onOpenChange={(o) => {
          if (!o) setCloseSessionId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Valor contado (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Input
                placeholder="Observação"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
              />
            </div>
            {closeError && (
              <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {closeError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseSessionId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleClose} disabled={closeLoading}>
              {closeLoading ? "Fechando…" : "Confirmar Fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Sangria / Suprimento */}
      <Dialog
        open={!!movementDialog}
        onOpenChange={(o) => {
          if (!o) setMovementDialog(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{movementDialog?.type === "BLEED" ? "Sangria" : "Suprimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Justificativa</Label>
              <Input
                placeholder="Motivo obrigatório"
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
              />
            </div>
            {movementError && (
              <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {movementError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleMovement} disabled={movementLoading}>
              {movementLoading ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
