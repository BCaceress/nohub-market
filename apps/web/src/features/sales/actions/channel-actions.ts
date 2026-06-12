"use server";

import type { OrderChannel } from "@nohub/db";
import { prisma } from "@nohub/db";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { enqueueOutboxEvent } from "../outbox/producer";

/**
 * Reconciliação ChannelIntegration ↔ SalesChannel.
 * ChannelIntegration = estado de conexão/credenciais (pipeline de pedidos).
 * SalesChannel = canal habilitado + roteamento de fulfillment (channelLocations).
 * Conectar/desconectar reflete no SalesChannel (enabled) sem fundir os modelos,
 * mantendo o estado "habilitado" consistente e sem ambiguidade entre tabelas.
 */
const RECONCILABLE = ["IFOOD", "WHATSAPP", "MERCADO_LIVRE"] as const;
type ReconcilableChannel = (typeof RECONCILABLE)[number];

const SALES_CHANNEL_NAME: Record<ReconcilableChannel, string> = {
  IFOOD: "iFood",
  WHATSAPP: "WhatsApp",
  MERCADO_LIVRE: "Mercado Livre",
};

async function reconcileSalesChannel(
  organizationId: string,
  channel: ReconcilableChannel,
  enabled: boolean,
) {
  const existing = await prisma.salesChannel.findFirst({
    where: { organizationId, type: channel },
  });
  if (existing) {
    if (existing.enabled !== enabled) {
      await prisma.salesChannel.update({ where: { id: existing.id }, data: { enabled } });
    }
    return;
  }
  // Não cria registro só para desabilitar.
  if (enabled) {
    await prisma.salesChannel.create({
      data: { organizationId, type: channel, name: SALES_CHANNEL_NAME[channel], enabled: true },
    });
  }
}

function isReconcilable(channel: string): channel is ReconcilableChannel {
  return (RECONCILABLE as readonly string[]).includes(channel);
}

const connectSchema = z.object({
  organizationId: z.string(),
  channel: z.enum(["IFOOD", "WHATSAPP", "MERCADO_LIVRE", "POS", "SELF_SERVICE"]),
  credentials: z.record(z.unknown()),
  settings: z.record(z.unknown()).optional(),
  actorId: z.string(),
});

export async function connectChannelAction(input: z.infer<typeof connectSchema>) {
  const parsed = connectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }

  const { organizationId, channel, credentials, settings, actorId } = parsed.data;

  const integration = await prisma.channelIntegration.upsert({
    where: { organizationId_channel: { organizationId, channel: channel as OrderChannel } },
    update: {
      credentials: credentials as never,
      settings: (settings ?? {}) as never,
      status: "CONNECTED",
      lastErrorMsg: null,
      lastErrorAt: null,
    },
    create: {
      organizationId,
      channel: channel as OrderChannel,
      credentials: credentials as never,
      settings: (settings ?? {}) as never,
      status: "CONNECTED",
    },
  });

  if (isReconcilable(channel)) {
    await reconcileSalesChannel(organizationId, channel, true);
  }

  await writeAudit({
    organizationId,
    actorId,
    action: "channel.connected",
    resourceType: "ChannelIntegration",
    resourceId: integration.id,
    after: { channel },
  });

  return { success: true as const, integrationId: integration.id };
}

export async function disconnectChannelAction(
  organizationId: string,
  channel: string,
  actorId: string,
) {
  const integration = await prisma.channelIntegration.findUnique({
    where: { organizationId_channel: { organizationId, channel: channel as OrderChannel } },
  });
  if (!integration) return { success: false as const, error: "Integração não encontrada" };

  await prisma.channelIntegration.update({
    where: { id: integration.id },
    data: { status: "DISCONNECTED", credentials: undefined },
  });

  if (isReconcilable(channel)) {
    await reconcileSalesChannel(organizationId, channel, false);
  }

  await writeAudit({
    organizationId,
    actorId,
    action: "channel.disconnected",
    resourceType: "ChannelIntegration",
    resourceId: integration.id,
    after: { channel },
  });

  return { success: true as const };
}

export async function getChannelIntegrationsAction(organizationId: string) {
  return prisma.channelIntegration.findMany({
    where: { organizationId },
    orderBy: { channel: "asc" },
    select: {
      id: true,
      channel: true,
      status: true,
      settings: true,
      lastSyncAt: true,
      lastErrorAt: true,
      lastErrorMsg: true,
      createdAt: true,
      updatedAt: true,
      // Nunca expor credentials — dados sensíveis
    },
  });
}

export async function syncCatalogAction(organizationId: string, channel: string, _actorId: string) {
  const integration = await prisma.channelIntegration.findUnique({
    where: { organizationId_channel: { organizationId, channel: channel as OrderChannel } },
  });
  if (integration?.status !== "CONNECTED") {
    return { success: false as const, error: "Canal não conectado" };
  }

  // Buscar produtos ativos para sincronização
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      productType: { in: ["SIMPLE", "VARIANT_PARENT"] },
    },
    include: { variants: { where: { isActive: true } } },
    take: 500,
  });

  const syncProducts = products.flatMap((p) => {
    if (p.variants.length > 0) {
      return p.variants.map((v) => ({
        productId: p.id,
        variantId: v.id,
        name: `${p.name} — ${v.name}`,
        description: p.description ?? undefined,
        price: Number(p.price ?? 0),
        sku: v.sku ?? p.sku ?? undefined,
        imageUrl: undefined,
      }));
    }
    return [
      {
        productId: p.id,
        name: p.name,
        description: p.description ?? undefined,
        price: Number(p.price ?? 0),
        sku: p.sku ?? undefined,
        imageUrl: undefined,
      },
    ];
  });

  // Enfileirar sincronização assíncrona
  const eventTypeMap: Record<
    string,
    "CATALOG_SYNC_IFOOD" | "CATALOG_SYNC_ML" | "CATALOG_SYNC_WHATSAPP"
  > = {
    IFOOD: "CATALOG_SYNC_IFOOD",
    MERCADO_LIVRE: "CATALOG_SYNC_ML",
    WHATSAPP: "CATALOG_SYNC_WHATSAPP",
  };
  const eventType = eventTypeMap[channel];
  if (!eventType) return { success: false as const, error: "Canal não suporta sincronização" };

  await enqueueOutboxEvent({
    organizationId,
    eventType,
    payload: { products: syncProducts },
    idempotencyKey: `catalog-sync-${channel}-${organizationId}-${Date.now()}`,
  });

  return { success: true as const, queued: syncProducts.length };
}
