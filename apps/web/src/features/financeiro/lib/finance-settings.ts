import "server-only";
import { prisma } from "@nohub/db";

/**
 * Configuração financeira por organização — taxas de adquirente e prazo de
 * liquidação D+N. Persistida em Organization.financeSettings (Json).
 */
export type FinanceSettings = {
  cardFeeRates: {
    CARD_PRESENT: number; // fração (0.0199 = 1,99%)
    CARD_CREDIT: number;
    CARD_DEBIT: number;
    CARD_ONLINE: number;
  };
  settlementDays: number; // D+N
};

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  cardFeeRates: {
    CARD_PRESENT: 0.0199,
    CARD_CREDIT: 0.0299,
    CARD_DEBIT: 0.0149,
    CARD_ONLINE: 0.0399,
  },
  settlementDays: 30,
};

function coerce(raw: unknown): FinanceSettings {
  const s = (raw ?? {}) as Partial<FinanceSettings>;
  const rates = (s.cardFeeRates ?? {}) as Partial<FinanceSettings["cardFeeRates"]>;
  const def = DEFAULT_FINANCE_SETTINGS.cardFeeRates;
  return {
    cardFeeRates: {
      CARD_PRESENT: Number(rates.CARD_PRESENT ?? def.CARD_PRESENT),
      CARD_CREDIT: Number(rates.CARD_CREDIT ?? def.CARD_CREDIT),
      CARD_DEBIT: Number(rates.CARD_DEBIT ?? def.CARD_DEBIT),
      CARD_ONLINE: Number(rates.CARD_ONLINE ?? def.CARD_ONLINE),
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
