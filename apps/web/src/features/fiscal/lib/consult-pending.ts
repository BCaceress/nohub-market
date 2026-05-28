/**
 * consultPending — polling de fallback para invoices presas em SENDING.
 *
 * Quando o BaaS não responde via webhook (timeout, falha de entrega),
 * este worker consulta o status diretamente.
 *
 * RN-F05: só executado no worker (Cron), nunca no request.
 *
 * Fluxo:
 *   - Busca invoices com status SENDING há mais de STUCK_THRESHOLD_MINUTES
 *   - Consulta BaaS para cada uma
 *   - Atualiza conforme resposta: AUTHORIZED / REJECTED / DENIED
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import type { InvoiceStatus } from "@nohub/db";
import { getProvider } from "../providers";
import { decryptCertificate, decryptCredentials } from "./crypto-helpers";

/** Invoices presas em SENDING há mais de X minutos são consultadas */
const STUCK_THRESHOLD_MINUTES = 10;
const CANCEL_DEADLINE_MINUTES = 30;

export type ConsultPendingResult = {
  checked: number;
  resolved: number;
  errors: number;
};

export async function consultPendingInvoices(): Promise<ConsultPendingResult> {
  const stuckSince = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60_000);

  const stuckInvoices = await prisma.invoice.findMany({
    where: {
      status: "SENDING",
      lastAttemptAt: { lte: stuckSince },
    },
    include: {
      organization: true,
    },
    take: 50,
  });

  const result: ConsultPendingResult = { checked: 0, resolved: 0, errors: 0 };

  for (const invoice of stuckInvoices) {
    result.checked++;

    try {
      // Carregar config + certificado
      const [fiscalConfig, certificate] = await Promise.all([
        prisma.fiscalConfig.findUnique({ where: { organizationId: invoice.organizationId } }),
        prisma.fiscalCertificate.findUnique({ where: { organizationId: invoice.organizationId } }),
      ]);

      if (!fiscalConfig || !certificate) {
        result.errors++;
        continue;
      }

      const providerCreds = fiscalConfig.providerCredentials
        ? decryptCredentials(Buffer.from(fiscalConfig.providerCredentials))
        : null;

      if (!providerCreds?.token || !invoice.providerInvoiceId || !invoice.organization.document) {
        result.errors++;
        continue;
      }

      const providerConfig = {
        environment:
          fiscalConfig.environment === "PRODUCTION"
            ? ("production" as const)
            : ("homologation" as const),
        cnpj: invoice.organization.document.replace(/\D/g, ""),
        token: providerCreds.token as string,
        csc: fiscalConfig.nfceCscToken
          ? Buffer.from(fiscalConfig.nfceCscToken).toString("utf8")
          : "",
        cscId: fiscalConfig.nfceCscId ?? "",
      };

      const provider = getProvider(fiscalConfig.provider);
      const statusResult = await provider.consultStatus(invoice.providerInvoiceId, providerConfig);

      if (!statusResult.success) {
        result.errors++;
        continue;
      }

      const providerStatus = statusResult.data;

      if (providerStatus.status === "pending") {
        // Ainda processando — checar se deve entrar em contingência
        continue;
      }

      if (providerStatus.status === "not_found") {
        // BaaS perdeu a nota — rejeitar para reemissão
        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "REJECTED",
              rejectionReason: "Nota não encontrada no BaaS após polling",
            },
          }),
          prisma.invoiceEvent.create({
            data: {
              invoiceId: invoice.id,
              eventType: "REJECTED",
              fromStatus: "SENDING",
              toStatus: "REJECTED",
              source: "WORKER",
              note: "Não encontrada no BaaS — re-emitir",
            },
          }),
        ]);
        result.resolved++;
        continue;
      }

      if (providerStatus.status === "authorized") {
        const now = new Date();
        const cancelDeadline = new Date(now.getTime() + CANCEL_DEADLINE_MINUTES * 60_000);

        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "AUTHORIZED",
              accessKey: providerStatus.accessKey,
              protocol: providerStatus.protocol,
              authorizedAt: now,
              cancelDeadline,
            },
          }),
          prisma.invoiceEvent.create({
            data: {
              invoiceId: invoice.id,
              eventType: "AUTHORIZED",
              fromStatus: "SENDING",
              toStatus: "AUTHORIZED",
              source: "WORKER",
              note: `Autorizada via polling — chave: ${providerStatus.accessKey.slice(0, 8)}...`,
            },
          }),
        ]);

        await writeAudit({
          organizationId: invoice.organizationId,
          actorId: "system",
          action: "invoice.authorized_via_polling",
          resourceType: "Invoice",
          resourceId: invoice.id,
          after: { accessKey: providerStatus.accessKey },
        });

        result.resolved++;
        continue;
      }

      // rejected ou denied
      const newStatus: InvoiceStatus = providerStatus.status === "denied" ? "DENIED" : "REJECTED";
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: newStatus,
            rejectionCode: providerStatus.code,
            rejectionReason: providerStatus.reason,
          },
        }),
        prisma.invoiceEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: newStatus === "DENIED" ? "DENIED" : "REJECTED",
            fromStatus: "SENDING",
            toStatus: newStatus,
            source: "WORKER",
            note: `${providerStatus.reason} (${providerStatus.code}) — via polling`,
          },
        }),
      ]);
      result.resolved++;
    } catch (err) {
      console.error(`[consultPending] Erro ao consultar invoice ${invoice.id}:`, err);
      result.errors++;
    }
  }

  return result;
}
