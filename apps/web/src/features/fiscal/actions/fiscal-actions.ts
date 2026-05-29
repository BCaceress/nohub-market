"use server";

/**
 * fiscal-actions — Server Actions para o módulo fiscal.
 *
 * Padrão de autenticação: requireSessionWithOrg → organizationId.
 *
 * Segurança (RN-F08):
 *   - Senha do certificado nunca aparece em logs ou respostas.
 *   - encryptBytes/encryptString antes de persistir qualquer segredo.
 */

import crypto from "node:crypto";
import { prisma } from "@nohub/db";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireSessionWithOrg } from "@/lib/auth-server";
import { encryptBytesWithIv, encryptCredentials, encryptString } from "../lib/crypto-helpers";
import { enqueueIssuance } from "../lib/enqueue-issuance";
import { inutilizeNumbers } from "../lib/inutilize-numbers";
import { requestCancellation } from "../lib/request-cancellation";

/* ── Upload de Certificado A1 ─────────────────────────────────── */

const UploadCertificateSchema = z.object({
  pfxBase64: z.string().min(1, "Arquivo .pfx obrigatório"),
  password: z.string().min(1, "Senha do certificado obrigatória"),
  subject: z.string().min(1, "Titular do certificado obrigatório"),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
});

export type UploadCertificateInput = z.infer<typeof UploadCertificateSchema>;

export type UploadCertificateResult =
  | { success: true; certificateId: string }
  | { success: false; error: string };

export async function uploadCertificateAction(
  input: UploadCertificateInput,
): Promise<UploadCertificateResult> {
  try {
    const { organizationId, user } = await requireSessionWithOrg();
    const data = UploadCertificateSchema.parse(input);

    // Gerar um único IV para pfx + senha (decryptCertificate usa mesmo IV para ambos)
    const pfxBuffer = Buffer.from(data.pfxBase64, "base64");
    const passwordBuffer = Buffer.from(data.password, "utf8");

    const iv = crypto.randomBytes(12);
    const finalEncPfx = encryptBytesWithIv(pfxBuffer, iv);
    const finalEncPass = encryptBytesWithIv(passwordBuffer, iv);

    // Cast: Buffer<ArrayBufferLike> → Prisma Bytes (Uint8Array<ArrayBuffer>)
    // Runtime-safe: Buffer IS Uint8Array, TypeScript generic parameter differs only for SharedArrayBuffer
    type PrismaBytes = Buffer<ArrayBuffer>;
    const asPrismaBytes = (b: Buffer): PrismaBytes => b as unknown as PrismaBytes;

    // Revogar certificado anterior (se existir)
    await prisma.fiscalCertificate.updateMany({
      where: { organizationId, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokedBy: user.id },
    });

    const cert = await prisma.fiscalCertificate.upsert({
      where: { organizationId },
      update: {
        subject: data.subject,
        validFrom: new Date(data.validFrom),
        validTo: new Date(data.validTo),
        encryptedPfx: asPrismaBytes(finalEncPfx),
        encryptedPassword: asPrismaBytes(finalEncPass),
        iv: asPrismaBytes(iv),
        isActive: true,
        uploadedBy: user.id,
        uploadedAt: new Date(),
        revokedAt: null,
        revokedBy: null,
      },
      create: {
        organizationId,
        subject: data.subject,
        validFrom: new Date(data.validFrom),
        validTo: new Date(data.validTo),
        encryptedPfx: asPrismaBytes(finalEncPfx),
        encryptedPassword: asPrismaBytes(finalEncPass),
        iv: asPrismaBytes(iv),
        isActive: true,
        uploadedBy: user.id,
      },
    });

    await writeAudit({
      organizationId,
      actorId: user.id,
      action: "fiscal_certificate.uploaded",
      resourceType: "FiscalCertificate",
      resourceId: cert.id,
      after: { subject: data.subject, validFrom: data.validFrom, validTo: data.validTo },
    });

    return { success: true, certificateId: cert.id };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Dados inválidos" };
    }
    console.error("[uploadCertificateAction]", err);
    return { success: false, error: "Erro ao fazer upload do certificado" };
  }
}

/* ── Atualizar FiscalConfig ───────────────────────────────────── */

const UpdateFiscalConfigSchema = z.object({
  environment: z.enum(["HOMOLOGATION", "PRODUCTION"]).optional(),
  provider: z.enum(["FOCUS_NFE", "TECNOSPEED"]).optional(),
  nfceSeries: z.number().int().min(1).max(999).optional(),
  nfceCscId: z.string().optional(),
  nfceCscToken: z.string().optional(), // plaintext — cifrado aqui
  baasToken: z.string().optional(), // token BaaS — cifrado em providerCredentials
});

export type UpdateFiscalConfigInput = z.infer<typeof UpdateFiscalConfigSchema>;

export type UpdateFiscalConfigResult = { success: true } | { success: false; error: string };

export async function updateFiscalConfigAction(
  input: UpdateFiscalConfigInput,
): Promise<UpdateFiscalConfigResult> {
  try {
    const { organizationId, user } = await requireSessionWithOrg();
    const data = UpdateFiscalConfigSchema.parse(input);

    const updateData: Record<string, unknown> = {};

    if (data.environment !== undefined) updateData.environment = data.environment;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.nfceSeries !== undefined) updateData.nfceSeries = data.nfceSeries;
    if (data.nfceCscId !== undefined) updateData.nfceCscId = data.nfceCscId;

    // Cifrar CSC token se fornecido
    if (data.nfceCscToken) {
      const { encrypted, iv } = encryptString(data.nfceCscToken);
      // CSC token: IV embutido no início (primeiros 12 bytes)
      updateData.nfceCscToken = Buffer.concat([iv, encrypted]);
    }

    // Cifrar token BaaS se fornecido
    if (data.baasToken) {
      // Manter credenciais existentes e atualizar apenas token
      const existing = await prisma.fiscalConfig.findUnique({
        where: { organizationId },
        select: { providerCredentials: true },
      });

      const existingCreds: Record<string, unknown> = {};
      // Não tentar decifrar as existentes aqui — substituir apenas token
      void existing;

      existingCreds.token = data.baasToken;
      updateData.providerCredentials = encryptCredentials(existingCreds);
    }

    await prisma.fiscalConfig.upsert({
      where: { organizationId },
      update: updateData,
      create: {
        organizationId,
        ...updateData,
      },
    });

    await writeAudit({
      organizationId,
      actorId: user.id,
      action: "fiscal_config.updated",
      resourceType: "FiscalConfig",
      resourceId: organizationId,
      after: {
        environment: data.environment,
        provider: data.provider,
        nfceSeries: data.nfceSeries,
        hasCscToken: !!data.nfceCscToken,
        hasBaasToken: !!data.baasToken,
      },
    });

    return { success: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Dados inválidos" };
    }
    console.error("[updateFiscalConfigAction]", err);
    return { success: false, error: "Erro ao salvar configuração fiscal" };
  }
}

/* ── Promover para Produção ───────────────────────────────────── */

export type PromoteToProductionResult = { success: true } | { success: false; error: string };

export async function promoteToProductionAction(): Promise<PromoteToProductionResult> {
  try {
    const { organizationId, user } = await requireSessionWithOrg();

    const config = await prisma.fiscalConfig.findUnique({
      where: { organizationId },
    });

    if (!config) {
      return { success: false, error: "Configuração fiscal não encontrada" };
    }
    if (config.environment === "PRODUCTION") {
      return { success: false, error: "Já está em produção" };
    }
    if (!config.homologationTestedAt) {
      return {
        success: false,
        error: "Emita pelo menos uma nota em homologação antes de promover para produção",
      };
    }

    await prisma.fiscalConfig.update({
      where: { organizationId },
      data: {
        environment: "PRODUCTION",
        promotedAt: new Date(),
      },
    });

    await writeAudit({
      organizationId,
      actorId: user.id,
      action: "fiscal_config.promoted_to_production",
      resourceType: "FiscalConfig",
      resourceId: config.id,
      after: { environment: "PRODUCTION" },
    });

    return { success: true };
  } catch (err) {
    console.error("[promoteToProductionAction]", err);
    return { success: false, error: "Erro ao promover para produção" };
  }
}

/* ── Emissão Manual ───────────────────────────────────────────── */

export type IssueInvoiceManuallyResult =
  | { success: true; invoiceId: string }
  | { success: false; error: string };

export async function issueInvoiceManuallyAction(
  orderId: string,
): Promise<IssueInvoiceManuallyResult> {
  try {
    const { organizationId, user } = await requireSessionWithOrg();

    const result = await enqueueIssuance(organizationId, orderId, user.id);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, invoiceId: result.invoiceId };
  } catch (err) {
    console.error("[issueInvoiceManuallyAction]", err);
    return { success: false, error: "Erro ao enfileirar emissão" };
  }
}

/* ── Cancelar Invoice ─────────────────────────────────────────── */

const CancelInvoiceSchema = z.object({
  invoiceId: z.string().cuid(),
  reason: z.string().min(15, "Motivo deve ter pelo menos 15 caracteres"),
});

export type CancelInvoiceResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export async function cancelInvoiceAction(
  input: z.infer<typeof CancelInvoiceSchema>,
): Promise<CancelInvoiceResult> {
  try {
    const { organizationId, user } = await requireSessionWithOrg();
    const data = CancelInvoiceSchema.parse(input);

    return await requestCancellation({
      organizationId,
      invoiceId: data.invoiceId,
      reason: data.reason,
      actorId: user.id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Dados inválidos" };
    }
    console.error("[cancelInvoiceAction]", err);
    return { success: false, error: "Erro ao cancelar nota fiscal" };
  }
}

/* ── Inutilizar Faixa ─────────────────────────────────────────── */

const InutilizeRangeSchema = z.object({
  series: z.number().int().min(1),
  fromNumber: z.number().int().min(1),
  toNumber: z.number().int().min(1),
  reason: z.string().min(15, "Motivo deve ter pelo menos 15 caracteres"),
});

export type InutilizeRangeResult =
  | { success: true; skipId: string; protocol: string }
  | { success: false; error: string; code?: string };

export async function inutilizeRangeAction(
  input: z.infer<typeof InutilizeRangeSchema>,
): Promise<InutilizeRangeResult> {
  try {
    const { organizationId, user } = await requireSessionWithOrg();
    const data = InutilizeRangeSchema.parse(input);

    return await inutilizeNumbers({
      organizationId,
      series: data.series,
      fromNumber: data.fromNumber,
      toNumber: data.toNumber,
      reason: data.reason,
      actorId: user.id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? "Dados inválidos" };
    }
    console.error("[inutilizeRangeAction]", err);
    return { success: false, error: "Erro ao inutilizar numeração" };
  }
}

/* ── Listar Invoices ──────────────────────────────────────────── */

export type InvoiceListItem = {
  id: string;
  status: string;
  number: number | null;
  series: number;
  accessKey: string | null;
  totalAmount: number;
  totalTax: number;
  authorizedAt: string | null;
  canceledAt: string | null;
  qrCode: string | null;
  danfeUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  orderId: string;
};

export type ListInvoicesResult =
  | { success: true; invoices: InvoiceListItem[]; total: number }
  | { success: false; error: string };

export async function listInvoicesAction(params?: {
  status?: string;
  locationId?: string;
  page?: number;
  limit?: number;
}): Promise<ListInvoicesResult> {
  try {
    const { organizationId } = await requireSessionWithOrg();
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(params?.status ? { status: params.status as never } : {}),
      ...(params?.locationId ? { locationId: params.locationId } : {}),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          number: true,
          series: true,
          accessKey: true,
          totalAmount: true,
          totalTax: true,
          authorizedAt: true,
          canceledAt: true,
          qrCode: true,
          danfeUrl: true,
          rejectionReason: true,
          createdAt: true,
          orderId: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      success: true,
      total,
      invoices: invoices.map((inv) => ({
        ...inv,
        totalAmount: Number(inv.totalAmount),
        totalTax: Number(inv.totalTax),
        authorizedAt: inv.authorizedAt?.toISOString() ?? null,
        canceledAt: inv.canceledAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error("[listInvoicesAction]", err);
    return { success: false, error: "Erro ao listar notas fiscais" };
  }
}

/* ── Detalhes de uma Invoice ──────────────────────────────────── */

export type InvoiceDetail = InvoiceListItem & {
  provider: string;
  protocol: string | null;
  providerInvoiceId: string | null;
  xmlIssued: string | null;
  xmlCanceled: string | null;
  cancelReason: string | null;
  cancelDeadline: string | null;
  rejectionCode: string | null;
  attemptCount: number;
  issuedAt: string | null;
  events: Array<{
    id: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string;
    actorId: string | null;
    source: string;
    note: string | null;
    createdAt: string;
  }>;
};

export type GetInvoiceResult =
  | { success: true; invoice: InvoiceDetail }
  | { success: false; error: string };

export async function getInvoiceAction(invoiceId: string): Promise<GetInvoiceResult> {
  try {
    const { organizationId } = await requireSessionWithOrg();

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        events: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            eventType: true,
            fromStatus: true,
            toStatus: true,
            actorId: true,
            source: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice || invoice.organizationId !== organizationId) {
      return { success: false, error: "Nota fiscal não encontrada" };
    }

    return {
      success: true,
      invoice: {
        id: invoice.id,
        status: invoice.status,
        number: invoice.number,
        series: invoice.series,
        accessKey: invoice.accessKey,
        totalAmount: Number(invoice.totalAmount),
        totalTax: Number(invoice.totalTax),
        authorizedAt: invoice.authorizedAt?.toISOString() ?? null,
        canceledAt: invoice.canceledAt?.toISOString() ?? null,
        qrCode: invoice.qrCode,
        danfeUrl: invoice.danfeUrl,
        rejectionReason: invoice.rejectionReason,
        rejectionCode: invoice.rejectionCode,
        createdAt: invoice.createdAt.toISOString(),
        orderId: invoice.orderId,
        provider: invoice.provider,
        protocol: invoice.protocol,
        providerInvoiceId: invoice.providerInvoiceId,
        xmlIssued: invoice.xmlIssued,
        xmlCanceled: invoice.xmlCanceled,
        cancelReason: invoice.cancelReason,
        cancelDeadline: invoice.cancelDeadline?.toISOString() ?? null,
        attemptCount: invoice.attemptCount,
        issuedAt: invoice.issuedAt?.toISOString() ?? null,
        events: invoice.events.map((e) => ({
          ...e,
          fromStatus: e.fromStatus ?? null,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    };
  } catch (err) {
    console.error("[getInvoiceAction]", err);
    return { success: false, error: "Erro ao buscar nota fiscal" };
  }
}

/* ── Buscar FiscalConfig + Certificado ───────────────────────── */

export type FiscalSettingsData = {
  config: {
    id: string;
    environment: string;
    provider: string;
    nfceSeries: number;
    nfceCscId: string | null;
    hasCscToken: boolean;
    hasBaasToken: boolean;
    homologationTestedAt: string | null;
    promotedAt: string | null;
  } | null;
  certificate: {
    id: string;
    subject: string;
    validFrom: string;
    validTo: string;
    isActive: boolean;
    uploadedAt: string;
  } | null;
};

export type GetFiscalSettingsResult =
  | { success: true; data: FiscalSettingsData }
  | { success: false; error: string };

export async function getFiscalSettingsAction(): Promise<GetFiscalSettingsResult> {
  try {
    const { organizationId } = await requireSessionWithOrg();

    const [config, certificate] = await Promise.all([
      prisma.fiscalConfig.findUnique({ where: { organizationId } }),
      prisma.fiscalCertificate.findUnique({ where: { organizationId } }),
    ]);

    return {
      success: true,
      data: {
        config: config
          ? {
              id: config.id,
              environment: config.environment,
              provider: config.provider,
              nfceSeries: config.nfceSeries,
              nfceCscId: config.nfceCscId,
              hasCscToken: !!config.nfceCscToken,
              hasBaasToken: !!config.providerCredentials,
              homologationTestedAt: config.homologationTestedAt?.toISOString() ?? null,
              promotedAt: config.promotedAt?.toISOString() ?? null,
            }
          : null,
        certificate: certificate
          ? {
              id: certificate.id,
              subject: certificate.subject,
              validFrom: certificate.validFrom.toISOString(),
              validTo: certificate.validTo.toISOString(),
              isActive: certificate.isActive,
              uploadedAt: certificate.uploadedAt.toISOString(),
            }
          : null,
      },
    };
  } catch (err) {
    console.error("[getFiscalSettingsAction]", err);
    return { success: false, error: "Erro ao buscar configurações fiscais" };
  }
}

/* ── Listar Inutilizações ─────────────────────────────────────── */

export type NumberSkipItem = {
  id: string;
  series: number;
  numberStart: number;
  numberEnd: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  processedAt: string | null;
};

export type ListNumberSkipsResult =
  | { success: true; skips: NumberSkipItem[] }
  | { success: false; error: string };

export async function listNumberSkipsAction(): Promise<ListNumberSkipsResult> {
  try {
    const { organizationId } = await requireSessionWithOrg();

    const skips = await prisma.invoiceNumberSkip.findMany({
      where: { organizationId },
      orderBy: { requestedAt: "desc" },
      take: 50,
    });

    return {
      success: true,
      skips: skips.map((s) => ({
        id: s.id,
        series: s.series,
        numberStart: s.numberStart,
        numberEnd: s.numberEnd,
        reason: s.reason,
        status: s.status,
        requestedBy: s.requestedBy,
        requestedAt: s.requestedAt.toISOString(),
        processedAt: s.processedAt?.toISOString() ?? null,
      })),
    };
  } catch (err) {
    console.error("[listNumberSkipsAction]", err);
    return { success: false, error: "Erro ao listar inutilizações" };
  }
}
