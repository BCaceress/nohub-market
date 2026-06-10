"use client";

import { Plug, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import {
  connectChannelAction,
  disconnectChannelAction,
  syncCatalogAction,
} from "@/features/sales/actions/channel-actions";
import { CHANNEL_CATALOG, findChannel } from "./channel-catalog";
import { ChannelLogo } from "./channel-logo";

export type ChannelIntegration = {
  id: string;
  channel: string;
  status: string;
  lastSyncAt: Date | string | null;
  lastErrorAt: Date | string | null;
  lastErrorMsg: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  integrations: ChannelIntegration[];
  organizationId: string;
  actorId: string;
  /** Abre direto no formulário de conexão deste canal (key do enum). */
  initialChannel?: string | null;
};

export function ChannelsSheet({
  open,
  onClose,
  integrations,
  organizationId,
  actorId,
  initialChannel,
}: Props) {
  const router = useRouter();

  const [connectChannel, setConnectChannel] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  const [syncChannel, setSyncChannel] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Ao abrir com canal alvo, entra direto no formulário de conexão.
  useEffect(() => {
    if (open && initialChannel) {
      setConnectChannel(initialChannel);
      setCredentials({});
      setConnectError(null);
    }
    if (!open) {
      setConnectChannel(null);
      setDisconnectTarget(null);
    }
  }, [open, initialChannel]);

  const getIntegration = (channel: string) => integrations.find((i) => i.channel === channel);

  const handleConnect = async () => {
    if (!connectChannel) return;
    setConnectLoading(true);
    setConnectError(null);
    const result = await connectChannelAction({
      organizationId,
      channel: connectChannel as "IFOOD" | "WHATSAPP" | "MERCADO_LIVRE" | "POS" | "SELF_SERVICE",
      credentials,
      actorId,
    });
    setConnectLoading(false);
    if (!result.success) {
      setConnectError(result.error);
      return;
    }
    setConnectChannel(null);
    setCredentials({});
    router.refresh();
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnectLoading(true);
    await disconnectChannelAction(organizationId, disconnectTarget, actorId);
    setDisconnectLoading(false);
    setDisconnectTarget(null);
    router.refresh();
  };

  const handleSync = async (channel: string) => {
    setSyncChannel(channel);
    setSyncLoading(true);
    setSyncResult(null);
    const result = await syncCatalogAction(organizationId, channel, actorId);
    setSyncLoading(false);
    setSyncChannel(null);
    if (result.success) {
      setSyncResult(`${result.queued} produtos enfileirados para sincronização`);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const formChannel = connectChannel ? findChannel(connectChannel) : null;

  return (
    <Sheet open={open} onClose={onClose} className="w-full max-w-md">
      <SheetHeader
        title="Canais de venda"
        description="Conecte sua loja aos canais externos. Pedidos chegam direto na área Online."
        onClose={onClose}
      />
      <SheetBody className="space-y-3">
        {syncResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            {syncResult}
          </div>
        )}

        {/* Formulário de conexão inline */}
        {formChannel ? (
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <ChannelLogo ch={formChannel} size={36} />
              <div>
                <p className="text-sm font-semibold">Conectar {formChannel.name}</p>
                <p className="text-xs text-muted-foreground">
                  Credenciais armazenadas com segurança.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {formChannel.fields?.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ""}
                    onChange={(e) =>
                      setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              {connectError && (
                <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {connectError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConnectChannel(null)}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleConnect} disabled={connectLoading}>
                  {connectLoading ? "Conectando…" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Lista de canais */
          CHANNEL_CATALOG.map((ch) => {
            const integration = getIntegration(ch.key);
            const connected = integration?.status === "CONNECTED";
            const hasError = !!integration?.lastErrorMsg;

            return (
              <div
                key={ch.key}
                className={`rounded-lg border p-3 ${ch.comingSoon ? "opacity-60" : ""} ${
                  connected ? "border-green-200" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <ChannelLogo ch={ch} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{ch.name}</p>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                    </div>
                  </div>
                  {ch.comingSoon ? (
                    <Badge variant="secondary">Em breve</Badge>
                  ) : (
                    <Badge
                      variant={connected ? "default" : "secondary"}
                      className={connected ? "bg-green-100 text-green-700" : ""}
                    >
                      {connected ? "Conectado" : "Desconectado"}
                    </Badge>
                  )}
                </div>

                {hasError && (
                  <p className="mt-2 text-xs text-destructive">{integration?.lastErrorMsg}</p>
                )}
                {connected && integration?.lastSyncAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última sync:{" "}
                    {new Date(integration.lastSyncAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}

                {!ch.comingSoon && (
                  <div className="mt-3 flex gap-2">
                    {disconnectTarget === ch.key ? (
                      <>
                        <span className="flex-1 self-center text-xs text-muted-foreground">
                          Confirmar desconexão?
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDisconnectTarget(null)}
                        >
                          Não
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisconnect}
                          disabled={disconnectLoading}
                        >
                          {disconnectLoading ? "…" : "Desconectar"}
                        </Button>
                      </>
                    ) : !connected ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setConnectChannel(ch.key);
                          setCredentials({});
                          setConnectError(null);
                        }}
                      >
                        <Plug className="mr-1.5 h-3.5 w-3.5" />
                        Conectar
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={syncLoading && syncChannel === ch.key}
                          onClick={() => handleSync(ch.key)}
                        >
                          <RefreshCw
                            className={`mr-1 h-3 w-3 ${
                              syncLoading && syncChannel === ch.key ? "animate-spin" : ""
                            }`}
                          />
                          Sincronizar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:bg-destructive/10"
                          onClick={() => setDisconnectTarget(ch.key)}
                        >
                          <Unplug className="mr-1 h-3 w-3" />
                          Desconectar
                        </Button>
                      </>
                    )}
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
