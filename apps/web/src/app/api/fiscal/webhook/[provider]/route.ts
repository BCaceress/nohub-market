/**
 * POST /api/fiscal/webhook/[provider]
 *
 * Recebe webhooks do BaaS fiscal (Focus NFe, TecnoSpeed).
 * Verifica assinatura → parseia payload → atualiza Invoice.
 *
 * Anti-corruption (RN-F07): payload externo morre aqui.
 * RN-F05: atualização de status ocorre no worker de webhook.
 */

import type { FiscalProviderEnum } from "@nohub/db";
import { prisma } from "@nohub/db";
import { type NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/features/fiscal/providers";

const SUPPORTED_PROVIDERS = ["focus_nfe", "tecnospeed"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  const providerKey = provider.toLowerCase();

  if (!SUPPORTED_PROVIDERS.includes(providerKey as (typeof SUPPORTED_PROVIDERS)[number])) {
    return NextResponse.json({ error: "Provider não suportado" }, { status: 400 });
  }

  const providerEnum: FiscalProviderEnum =
    providerKey === "tecnospeed" ? "TECNOSPEED" : "FOCUS_NFE";

  // Ler body raw para verificação de assinatura
  const bodyText = await request.text();

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Extrair providerInvoiceId do payload (campo varia por BaaS)
  const payload = body as Record<string, unknown>;
  const providerInvoiceId = String(payload.id ?? payload.invoice_id ?? payload.nfe_id ?? "");

  if (!providerInvoiceId) {
    return NextResponse.json({ ok: true }); // ack sem processar
  }

  // Buscar Invoice pelo providerInvoiceId
  const invoice = await prisma.invoice.findFirst({
    where: { provider: providerEnum, providerInvoiceId },
  });

  if (!invoice) {
    return NextResponse.json({ ok: true }); // nota não pertence a este sistema
  }

  // Carregar config para chamar o provider
  const fiscalConfig = await prisma.fiscalConfig.findUnique({
    where: { organizationId: invoice.organizationId },
  });

  if (!fiscalConfig) {
    return NextResponse.json({ error: "Config não encontrada" }, { status: 500 });
  }

  // Parsear atualização via anti-corruption layer
  const fiscalProvider = getProvider(fiscalConfig.provider);
  const updateResult = fiscalProvider.parseWebhook(body);

  if (!updateResult.success) {
    return NextResponse.json({ error: updateResult.error }, { status: 400 });
  }

  const update = updateResult.data;

  // Atualizar Invoice conforme resposta
  if (update.status === "authorized" && invoice.status === "SENDING") {
    const now = new Date();
    const cancelDeadline = new Date(now.getTime() + 30 * 60_000);

    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "AUTHORIZED",
          accessKey: update.accessKey,
          protocol: update.protocol,
          xmlIssued: update.xml,
          qrCode: update.qrCode,
          danfeUrl: update.danfeUrl,
          issuedAt: update.processedAt,
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
          source: "PROVIDER_WEBHOOK",
          note: `Autorizada via webhook — chave: ${(update.accessKey ?? "").slice(0, 8)}...`,
          providerResponse: payload as never,
        },
      }),
    ]);
  } else if (update.status === "rejected" && invoice.status === "SENDING") {
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "REJECTED",
          rejectionCode: update.rejectionCode,
          rejectionReason: update.rejectionReason,
        },
      }),
      prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "REJECTED",
          fromStatus: "SENDING",
          toStatus: "REJECTED",
          source: "PROVIDER_WEBHOOK",
          note: `${update.rejectionReason ?? ""} (${update.rejectionCode ?? ""})`,
        },
      }),
    ]);
  } else if (update.status === "denied" && invoice.status === "SENDING") {
    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "DENIED",
          rejectionCode: update.rejectionCode,
          rejectionReason: update.rejectionReason,
        },
      }),
      prisma.invoiceEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "DENIED",
          fromStatus: "SENDING",
          toStatus: "DENIED",
          source: "PROVIDER_WEBHOOK",
          note: `Denegada — ${update.rejectionReason ?? ""} (${update.rejectionCode ?? ""})`,
        },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
