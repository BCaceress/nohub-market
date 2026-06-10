"use client";

import { Link2, PackageOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CHANNEL_CATALOG } from "@/features/sales/channel-catalog";
import { ChannelLogo } from "@/features/sales/channel-logo";
import { type ChannelIntegration, ChannelsSheet } from "@/features/sales/channels-sheet";
import { OrdersClient } from "../orders/orders-client";

type Order = {
  id: string;
  channel: string;
  status: string;
  total: number;
  externalId: string | null;
  createdAt: Date | string;
  customer: { name: string | null; phone: string | null } | null;
  payments: Array<{ method: string; amount: number; status: string }>;
  items: Array<{ productNameSnapshot: string; quantity: number; lineTotal: number }>;
  _count: { items: number };
};

type Props = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  organizationId: string;
  actorId: string;
  integrations: ChannelIntegration[];
  pendingCount: number;
};

/** Beep curto via Web Audio (sem asset). Silencioso se indisponível. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // áudio bloqueado/indisponível — ignora
  }
}

const POLL_MS = 30000;

const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "all", label: "Tudo" },
] as const;

export function OnlineClient({
  orders,
  total,
  page,
  pageSize,
  totalPages,
  organizationId,
  actorId,
  integrations,
  pendingCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetChannel, setSheetChannel] = useState<string | null>(null);

  const connected = integrations.filter((i) => i.status === "CONNECTED");
  const hasConnected = connected.length > 0;

  // Polling: revalida a cada 30s enquanto houver canal conectado.
  useEffect(() => {
    if (!hasConnected) return;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [hasConnected, router]);

  // Toast + beep quando a contagem de pendentes sobe entre revalidações.
  const prevPending = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount > prevPending.current) {
      const novos = pendingCount - prevPending.current;
      toast.success(`${novos} novo${novos > 1 ? "s" : ""} pedido${novos > 1 ? "s" : ""} online`, {
        description: "Recebido pelos canais digitais.",
      });
      beep();
    }
    prevPending.current = pendingCount;
  }, [pendingCount]);

  const openSheet = useCallback((channel?: string) => {
    setSheetChannel(channel ?? null);
    setSheetOpen(true);
  }, []);

  // Período padrão = Hoje (server resolve o `from` a partir do param `period`).
  const activePeriod = searchParams.get("period") ?? "today";

  const setPeriod = useCallback(
    (key: (typeof PERIODS)[number]["key"]) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      params.set("period", key);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <>
      {/* Toolbar — período + saúde dos canais + botão Canais */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {hasConnected ? (
          <div className="inline-flex rounded-lg border p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activePeriod === p.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {connected.length > 0 && (
            <div className="flex items-center gap-1.5">
              {connected.map((i) => (
                <span
                  key={i.id}
                  title={`${i.channel}${i.lastErrorMsg ? " — erro na última sync" : ""}`}
                  className={`h-2 w-2 rounded-full ${
                    i.lastErrorMsg ? "bg-destructive" : "bg-green-500"
                  }`}
                />
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => openSheet()}>
            <Link2 className="mr-1.5 h-4 w-4" />
            Canais
          </Button>
        </div>
      </div>

      {hasConnected ? (
        orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <PackageOpen className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Aguardando pedidos</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Seus canais estão conectados. Pedidos recebidos aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <OrdersClient
            orders={orders}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            organizationId={organizationId}
          />
        )
      ) : (
        /* Sem canal conectado → grid de cards para ativar */
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Nenhum canal conectado ainda. Escolha um canal para começar a receber pedidos online.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNEL_CATALOG.map((ch) => (
              <button
                key={ch.key}
                type="button"
                disabled={ch.comingSoon}
                onClick={() => openSheet(ch.key)}
                className={`flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition-colors ${
                  ch.comingSoon
                    ? "cursor-not-allowed opacity-60"
                    : "hover:border-primary hover:bg-muted/40"
                }`}
              >
                <ChannelLogo ch={ch} size={48} />
                <span className="flex items-center gap-2 font-semibold">
                  {ch.name}
                  {ch.comingSoon && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      Em breve
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{ch.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ChannelsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        integrations={integrations}
        organizationId={organizationId}
        actorId={actorId}
        initialChannel={sheetChannel}
      />
    </>
  );
}
