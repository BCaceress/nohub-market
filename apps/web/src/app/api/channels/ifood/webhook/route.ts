/**
 * POST /api/channels/ifood/webhook
 *
 * Recebe notificações do iFood, verifica assinatura e persiste InboundEvent.
 * Processamento assíncrono — retorna 200 imediatamente para o iFood (SLA).
 *
 * iFood requer resposta < 5s. O processamento real é feito pelo outbox.
 */

import { prisma } from "@nohub/db";
import { type NextRequest, NextResponse } from "next/server";
import { ifoodAdapter } from "@/features/sales/adapters/ifood-adapter";
import { enqueueIfoodAccept } from "@/features/sales/outbox/producer";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  // Identificar organização pela slug ou pelo header merchantId
  // Em produção: query ChannelIntegration por merchantId/slug no header
  const merchantId = headers["x-ifood-merchantid"] ?? headers["X-iFoodMerchantId"];
  if (!merchantId) {
    return NextResponse.json({ error: "merchantId ausente" }, { status: 400 });
  }

  const integration = await prisma.channelIntegration.findFirst({
    where: {
      channel: "IFOOD",
      status: "CONNECTED",
    },
    include: { organization: true },
  });

  if (!integration) {
    return NextResponse.json({ error: "Canal iFood não configurado" }, { status: 404 });
  }

  // Verificar assinatura
  const credentials = integration.credentials as Record<string, unknown> | null;
  const secret = String(credentials?.webhookSecret ?? "");
  if (secret && !ifoodAdapter.verifySignature(rawBody, headers, secret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Extrair externalEventId — iFood envia array de events
  const events = Array.isArray(payload) ? payload : [payload];

  for (const event of events) {
    const externalEventId = String(
      (event as Record<string, unknown>).id ??
        (event as Record<string, unknown>).orderId ??
        Date.now(),
    );

    // Idempotência: ignorar se já processamos este evento
    const existing = await prisma.inboundEvent.findFirst({
      where: { channel: "IFOOD", externalEventId },
    });
    if (existing) continue;

    // Gravar InboundEvent
    await prisma.inboundEvent.create({
      data: {
        organizationId: integration.organizationId,
        channel: "IFOOD",
        externalEventId,
        payload: event as never,
      },
    });

    // Para eventos de novo pedido, enfileirar aceite prioritário (RN-V07)
    const eventCode = String((event as Record<string, unknown>).code ?? "");
    if (eventCode === "PLACED" || eventCode === "NEW_ORDER") {
      const orderId = String((event as Record<string, unknown>).orderId ?? "");
      if (orderId) {
        await enqueueIfoodAccept(integration.organizationId, orderId);
      }
    }
  }

  // Sempre retornar 200 rapidamente para o iFood
  return NextResponse.json({ ok: true });
}
