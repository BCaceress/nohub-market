/**
 * POST /api/channels/payments/webhook
 *
 * Recebe confirmações de pagamento do PSP (Pix confirmado, etc.).
 * Atualiza o status do pagamento e avança o pedido se pago.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nohub/db";
import { getPaymentProvider } from "@/features/sales/adapters/payment-adapter";

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

  // Verificar assinatura do PSP
  const webhookSecret = process.env.PSP_WEBHOOK_SECRET ?? "";
  const provider      = getPaymentProvider({
    baseUrl: process.env.PSP_BASE_URL ?? "",
    apiKey:  process.env.PSP_API_KEY ?? "",
  });

  if (webhookSecret && !provider.verifyWebhookSignature(rawBody, headers, webhookSecret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const event = provider.parseWebhookEvent(payload);
  if (!event) {
    return NextResponse.json({ ok: true }); // Ignorar eventos desconhecidos
  }

  if (event.event === "paid" && event.chargeId) {
    // Encontrar pagamento pelo externalPaymentId (chargeId do PSP)
    const payment = await prisma.payment.findFirst({
      where:   { externalPaymentId: event.chargeId },
      include: { order: true },
    });

    if (payment && payment.status !== "CONFIRMED") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data:  { status: "CONFIRMED", confirmedAt: event.paidAt ?? new Date() },
        });

        // Verificar se total pago ≥ total do pedido
        const allPayments = await tx.payment.findMany({
          where: { orderId: payment.orderId, status: "CONFIRMED" },
        });
        const totalPaid = allPayments.reduce(
          (s, p) => s + Number(p.amount),
          0,
        );

        if (totalPaid >= Number(payment.order.total) && payment.order.status === "CONFIRMED") {
          await tx.order.update({
            where: { id: payment.orderId },
            data:  { status: "PAID", updatedAt: new Date() },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId:    payment.orderId,
              fromStatus: "CONFIRMED",
              toStatus:   "PAID",
              actorId:    "system",
              source:     "WEBHOOK",
            },
          });
        }
      });
    }
  }

  return NextResponse.json({ ok: true });
}
