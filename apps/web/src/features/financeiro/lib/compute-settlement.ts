import "server-only";
import type { PaymentMethod } from "@nohub/db";
import { prisma } from "@nohub/db";
import { getFinanceSettings } from "./finance-settings";

/**
 * Conciliação de cartão — dado um Payment de cartão CONFIRMED, cria o
 * PaymentSettlement (líquido = bruto − taxa adquirente, liquidação D+N).
 * Idempotente: paymentId é @unique; se já existe, não duplica.
 * Métodos não-cartão são ignorados (retorna null).
 */
const CARD_METHODS: PaymentMethod[] = ["CARD_PRESENT", "CARD_CREDIT", "CARD_DEBIT", "CARD_ONLINE"];

export async function computeSettlement(input: {
  organizationId: string;
  paymentId: string;
  method: PaymentMethod;
  amount: number;
  provider?: string | null;
}): Promise<{ settlementId: string } | null> {
  if (!CARD_METHODS.includes(input.method)) return null;

  const existing = await prisma.paymentSettlement.findUnique({
    where: { paymentId: input.paymentId },
    select: { id: true },
  });
  if (existing) return { settlementId: existing.id };

  const settings = await getFinanceSettings(input.organizationId);
  const rate = settings.cardFeeRates[input.method as keyof typeof settings.cardFeeRates] ?? 0;
  const gross = input.amount;
  const fee = Math.round(gross * rate * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + settings.settlementDays);

  const settlement = await prisma.paymentSettlement.create({
    data: {
      organizationId: input.organizationId,
      paymentId: input.paymentId,
      provider: input.provider ?? null,
      grossAmount: gross,
      feeAmount: fee,
      netAmount: net,
      expectedDate,
      status: "PENDING",
    },
  });

  return { settlementId: settlement.id };
}
