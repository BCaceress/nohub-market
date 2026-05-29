/**
 * requestCancellation — cancela NFCe dentro do prazo (RN-F12).
 *
 * Fluxo:
 *   AUTHORIZED → CANCELED (se dentro do cancelDeadline e pedido já cancelado)
 *
 * RN-F12:
 *   - Só permite cancelar se o Order correspondente já estiver CANCELED.
 *   - Prazo: cancelDeadline (30 min após autorização) — configurado em processIssuance.
 *   - Motivo mínimo: 15 caracteres (exigência SEFAZ).
 *   - Após cancelamento: xmlCanceled gravado na Invoice; protocolo no InvoiceEvent.
 */

import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";
import { getProvider } from "../providers";
import { canTransitionInvoice } from "./can-transition-invoice";
import { decryptCertificate, decryptCredentials } from "./crypto-helpers";

export type RequestCancellationInput = {
  organizationId: string;
  invoiceId: string;
  reason: string;
  actorId: string;
};

export type RequestCancellationResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export async function requestCancellation(
  input: RequestCancellationInput,
): Promise<RequestCancellationResult> {
  // Validar motivo mínimo (SEFAZ exige 15 caracteres)
  if (!input.reason || input.reason.trim().length < 15) {
    return {
      success: false,
      error: "Motivo do cancelamento deve ter pelo menos 15 caracteres",
      code: "REASON_TOO_SHORT",
    };
  }

  // ── 1. Carregar Invoice ────────────────────────────────────────
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { order: true },
  });

  if (!invoice || invoice.organizationId !== input.organizationId) {
    return { success: false, error: "Invoice não encontrada", code: "NOT_FOUND" };
  }

  if (!canTransitionInvoice(invoice.status, "CANCELED")) {
    return {
      success: false,
      error: `Invoice em estado ${invoice.status} — não pode ser cancelada`,
      code: "INVALID_STATUS",
    };
  }

  // ── 2. Verificar prazo ─────────────────────────────────────────
  if (!invoice.cancelDeadline || new Date() > invoice.cancelDeadline) {
    return {
      success: false,
      error: "Prazo de cancelamento expirado (30 min após autorização)",
      code: "DEADLINE_EXPIRED",
    };
  }

  // ── 3. Verificar Order cancelada (RN-F12) ─────────────────────
  if (invoice.order.status !== "CANCELED") {
    return {
      success: false,
      error: "O pedido deve ser cancelado antes de cancelar a NFCe (RN-F12)",
      code: "ORDER_NOT_CANCELED",
    };
  }

  if (!invoice.accessKey) {
    return {
      success: false,
      error: "Invoice sem chave de acesso — não pode cancelar",
      code: "NO_ACCESS_KEY",
    };
  }

  // ── 4. Carregar config + certificado ──────────────────────────
  const [fiscalConfig, certificate, org] = await Promise.all([
    prisma.fiscalConfig.findUnique({ where: { organizationId: input.organizationId } }),
    prisma.fiscalCertificate.findUnique({ where: { organizationId: input.organizationId } }),
    prisma.organization.findUnique({ where: { id: input.organizationId } }),
  ]);

  if (!fiscalConfig) {
    return { success: false, error: "FiscalConfig não encontrada", code: "NO_CONFIG" };
  }
  if (!certificate?.isActive) {
    return { success: false, error: "Certificado A1 não configurado ou inativo", code: "NO_CERT" };
  }

  // ── 5. Decifrar credenciais + certificado ─────────────────────
  const providerCreds = fiscalConfig.providerCredentials
    ? decryptCredentials(Buffer.from(fiscalConfig.providerCredentials))
    : null;

  if (!providerCreds?.token) {
    return { success: false, error: "Token do BaaS não configurado", code: "NO_TOKEN" };
  }

  const pfxResult = decryptCertificate(
    Buffer.from(certificate.encryptedPfx),
    Buffer.from(certificate.encryptedPassword),
    Buffer.from(certificate.iv),
  );
  if (!pfxResult.success) {
    return { success: false, error: pfxResult.error, code: "CERT_DECRYPT_FAILED" };
  }

  // ── 6. Gravar evento CANCEL_REQUESTED ─────────────────────────
  await prisma.invoiceEvent.create({
    data: {
      invoiceId: invoice.id,
      eventType: "CANCEL_REQUESTED",
      fromStatus: invoice.status,
      toStatus: "CANCELED",
      actorId: input.actorId,
      source: "INTERNAL",
      note: `Cancelamento solicitado: ${input.reason.slice(0, 100)}`,
    },
  });

  // ── 7. Chamar BaaS ─────────────────────────────────────────────
  const provider = getProvider(fiscalConfig.provider);
  const providerConfig = {
    environment:
      fiscalConfig.environment === "PRODUCTION"
        ? ("production" as const)
        : ("homologation" as const),
    cnpj: org?.document?.replace(/\D/g, "") ?? "",
    token: providerCreds.token as string,
    csc: fiscalConfig.nfceCscToken ? Buffer.from(fiscalConfig.nfceCscToken).toString("utf8") : "",
    cscId: fiscalConfig.nfceCscId ?? "",
  };

  const cancelResult = await provider.cancelNfce(
    invoice.accessKey,
    input.reason.trim(),
    { pfxBase64: pfxResult.pfxBase64, password: pfxResult.password },
    providerConfig,
  );

  if (!cancelResult.success) {
    // Log falha
    await prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice.id,
        eventType: "REJECTED",
        fromStatus: "AUTHORIZED",
        toStatus: "AUTHORIZED",
        source: "WORKER",
        note: `Falha no cancelamento: ${cancelResult.error}`,
      },
    });
    return { success: false, error: cancelResult.error, code: "BAAS_ERROR" };
  }

  // ── 8. Atualizar Invoice → CANCELED ───────────────────────────
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "CANCELED",
        canceledAt: cancelResult.data.canceledAt,
        xmlCanceled: cancelResult.data.xml,
        cancelReason: input.reason.trim(),
      },
    }),
    prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice.id,
        eventType: "CANCELED",
        fromStatus: "AUTHORIZED",
        toStatus: "CANCELED",
        actorId: input.actorId,
        source: "INTERNAL",
        note: `Cancelada — protocolo: ${cancelResult.data.protocol}`,
        providerResponse: { protocol: cancelResult.data.protocol },
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "invoice.canceled",
    resourceType: "Invoice",
    resourceId: invoice.id,
    after: {
      accessKey: invoice.accessKey,
      protocol: cancelResult.data.protocol,
      reason: input.reason,
    },
  });

  return { success: true };
}
