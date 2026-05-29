"use client";

import { MapPin, Radio } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleChannelAction } from "./actions/channel-actions";
import { ChannelConfigDialog } from "./channel-config-dialog";

const CHANNEL_LABELS: Record<string, string> = {
  IFOOD: "iFood",
  WHATSAPP: "WhatsApp",
  MERCADO_LIVRE: "Mercado Livre",
  RAPPI: "Rappi",
  OWN_ECOMMERCE: "E-commerce próprio",
  OTHER: "Outro",
};

type Channel = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  config?: Record<string, string> | null;
  channelLocations: {
    location: { id: string; name: string };
  }[];
};

function ChannelCard({ channel, organizationId }: { channel: Channel; organizationId: string }) {
  const [enabled, setEnabled] = useState(channel.enabled);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await toggleChannelAction(organizationId, channel.id, !enabled);
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
    } else {
      setEnabled((v) => !v);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Radio className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{CHANNEL_LABELS[channel.type] ?? channel.name}</p>
            <p className="text-xs text-muted-foreground">{channel.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Ativo" : "Inativo"}</Badge>
          <ChannelConfigDialog
            organizationId={organizationId}
            channelId={channel.id}
            channelType={channel.type}
            currentConfig={channel.config as Record<string, string> | null}
          />
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            onClick={toggle}
            disabled={loading}
          >
            {loading ? "..." : enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      {channel.channelLocations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {channel.channelLocations.map((cl) => (
            <span
              key={cl.location.id}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
            >
              <MapPin className="h-3 w-3" />
              {cl.location.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChannelsManager({
  organizationId,
  channels,
}: {
  organizationId: string;
  channels: Channel[];
}) {
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Radio className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="font-medium">Nenhum canal configurado</p>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os canais de venda durante o onboarding ou entre em contato com o suporte.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {channels.map((ch) => (
        <ChannelCard key={ch.id} channel={ch} organizationId={organizationId} />
      ))}
    </div>
  );
}
