/**
 * Outbox Processor — processa OutboxEvents com retry e back-off (RN-V06).
 *
 * Executado via Vercel Cron (apps/web/src/app/api/outbox/process/route.ts).
 * Processa em lotes, priorizando eventos de alta prioridade (iFood SLA).
 *
 * Retry: exponential back-off — nextAttemptAt = now + 2^attempts * 30s
 * Max: maxAttempts (padrão: 5) — após isso, status = FAILED (dead letter).
 */

import { processIssuance } from "@/features/fiscal/lib/process-issuance";
import { prisma } from "@nohub/db";
import type { OrderStatus } from "@nohub/db";
import { ifoodAdapter } from "../adapters/ifood-adapter";
import { mercadolivreAdapter } from "../adapters/mercadolivre-adapter";
import { whatsappAdapter } from "../adapters/whatsapp-adapter";

const BATCH_SIZE = 20;

type ProcessResult = {
  processed: number;
  succeeded: number;
  failed: number;
  retrying: number;
};

/**
 * Processa um lote de OutboxEvents pendentes.
 * Chamado pelo endpoint de Cron.
 */
export async function processOutboxBatch(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, succeeded: 0, failed: 0, retrying: 0 };

  // Buscar eventos pendentes, priorizando alta prioridade e os mais antigos
  const events = await prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: BATCH_SIZE,
    include: {
      organization: {
        include: {
          channelIntegrations: { where: { status: "CONNECTED" } },
        },
      },
    },
  });

  for (const event of events) {
    result.processed++;

    // Marcar como PROCESSING para evitar processamento duplo
    const claimed = await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: "PENDING" },
      data: { status: "PROCESSING", processedAt: new Date() },
    });

    if (claimed.count === 0) continue; // outro worker já pegou

    try {
      await dispatchEvent(event);
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: "DONE", processedAt: new Date() },
      });
      result.succeeded++;
    } catch (err) {
      const attempts = event.attempts + 1;
      const isFinal = attempts >= event.maxAttempts;

      // Back-off exponencial: 30s, 60s, 120s, 240s, 480s
      const backoffSeconds = Math.min(2 ** attempts * 30, 3600);
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: isFinal ? "FAILED" : "PENDING",
          attempts,
          lastError: String(err),
          nextRetryAt: isFinal ? null : nextAttemptAt,
          processedAt: isFinal ? new Date() : null,
        },
      });

      if (isFinal) result.failed++;
      else result.retrying++;
    }
  }

  return result;
}

/* ── Dispatcher ──────────────────────────────────────────────── */

async function dispatchEvent(event: {
  eventType: string;
  payload: unknown;
  organization: {
    channelIntegrations: Array<{
      channel: string;
      credentials: unknown;
      status: string;
    }>;
  };
}): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const integrations = event.organization.channelIntegrations;

  const getCredentials = (channel: string): Record<string, unknown> => {
    const integration = integrations.find((i) => i.channel === channel);
    return (integration?.credentials as Record<string, unknown>) ?? {};
  };

  switch (event.eventType) {
    case "IFOOD_ACCEPT":
    case "IFOOD_REJECT":
    case "IFOOD_DISPATCH":
    case "IFOOD_CONCLUDE":
    case "IFOOD_CANCEL": {
      const credentials = getCredentials("IFOOD");
      const result = await ifoodAdapter.pushStatus(
        credentials,
        String(payload.orderId ?? ""),
        String(payload.externalOrderId ?? ""),
        String(payload.newStatus ?? "") as OrderStatus,
        payload.metadata as Record<string, unknown> | undefined,
      );
      if (!result.success) throw new Error(result.error);
      break;
    }

    case "WHATSAPP_MESSAGE": {
      const credentials = getCredentials("WHATSAPP");
      const result = await whatsappAdapter.pushStatus(
        credentials,
        String(payload.orderId ?? ""),
        String(payload.externalOrderId ?? ""),
        String(payload.newStatus ?? "") as OrderStatus,
        payload.metadata as Record<string, unknown> | undefined,
      );
      if (!result.success) throw new Error(result.error);
      break;
    }

    case "ML_SHIPPING_UPDATE": {
      const credentials = getCredentials("MERCADOLIVRE");
      const result = await mercadolivreAdapter.pushStatus(
        credentials,
        String(payload.orderId ?? ""),
        String(payload.externalOrderId ?? ""),
        String(payload.newStatus ?? "") as OrderStatus,
        payload.metadata as Record<string, unknown> | undefined,
      );
      if (!result.success) throw new Error(result.error);
      break;
    }

    case "CATALOG_SYNC_IFOOD": {
      const credentials = getCredentials("IFOOD");
      const products = (payload.products as never[]) ?? [];
      const result = await ifoodAdapter.syncCatalog(credentials, products);
      if (!result.success) throw new Error(result.error);
      break;
    }

    case "CATALOG_SYNC_ML": {
      const credentials = getCredentials("MERCADOLIVRE");
      const products = (payload.products as never[]) ?? [];
      const result = await mercadolivreAdapter.syncCatalog(credentials, products);
      if (!result.success) throw new Error(result.error);
      break;
    }

    case "CATALOG_SYNC_WHATSAPP": {
      const credentials = getCredentials("WHATSAPP");
      const products = (payload.products as never[]) ?? [];
      const result = await whatsappAdapter.syncCatalog(credentials, products);
      if (!result.success) throw new Error(result.error);
      break;
    }

    case "PIX_CHARGE_CREATE":
    case "PIX_CHARGE_CANCEL":
      // TODO: Integrar com payment provider real
      console.warn(`[OutboxProcessor] ${event.eventType} em modo simulado`);
      break;

    case "FISCAL_ISSUE": {
      const invoiceId = String(payload.invoiceId ?? "");
      if (!invoiceId) throw new Error("FISCAL_ISSUE sem invoiceId no payload");
      const fiscalResult = await processIssuance(invoiceId);
      if (!fiscalResult.success && !fiscalResult.retryable) {
        // Falha permanente — não retentar (ex: cert vencido, config faltando)
        // Lança igual para marcar FAILED e parar retries
        throw Object.assign(new Error(fiscalResult.error), { permanent: true });
      }
      if (!fiscalResult.success) {
        throw new Error(fiscalResult.error);
      }
      break;
    }

    case "FISCAL_CANCEL":
      // Cancelamento é disparado sincronamente via requestCancellation — não usa Outbox
      console.warn("[OutboxProcessor] FISCAL_CANCEL recebido — tratado sincronamente");
      break;

    default:
      throw new Error(`Tipo de evento desconhecido: ${event.eventType}`);
  }
}
