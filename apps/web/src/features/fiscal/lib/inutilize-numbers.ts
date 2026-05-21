/**
 * inutilizeNumbers — inutiliza faixa de numeração de NF-e/NFC-e.
 *
 * Usado quando notas são puladas por falha, contingência ou outros motivos.
 * Registra InvoiceNumberSkip + chama BaaS para comunicar SEFAZ.
 *
 * RN: faixa deve ser contínua e não pode se sobrepor a faixas já inutilizadas.
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import { getProvider } from "../providers";
import { decryptCertificate, decryptCredentials } from "./crypto-helpers";

export type InutilizeNumbersInput = {
  organizationId: string;
  series: number;
  fromNumber: number;
  toNumber: number;
  reason: string;
  actorId: string;
};

export type InutilizeNumbersResult =
  | { success: true; skipId: string; protocol: string }
  | { success: false; error: string; code?: string };

export async function inutilizeNumbers(
  input: InutilizeNumbersInput,
): Promise<InutilizeNumbersResult> {
  const { organizationId, series, fromNumber, toNumber, reason, actorId } = input;

  // Validações básicas
  if (fromNumber > toNumber) {
    return { success: false, error: "Número inicial maior que o final", code: "INVALID_RANGE" };
  }
  if (fromNumber < 1 || toNumber > 999_999_999) {
    return { success: false, error: "Faixa de numeração inválida", code: "INVALID_RANGE" };
  }
  if (!reason || reason.trim().length < 15) {
    return {
      success: false,
      error: "Motivo deve ter pelo menos 15 caracteres",
      code: "REASON_TOO_SHORT",
    };
  }

  // Verificar sobreposição com faixas já inutilizadas
  const overlap = await prisma.invoiceNumberSkip.findFirst({
    where: {
      organizationId,
      series,
      status: { in: ["REQUESTED", "INUTILIZED"] },
      OR: [{ numberStart: { lte: toNumber }, numberEnd: { gte: fromNumber } }],
    },
  });

  if (overlap) {
    return {
      success: false,
      error: `Faixa conflita com inutilização existente (${overlap.numberStart}–${overlap.numberEnd})`,
      code: "RANGE_OVERLAP",
    };
  }

  // Criar registro REQUESTED
  const skip = await prisma.invoiceNumberSkip.create({
    data: {
      organizationId,
      series,
      numberStart: fromNumber,
      numberEnd: toNumber,
      reason: reason.trim(),
      status: "REQUESTED",
      requestedBy: actorId,
    },
  });

  // Carregar config + certificado para chamar BaaS
  const [fiscalConfig, certificate, org] = await Promise.all([
    prisma.fiscalConfig.findUnique({ where: { organizationId } }),
    prisma.fiscalCertificate.findUnique({ where: { organizationId } }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);

  if (!fiscalConfig) {
    await prisma.invoiceNumberSkip.update({
      where: { id: skip.id },
      data: { status: "REJECTED", providerResponse: { error: "FiscalConfig não encontrada" } },
    });
    return { success: false, error: "FiscalConfig não encontrada", code: "NO_CONFIG" };
  }
  if (!certificate || !certificate.isActive) {
    await prisma.invoiceNumberSkip.update({
      where: { id: skip.id },
      data: { status: "REJECTED", providerResponse: { error: "Certificado inativo" } },
    });
    return { success: false, error: "Certificado A1 não configurado ou inativo", code: "NO_CERT" };
  }

  const providerCreds = fiscalConfig.providerCredentials
    ? decryptCredentials(Buffer.from(fiscalConfig.providerCredentials))
    : null;

  if (!providerCreds?.token) {
    await prisma.invoiceNumberSkip.update({
      where: { id: skip.id },
      data: { status: "REJECTED", providerResponse: { error: "Token BaaS não configurado" } },
    });
    return { success: false, error: "Token do BaaS não configurado", code: "NO_TOKEN" };
  }

  const pfxResult = decryptCertificate(
    Buffer.from(certificate.encryptedPfx),
    Buffer.from(certificate.encryptedPassword),
    Buffer.from(certificate.iv),
  );
  if (!pfxResult.success) {
    await prisma.invoiceNumberSkip.update({
      where: { id: skip.id },
      data: { status: "REJECTED", providerResponse: { error: pfxResult.error } },
    });
    return { success: false, error: pfxResult.error, code: "CERT_DECRYPT_FAILED" };
  }

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

  // Chamar BaaS
  const provider = getProvider(fiscalConfig.provider);
  const inutResult = await provider.inutilizeNumbers(
    series,
    fromNumber,
    toNumber,
    reason.trim(),
    { pfxBase64: pfxResult.pfxBase64, password: pfxResult.password },
    providerConfig,
  );

  if (!inutResult.success) {
    await prisma.invoiceNumberSkip.update({
      where: { id: skip.id },
      data: { status: "REJECTED", providerResponse: { error: inutResult.error } },
    });
    return { success: false, error: inutResult.error, code: "BAAS_ERROR" };
  }

  // Marcar como INUTILIZED
  await prisma.invoiceNumberSkip.update({
    where: { id: skip.id },
    data: {
      status: "INUTILIZED",
      processedAt: inutResult.data.processedAt,
      providerResponse: { protocol: inutResult.data.protocol },
    },
  });

  await writeAudit({
    organizationId,
    actorId,
    action: "invoice_number_skip.created",
    resourceType: "InvoiceNumberSkip",
    resourceId: skip.id,
    after: { series, fromNumber, toNumber, protocol: inutResult.data.protocol },
  });

  return { success: true, skipId: skip.id, protocol: inutResult.data.protocol };
}
