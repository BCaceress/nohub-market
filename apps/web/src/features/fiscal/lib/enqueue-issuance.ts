/**
 * enqueueIssuance — dispara a emissão fiscal após ORDER_PAID.
 *
 * Idempotente (RN-F03): se já existe Invoice para o orderId, retorna ela.
 * Cria Invoice PENDING + enfileira no Outbox da Etapa 4 (RN-F05).
 */

import { prisma } from "@nohub/db";
import type { Prisma } from "@nohub/db";
import { enqueueOutboxEvent } from "@/features/sales/outbox/producer";
import { writeAudit } from "@/lib/audit";

export type EnqueueIssuanceResult =
  | { success: true;  invoiceId: string; alreadyExisted: boolean }
  | { success: false; error: string };

export async function enqueueIssuance(
  organizationId: string,
  orderId:        string,
  actorId?:       string,
  tx?:            Prisma.TransactionClient,
): Promise<EnqueueIssuanceResult> {
  const db = tx ?? prisma;

  // Idempotência — se já existe Invoice para este pedido, não cria outra
  const existing = await db.invoice.findUnique({
    where: { orderId },
  });
  if (existing) {
    return { success: true, invoiceId: existing.id, alreadyExisted: true };
  }

  // Verificar capability fiscal da organização
  const capability = await db.organizationCapability.findUnique({
    where: { organizationId_key: { organizationId, key: "fiscal.nfce_enabled" } },
  });
  if (!capability?.enabled) {
    return { success: false, error: "Emissão fiscal não habilitada para esta organização" };
  }

  // Buscar pedido para pegar locationId e totais
  const order = await db.order.findUnique({
    where:   { id: orderId },
    select:  {
      id:           true,
      locationId:   true,
      customerId:   true,
      total:        true,
      organizationId: true,
    },
  });
  if (!order || order.organizationId !== organizationId) {
    return { success: false, error: "Pedido não encontrado" };
  }

  // Buscar FiscalConfig para pegar o provider
  const fiscalConfig = await db.fiscalConfig.findUnique({
    where: { organizationId },
  });
  if (!fiscalConfig) {
    return { success: false, error: "Configuração fiscal não encontrada — configure o módulo fiscal" };
  }

  // Criar Invoice PENDING (idempotência via idempotencyKey = orderId)
  const invoice = await db.invoice.create({
    data: {
      organizationId,
      locationId:    order.locationId,
      orderId,
      customerId:    order.customerId ?? null,
      status:        "PENDING",
      provider:      fiscalConfig.provider,
      series:        fiscalConfig.nfceSeries,
      totalAmount:   order.total,
      totalTax:      0, // calculado em processIssuance
      idempotencyKey: orderId,
      events: {
        create: {
          eventType: "SUBMITTED",
          fromStatus: undefined,
          toStatus:   "PENDING",
          actorId:    actorId ?? null,
          source:     "INTERNAL",
          note:       "Invoice criada e enfileirada para emissão",
        },
      },
    },
  });

  // Enfileirar no Outbox da Etapa 4
  await enqueueOutboxEvent({
    organizationId,
    eventType:      "FISCAL_ISSUE" as never, // estender OutboxEventType
    aggregateType:  "Invoice",
    aggregateId:    invoice.id,
    payload:        { invoiceId: invoice.id, orderId },
    idempotencyKey: `fiscal-issue-${invoice.id}`,
    priority:       5,
    maxAttempts:    5,
    tx:             tx as never,
  });

  await writeAudit({
    organizationId,
    actorId: actorId ?? "system",
    action:  "invoice.enqueued",
    resourceType: "Invoice",
    resourceId:   invoice.id,
    after:   { orderId, status: "PENDING" },
  });

  return { success: true, invoiceId: invoice.id, alreadyExisted: false };
}
