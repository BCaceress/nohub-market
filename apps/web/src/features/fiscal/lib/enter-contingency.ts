/**
 * enterContingency — coloca Invoice em contingência quando SEFAZ está fora.
 *
 * Transição: PENDING | SENDING → IN_CONTINGENCY
 * Modo EPEC ou SVC conforme fiscalConfig.contingencyMode.
 *
 * Quando SEFAZ volta, o worker deve re-transmitir as notas IN_CONTINGENCY
 * chamando processIssuance novamente (que verifica canTransition).
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import type { InvoiceStatus } from "@nohub/db";
import { canTransitionInvoice } from "./can-transition-invoice";

export type EnterContingencyInput = {
  organizationId: string;
  invoiceId: string;
  reason: string;
  actorId?: string;
};

export type EnterContingencyResult =
  | { success: true; invoiceId: string }
  | { success: false; error: string; code?: string };

export async function enterContingency(
  input: EnterContingencyInput,
): Promise<EnterContingencyResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
  });

  if (!invoice || invoice.organizationId !== input.organizationId) {
    return { success: false, error: "Invoice não encontrada", code: "NOT_FOUND" };
  }

  if (!canTransitionInvoice(invoice.status, "IN_CONTINGENCY")) {
    return {
      success: false,
      error: `Invoice em estado ${invoice.status} — não pode entrar em contingência`,
      code: "INVALID_STATUS",
    };
  }

  const fromStatus = invoice.status as InvoiceStatus;

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "IN_CONTINGENCY",
        updatedAt: new Date(),
      },
    }),
    prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice.id,
        eventType: "CONTINGENCY_ENTERED",
        fromStatus,
        toStatus: "IN_CONTINGENCY",
        actorId: input.actorId ?? null,
        source: "WORKER",
        note: `Entrou em contingência: ${input.reason.slice(0, 200)}`,
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId ?? "system",
    action: "invoice.contingency_entered",
    resourceType: "Invoice",
    resourceId: invoice.id,
    after: { reason: input.reason },
  });

  return { success: true, invoiceId: invoice.id };
}

/**
 * scheduleContingencyRetry — re-enfileira todas as IN_CONTINGENCY para reprocessamento.
 * Chamado quando SEFAZ volta (via cron ou webhook de status).
 */
export async function scheduleContingencyRetry(
  organizationId: string,
): Promise<{ scheduled: number }> {
  // Recolocar todas IN_CONTINGENCY como PENDING para o worker pegar
  const result = await prisma.invoice.updateMany({
    where: {
      organizationId,
      status: "IN_CONTINGENCY",
    },
    data: {
      status: "PENDING",
    },
  });

  return { scheduled: result.count };
}
