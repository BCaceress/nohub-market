/**
 * Outbox Producer — enfileira eventos externos para processamento assíncrono (RN-V06).
 *
 * Nenhuma chamada de API externa ocorre durante o request.
 * O OutboxEvent é gravado dentro da mesma transação do Prisma,
 * garantindo consistência (se o pedido for criado, o evento também é).
 *
 * O processor (outbox/processor.ts) processa os eventos via Vercel Cron.
 */

import { prisma } from "@nohub/db";
import type { Prisma } from "@nohub/db";

export type OutboxEventType =
  | "IFOOD_ACCEPT"          // Aceitar pedido iFood (SLA: 10 min)
  | "IFOOD_REJECT"          // Rejeitar pedido iFood
  | "IFOOD_DISPATCH"        // Despachar pedido iFood
  | "IFOOD_CONCLUDE"        // Concluir pedido iFood
  | "IFOOD_CANCEL"          // Cancelar pedido iFood
  | "WHATSAPP_MESSAGE"      // Enviar mensagem WhatsApp
  | "ML_SHIPPING_UPDATE"    // Atualizar envio ML
  | "PIX_CHARGE_CREATE"     // Criar cobrança Pix
  | "PIX_CHARGE_CANCEL"     // Cancelar cobrança Pix
  | "CATALOG_SYNC_IFOOD"    // Sincronizar catálogo iFood
  | "CATALOG_SYNC_ML"       // Sincronizar catálogo ML
  | "CATALOG_SYNC_WHATSAPP"; // Sincronizar catálogo WhatsApp

export type EnqueueOutboxInput = {
  organizationId: string;
  eventType:      OutboxEventType;
  payload:        Record<string, unknown>;
  /** Chave de idempotência — previne duplicatas (ex: orderId+eventType) */
  idempotencyKey: string;
  /** aggregateType: tipo do agregado (ex: "Order", "ChannelIntegration") */
  aggregateType?: string;
  /** aggregateId: id do agregado */
  aggregateId?:   string;
  /** Prioridade: 10 = alta (SLA iFood), 0 = normal */
  priority?:      number;
  /** Número máximo de tentativas (padrão: 5) */
  maxAttempts?:   number;
  /** Executar dentro desta transação existente */
  tx?:            Prisma.TransactionClient;
};

/**
 * Enfileira um OutboxEvent.
 * Idempotente: se já existe evento com a mesma idempotencyKey, retorna o existente.
 */
export async function enqueueOutboxEvent(
  input: EnqueueOutboxInput,
): Promise<{ id: string }> {
  const db = input.tx ?? prisma;

  // Upsert para idempotência
  const event = await db.outboxEvent.upsert({
    where:  { idempotencyKey: input.idempotencyKey },
    update: {}, // se já existe, não atualiza (primeira gravação vence)
    create: {
      organizationId: input.organizationId,
      eventType:      input.eventType,
      aggregateType:  input.aggregateType ?? "OutboxEvent",
      aggregateId:    input.aggregateId   ?? input.idempotencyKey,
      payload:        input.payload as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
      priority:       input.priority ?? 0,
      maxAttempts:    input.maxAttempts ?? 5,
    },
  });

  return { id: event.id };
}

/**
 * Enfileira evento de aceite iFood com prioridade alta (SLA 10 min).
 */
export async function enqueueIfoodAccept(
  organizationId: string,
  externalOrderId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  await enqueueOutboxEvent({
    organizationId,
    eventType:      "IFOOD_ACCEPT",
    aggregateType:  "Order",
    aggregateId:    externalOrderId,
    payload:        { externalOrderId },
    idempotencyKey: `ifood-accept-${externalOrderId}`,
    priority:       10,
    maxAttempts:    3,
    tx,
  });
}

/**
 * Enfileira push de status para qualquer canal.
 */
export async function enqueuePushStatus(
  organizationId: string,
  channel:        string,
  orderId:        string,
  externalOrderId: string,
  newStatus:      string,
  metadata?:      Record<string, unknown>,
  tx?:            Prisma.TransactionClient,
): Promise<void> {
  const eventTypeMap: Record<string, OutboxEventType> = {
    IFOOD:        "IFOOD_ACCEPT",
    MERCADOLIVRE: "ML_SHIPPING_UPDATE",
    WHATSAPP:     "WHATSAPP_MESSAGE",
  };

  // Mapear canal+status → eventType específico
  let eventType: OutboxEventType = eventTypeMap[channel] ?? "WHATSAPP_MESSAGE";
  if (channel === "IFOOD") {
    const ifoodMap: Record<string, OutboxEventType> = {
      CONFIRMED:  "IFOOD_ACCEPT",
      FULFILLED:  "IFOOD_DISPATCH",
      COMPLETED:  "IFOOD_CONCLUDE",
      CANCELED:   "IFOOD_CANCEL",
    };
    eventType = ifoodMap[newStatus] ?? "IFOOD_ACCEPT";
  }

  const priority = channel === "IFOOD" ? 10 : 0;

  await enqueueOutboxEvent({
    organizationId,
    eventType,
    aggregateType:  "Order",
    aggregateId:    orderId,
    payload:        { orderId, externalOrderId, newStatus, metadata: metadata ?? {} },
    idempotencyKey: `push-${channel}-${externalOrderId}-${newStatus}`,
    priority,
    tx,
  });
}
