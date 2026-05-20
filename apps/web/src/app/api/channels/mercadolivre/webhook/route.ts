/**
 * POST /api/channels/mercadolivre/webhook
 *
 * Recebe notificações de pedidos ML (orders_v2, payments).
 * ML envia notificações leves — o pedido completo é buscado via API pelo processor.
 *
 * Referência: https://developers.mercadolivre.com.br/pt_br/notificacoes
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nohub/db";
import { mercadolivreAdapter } from "@/features/sales/adapters/mercadolivre-adapter";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const notification = payload as { user_id?: number; topic?: string; resource?: string; _id?: string };

  // Encontrar integração ML pelo seller_id (user_id do ML)
  const sellerId = String(notification.user_id ?? "");
  const integration = await prisma.channelIntegration.findFirst({
    where: { channel: "MERCADO_LIVRE", status: "CONNECTED" },
  });

  if (!integration) {
    return NextResponse.json({ ok: true }); // ML requer 200
  }

  // Verificar assinatura
  const credentials = integration.credentials as Record<string, unknown> | null;
  const secret      = String(credentials?.clientSecret ?? "");
  if (secret && !mercadolivreAdapter.verifySignature(rawBody, headers, secret)) {
    console.warn("[ML webhook] Assinatura inválida — ignorando");
    return NextResponse.json({ ok: true });
  }

  // Só processa topics relevantes
  const topic = String(notification.topic ?? "");
  if (!["orders_v2", "payments", "shipments"].includes(topic)) {
    return NextResponse.json({ ok: true });
  }

  const externalEventId = notification._id ?? String(notification.resource ?? Date.now());

  const existing = await prisma.inboundEvent.findFirst({
    where: { channel: "MERCADO_LIVRE", externalEventId },
  });
  if (!existing) {
    await prisma.inboundEvent.create({
      data: {
        organizationId: integration.organizationId,
        channel:        "MERCADO_LIVRE",
        externalEventId,
        payload:        notification as never,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
