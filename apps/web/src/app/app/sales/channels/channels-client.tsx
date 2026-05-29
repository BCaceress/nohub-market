"use client";

import { Plug, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectChannelAction,
  disconnectChannelAction,
  syncCatalogAction,
} from "@/features/sales/actions/channel-actions";

type Integration = {
  id: string;
  channel: string;
  status: string;
  settings: unknown;
  lastSyncAt: Date | string | null;
  lastErrorAt: Date | string | null;
  lastErrorMsg: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type Props = {
  integrations: Integration[];
  organizationId: string;
  actorId: string;
};

const CHANNEL_INFO: Record<
  string,
  {
    name: string;
    description: string;
    fields: Array<{ key: string; label: string; type: "text" | "password"; placeholder: string }>;
  }
> = {
  IFOOD: {
    name: "iFood",
    description: "Receba pedidos do iFood automaticamente. Requer homologação junto ao iFood.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Token OAuth iFood",
      },
      { key: "merchantId", label: "Merchant ID", type: "text", placeholder: "ID do restaurante" },
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        type: "password",
        placeholder: "Segredo do webhook",
      },
    ],
  },
  WHATSAPP: {
    name: "WhatsApp Business",
    description: "Receba pedidos via WhatsApp (Meta Cloud API). Catálogo de produtos integrado.",
    fields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Token da Meta" },
      { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "ID do número" },
      { key: "catalogId", label: "Catalog ID", type: "text", placeholder: "ID do catálogo" },
      { key: "appSecret", label: "App Secret", type: "password", placeholder: "Segredo do app" },
    ],
  },
  MERCADO_LIVRE: {
    name: "Mercado Livre",
    description: "Sincronize produtos e receba pedidos do ML. Suporta FLEX e CLASSIC.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Token OAuth ML",
      },
      { key: "sellerId", label: "Seller ID", type: "text", placeholder: "ID do vendedor" },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Segredo do app",
      },
    ],
  },
};

const ALL_CHANNELS = ["IFOOD", "WHATSAPP", "MERCADO_LIVRE"] as const;

export function ChannelsClient({ integrations, organizationId, actorId }: Props) {
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

  const channelInfo = connectChannel ? CHANNEL_INFO[connectChannel] : null;

  return (
    <>
      {syncResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {syncResult}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {ALL_CHANNELS.map((channel) => {
          const info = CHANNEL_INFO[channel];
          const integration = getIntegration(channel);
          const connected = integration?.status === "CONNECTED";

          return (
            <Card key={channel} className={connected ? "border-green-200" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{info?.name}</CardTitle>
                    <CardDescription className="mt-1 text-xs">{info?.description}</CardDescription>
                  </div>
                  <Badge
                    variant={connected ? "default" : "secondary"}
                    className={connected ? "bg-green-100 text-green-700" : ""}
                  >
                    {connected ? "Conectado" : "Desconectado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {integration?.lastErrorMsg && (
                  <p className="text-xs text-destructive">{integration.lastErrorMsg}</p>
                )}
                {connected && integration?.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    Última sync:{" "}
                    {new Date(integration.lastSyncAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  {!connected ? (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setConnectChannel(channel);
                        setCredentials({});
                        setConnectError(null);
                      }}
                    >
                      <Plug className="mr-2 h-4 w-4" />
                      Conectar
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={syncLoading && syncChannel === channel}
                        onClick={() => handleSync(channel)}
                      >
                        <RefreshCw
                          className={`mr-1 h-3 w-3 ${syncLoading && syncChannel === channel ? "animate-spin" : ""}`}
                        />
                        Sincronizar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:bg-destructive/10"
                        onClick={() => setDisconnectTarget(channel)}
                      >
                        <Unplug className="mr-1 h-3 w-3" />
                        Desconectar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog — Conectar */}
      <Dialog
        open={!!connectChannel}
        onOpenChange={(open) => {
          if (!open) setConnectChannel(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5" />
              Conectar {channelInfo?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Insira as credenciais do canal. Dados são armazenados com segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {channelInfo?.fields.map((field) => (
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectChannel(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConnect} disabled={connectLoading}>
              {connectLoading ? "Conectando…" : "Salvar Credenciais"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Confirmar Desconexão */}
      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desconectar canal?</DialogTitle>
            <DialogDescription>
              As credenciais serão removidas. Pedidos em andamento não serão afetados. Você poderá
              reconectar a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectLoading}>
              {disconnectLoading ? "Desconectando…" : "Desconectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
