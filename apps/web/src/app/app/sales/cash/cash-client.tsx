"use client";

import { AlertTriangle, DollarSign, Plus, TrendingDown, TrendingUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
type OpenSession = {
  id: string;
  locationId: string;
  location: { name: string };
  openingAmount: number;
  closingAmount: number | null;
  systemAmount: number | null;
  divergence: number | null;
  status: string;
  openedAt: string;
  movements: Movement[];
  _count: { orders: number };
};
type ClosedSession = {
  id: string;
  locationId: string;
  location: { name: string };
  openingAmount: number;
  closingAmount: number | null;
  systemAmount: number | null;
  divergence: number | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
};

type Props = {
  locations: Location[];
  openSessions: OpenSession[];
  recentClosed: ClosedSession[];
  organizationId: string;
  actorId: string;
};

export function CashClient({
  locations,
  openSessions,
  recentClosed,
  organizationId,
  actorId,
}: Props) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeSessionId, setCloseSessionId] = useState<string | null>(null);
  const [movementDialog, setMovementDialog] = useState<{
    sessionId: string;
    type: "BLEED" | "SUPPLY";
  } | null>(null);
  const [_confirmDisconnect, _setConfirmDisconnect] = useState<string | null>(null);

  // Open form
  const [openLocationId, setOpenLocationId] = useState(locations[0]?.id ?? "");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openNote, setOpenNote] = useState("");
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  // Close form
  const [closingAmount, setClosingAmount] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // Movement form
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {openSessions.length} caixa{openSessions.length !== 1 ? "s" : ""} aberto
            {openSessions.length !== 1 ? "s" : ""}
          </p>
          <Button onClick={() => setOpenDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Abrir Caixa
          </Button>
        </div>

        {openSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum caixa aberto. Clique em &quot;Abrir Caixa&quot; para iniciar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {openSessions.map((session) => (
              <Card key={session.id} className="border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{session.location.name}</CardTitle>
                    <Badge className="bg-green-100 text-green-700">Aberto</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
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
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Abertura</span>
                    <span className="font-medium">{fmt(session.openingAmount)}</span>
                  </div>
                  <Separator />
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {recentClosed.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Fechamentos recentes
            </h2>
            <div className="rounded-lg border divide-y">
              {recentClosed.map((session) => (
                <div key={session.id} className="flex items-center gap-4 px-4 py-3 text-sm">
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
                        className={`text-xs flex items-center gap-1 justify-end ${session.divergence < 0 ? "text-red-500" : "text-green-600"}`}
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
      </div>

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
        onOpenChange={(open) => {
          if (!open) setCloseSessionId(null);
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
        onOpenChange={(open) => {
          if (!open) setMovementDialog(null);
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
    </>
  );
}
