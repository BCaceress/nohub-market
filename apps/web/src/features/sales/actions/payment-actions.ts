"use server";

import { prisma } from "@nohub/db";
import { z } from "zod";
import { getPaymentProvider } from "../adapters/payment-adapter";
import { registerPayment } from "../lib/register-payment";

const registerPaymentSchema = z.object({
  organizationId: z.string(),
  orderId: z.string(),
  method: z.enum([
    "CASH",
    "PIX_MANUAL",
    "PIX_DYNAMIC",
    "CARD_PRESENT",
    "CARD_CREDIT",
    "CARD_DEBIT",
    "CARD_ONLINE",
    "VOUCHER",
  ]),
  amount: z.coerce.number().positive(),
  receivedAmount: z.coerce.number().min(0).optional(),
  actorId: z.string(),
  actorName: z.string().nullish(),
});

export async function registerPaymentAction(input: z.infer<typeof registerPaymentSchema>) {
  const parsed = registerPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  return registerPayment(parsed.data);
}

export async function initiatePixAction(organizationId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });

  if (!order || order.organizationId !== organizationId) {
    return { success: false as const, error: "Pedido não encontrado" };
  }

  // Buscar credenciais do PSP
  const pspCredentials = {
    baseUrl: process.env.PSP_BASE_URL ?? "https://api.asaas.com/v3",
    apiKey: process.env.PSP_API_KEY ?? "",
  };

  const provider = getPaymentProvider(pspCredentials);
  const result = await provider.createPixCharge({
    organizationId,
    orderId,
    amount: Math.round(Number(order.total) * 100), // centavos
    description: `Pedido ${orderId.slice(0, 8)}`,
    customerDoc: order.customer?.document ?? undefined,
    customerName: order.customer?.name ?? undefined,
  });

  if (!result.success) return result;

  // Criar registro de pagamento pendente
  const payment = await prisma.payment.create({
    data: {
      orderId,
      method: "PIX_DYNAMIC",
      amount: order.total,
      status: "PENDING",
      externalPaymentId: result.chargeId,
      pixQrCode: result.qrCode,
      pixQrCodeUrl: result.qrCodeImage,
      pixExpiresAt: result.expiresAt,
    },
  });

  return {
    success: true as const,
    paymentId: payment.id,
    qrCode: result.qrCode,
    qrCodeImage: result.qrCodeImage,
    expiresAt: result.expiresAt,
  };
}

export async function getPaymentsAction(organizationId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { organizationId: true },
  });
  if (!order || order.organizationId !== organizationId) return [];

  return prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}
