import "server-only";
import { prisma } from "@nohub/db";

/**
 * Configuração financeira por organização — taxas de adquirente e prazo de
 * liquidação D+N. Persistida em Organization.financeSettings (Json).
 */
export type FinanceSettings = {
  cardFeeRates: {
    CARD_PRESENT: number; // fração (0.0199 = 1,99%)
    CARD_ONLINE: number;
  };
  settlementDays: number; // D+N
};

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  cardFeeRates: { CARD_PRESENT: 0.0199, CARD_ONLINE: 0.0399 },
  settlementDays: 30,
};

function coerce(raw: unknown): FinanceSettings {
  const s = (raw ?? {}) as Partial<FinanceSettings>;
  const rates = (s.cardFeeRates ?? {}) as Partial<FinanceSettings["cardFeeRates"]>;
  return {
    cardFeeRates: {
      CARD_PRESENT: Number(
        rates.CARD_PRESENT ?? DEFAULT_FINANCE_SETTINGS.cardFeeRates.CARD_PRESENT,
      ),
      CARD_ONLINE: Number(rates.CARD_ONLINE ?? DEFAULT_FINANCE_SETTINGS.cardFeeRates.CARD_ONLINE),
    },
    settlementDays: Number(s.settlementDays ?? DEFAULT_FINANCE_SETTINGS.settlementDays),
  };
}

export async function getFinanceSettings(organizationId: string): Promise<FinanceSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { financeSettings: true },
  });
  return coerce(org?.financeSettings);
}
