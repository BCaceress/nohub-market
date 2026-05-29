/**
 * GET  /api/channels/whatsapp/webhook — verificação do webhook Meta
 * POST /api/channels/whatsapp/webhook — recebe mensagens/status
 *
 * Meta Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { prisma } from "@nohub/db";
import { type NextRequest, NextResponse } from "next/server";
import { WhatsAppAdapter, whatsappAdapter } from "@/features/sales/adapters/whatsapp-adapter";

export const runtime = "nodejs";

/** Verificação do webhook Meta (GET) */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  const result = WhatsAppAdapter.verifyWebhook(mode, token, challenge, verifyToken);

  if (result !== null) {
    return new NextResponse(result, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/** Recebe eventos Meta (POST) */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  const integration = await prisma.channelIntegration.findFirst({
    where: { channel: "WHATSAPP", status: "CONNECTED" },
  });

  if (!integration) {
    return NextResponse.json({ ok: true }); // Sempre 200 para Meta
  }

  const credentials = integration.credentials as Record<string, unknown> | null;
  const secret = String(credentials?.appSecret ?? "");

  if (secret && !whatsappAdapter.verifySignature(rawBody, headers, secret)) {
    // Meta pode reenviar — logar mas não bloquear
    console.warn("[WhatsApp webhook] Assinatura inválida — ignorando");
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = WhatsAppAdapter.extractMessages(payload);

  for (const msg of messages) {
    // Idempotência
    const existing = await prisma.inboundEvent.findFirst({
      where: { channel: "WHATSAPP", externalEventId: msg.id },
    });
    if (existing) continue;

    await prisma.inboundEvent.create({
      data: {
        organizationId: integration.organizationId,
        channel: "WHATSAPP",
        externalEventId: msg.id,
        payload: msg as never,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
