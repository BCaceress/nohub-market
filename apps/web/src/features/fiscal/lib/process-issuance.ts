/**
 * processIssuance — executada pelo worker do Outbox.
 * Lê Invoice + dados do pedido + config fiscal e chama o BaaS via FiscalProvider.
 *
 * Fluxo:
 *   PENDING → SENDING → AUTHORIZED (sucesso síncrono)
 *                     → REJECTED   (BaaS/SEFAZ rejeitou)
 *                     → DENIED     (SEFAZ denegou)
 *   SENDING (timeout) → IN_CONTINGENCY (se habilitado)
 *
 * RN-F02: nunca recalcula imposto — usa taxSnapshot.
 * RN-F05: nenhuma chamada BaaS no request — só no worker.
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import type { InvoiceStatus } from "@nohub/db";
import { getProvider } from "../providers";
import { buildInvoiceFromOrder } from "./build-invoice-from-order";
import { canTransitionInvoice } from "./can-transition-invoice";
import { decryptCertificate, decryptCredentials } from "./crypto-helpers";

/** Prazo de cancelamento padrão — 30 minutos após autorização */
const CANCEL_DEADLINE_MINUTES = 30;

export type ProcessIssuanceResult =
  | { success: true; status: InvoiceStatus }
  | { success: false; error: string; retryable: boolean };

export async function processIssuance(invoiceId: string): Promise<ProcessIssuanceResult> {
  // ── 1. Carregar dados ──────────────────────────────────────────
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: {
        include: {
          items: true,
          payments: { where: { status: "CONFIRMED" } },
          customer: true,
        },
      },
      organization: true,
      location: true,
    },
  });

  if (!invoice) {
    return { success: false, error: "Invoice não encontrada", retryable: false };
  }

  if (!canTransitionInvoice(invoice.status, "SENDING")) {
    return {
      success: false,
      error: `Invoice em estado ${invoice.status} — não pode ir para SENDING`,
      retryable: false,
    };
  }

  // ── 2. Carregar config fiscal + certificado ────────────────────
  const [fiscalConfig, certificate] = await Promise.all([
    prisma.fiscalConfig.findUnique({ where: { organizationId: invoice.organizationId } }),
    prisma.fiscalCertificate.findUnique({ where: { organizationId: invoice.organizationId } }),
  ]);

  if (!fiscalConfig) {
    return { success: false, error: "FiscalConfig não encontrada", retryable: false };
  }
  if (!certificate || !certificate.isActive) {
    return { success: false, error: "Certificado A1 não configurado ou inativo", retryable: false };
  }

  if (!invoice.organization.document) {
    return {
      success: false,
      error: "CNPJ da organização não cadastrado — configure em /app/settings",
      retryable: false,
    };
  }

  // Verificar validade do certificado
  if (certificate.validTo < new Date()) {
    return {
      success: false,
      error: "Certificado A1 vencido — faça upload de um novo certificado",
      retryable: false,
    };
  }

  // ── 3. Decifrar credenciais e certificado ─────────────────────
  const providerCreds = fiscalConfig.providerCredentials
    ? decryptCredentials(Buffer.from(fiscalConfig.providerCredentials))
    : null;

  if (!providerCreds?.token) {
    return { success: false, error: "Token do BaaS não configurado", retryable: false };
  }

  const pfxResult = decryptCertificate(
    Buffer.from(certificate.encryptedPfx),
    Buffer.from(certificate.encryptedPassword),
    Buffer.from(certificate.iv),
  );
  if (!pfxResult.success) {
    return { success: false, error: pfxResult.error, retryable: false };
  }

  // ── 4. Montar InvoiceDraft (sem recalcular — RN-F02) ──────────
  const draftResult = buildInvoiceFromOrder({
    invoiceId: invoice.id,
    org: {
      document: invoice.organization.document,
      legalName: invoice.organization.legalName,
      tradeName: invoice.organization.tradeName ?? undefined,
      taxRegime: invoice.organization.taxRegime ?? undefined,
      street: invoice.organization.street,
      number: invoice.organization.number,
      complement: invoice.organization.complement,
      district: invoice.organization.district,
      city: invoice.organization.city,
      state: invoice.organization.state,
      zipCode: invoice.organization.zipCode,
    },
    location: {
      street: invoice.location.street,
      number: invoice.location.number,
      complement: invoice.location.complement,
      district: invoice.location.district,
      city: invoice.location.city,
      state: invoice.location.state,
      zipCode: invoice.location.zipCode,
    },
    fiscalConfig: {
      nfceSeries: fiscalConfig.nfceSeries,
      nfceCscId: fiscalConfig.nfceCscId,
      nfceCscToken: fiscalConfig.nfceCscToken ? Buffer.from(fiscalConfig.nfceCscToken) : null,
      environment: fiscalConfig.environment,
      provider: fiscalConfig.provider,
    },
    customer: invoice.order.customer
      ? {
          document: invoice.order.customer.document,
          name: invoice.order.customer.name,
          email: invoice.order.customer.email,
        }
      : null,
    items: invoice.order.items.map((i) => ({
      id: i.id,
      productId: i.productId ?? "",
      productNameSnapshot: i.productNameSnapshot,
      skuSnapshot: i.skuSnapshot,
      unitSnapshot: i.unitSnapshot ?? "UN",
      unitPriceSnapshot: i.unitPriceSnapshot,
      discountAmount: i.discountAmount,
      lineTotal: i.lineTotal,
      quantity: i.quantity,
      taxSnapshot: i.taxSnapshot,
    })),
    payments: invoice.order.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
    })),
    total: invoice.order.total,
  });

  if (!draftResult.success) {
    return { success: false, error: draftResult.error, retryable: false };
  }

  // ── 5. Transicionar PENDING → SENDING ─────────────────────────
  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "SENDING",
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    }),
    prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType: "SUBMITTED",
        fromStatus: invoice.status,
        toStatus: "SENDING",
        source: "WORKER",
        note: "Enviando ao BaaS para emissão",
      },
    }),
  ]);

  // ── 6. Chamar BaaS ─────────────────────────────────────────────
  const provider = getProvider(fiscalConfig.provider);
  const providerConfig = {
    environment:
      fiscalConfig.environment === "PRODUCTION"
        ? ("production" as const)
        : ("homologation" as const),
    cnpj: invoice.organization.document.replace(/\D/g, ""),
    token: providerCreds.token as string,
    csc: fiscalConfig.nfceCscToken ? Buffer.from(fiscalConfig.nfceCscToken).toString("utf8") : "",
    cscId: fiscalConfig.nfceCscId ?? "",
  };

  const result = await provider.issueNfce(
    draftResult.draft,
    { pfxBase64: pfxResult.pfxBase64, password: pfxResult.password },
    providerConfig,
  );

  // ── 7. Processar resultado ─────────────────────────────────────
  if (result.success) {
    const { data } = result;
    const now = new Date();
    const cancelDeadline = new Date(now.getTime() + CANCEL_DEADLINE_MINUTES * 60_000);

    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "AUTHORIZED",
          accessKey: data.accessKey,
          protocol: data.protocol,
          providerInvoiceId: data.providerInvoiceId,
          xmlIssued: data.xml,
          qrCode: data.qrCode,
          danfeUrl: data.danfeUrl,
          issuedAt: data.issuedAt,
          authorizedAt: now,
          cancelDeadline,
          totalTax: draftResult.draft.totalTax,
        },
      }),
      prisma.invoiceEvent.create({
        data: {
          invoiceId,
          eventType: "AUTHORIZED",
          fromStatus: "SENDING",
          toStatus: "AUTHORIZED",
          source: "WORKER",
          note: `Autorizada — chave: ${data.accessKey.slice(0, 8)}...`,
        },
      }),
    ]);

    await writeAudit({
      organizationId: invoice.organizationId,
      actorId: "system",
      action: "invoice.authorized",
      resourceType: "Invoice",
      resourceId: invoiceId,
      after: { accessKey: data.accessKey, protocol: data.protocol },
    });

    return { success: true, status: "AUTHORIZED" };
  }

  // BaaS retornou erro
  const isRetryable = result.retryable ?? true;
  const newStatus: InvoiceStatus = result.code?.startsWith("5")
    ? "DENIED" // 5xx SEFAZ = denegada (não reemitível)
    : "REJECTED"; // outros = rejeitada (reemitível)

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        rejectionReason: result.error,
        rejectionCode: result.code,
      },
    }),
    prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType: newStatus === "DENIED" ? "DENIED" : "REJECTED",
        fromStatus: "SENDING",
        toStatus: newStatus,
        source: "WORKER",
        note: `${result.error} (${result.code ?? "sem código"})`,
      },
    }),
  ]);

  return {
    success: false,
    error: result.error,
    retryable: isRetryable && newStatus === "REJECTED",
  };
}
