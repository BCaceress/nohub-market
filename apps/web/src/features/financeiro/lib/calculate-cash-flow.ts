import "server-only";
import { prisma } from "@nohub/db";

/**
 * Fluxo de caixa — realizado (passado) + projetado (futuro).
 *
 * Realizado:
 *   entradas = Payments CONFIRMED (por confirmedAt)
 *   saídas   = AccountPayable.paidAmount (por paidAt)
 * Projetado:
 *   entradas = AccountReceivable em aberto (por dueDate, saldo restante)
 *            + PaymentSettlement PENDING (por expectedDate, líquido)
 *   saídas   = AccountPayable em aberto (por dueDate, saldo restante)
 */
export type CashFlowDay = { date: string; inflow: number; outflow: number };

export type CashFlow = {
  realized: { inflow: number; outflow: number; net: number };
  projected: { inflow: number; outflow: number; net: number };
  byDay: CashFlowDay[]; // realizado por dia (janela passada)
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function calculateCashFlow(organizationId: string, rangeDays = 30): Promise<CashFlow> {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - rangeDays);
  const future = new Date(now);
  future.setDate(future.getDate() + rangeDays);

  const [payments, paidPayables, openReceivables, pendingSettlements, openPayables] =
    await Promise.all([
      prisma.payment.findMany({
        where: {
          status: "CONFIRMED",
          confirmedAt: { gte: past, lte: now },
          order: { organizationId },
        },
        select: { amount: true, confirmedAt: true },
      }),
      prisma.accountPayable.findMany({
        where: { organizationId, status: "PAID", paidAt: { gte: past, lte: now } },
        select: { paidAmount: true, paidAt: true },
      }),
      prisma.accountReceivable.findMany({
        where: {
          organizationId,
          status: { in: ["PENDING", "PARTIALLY_RECEIVED"] },
          dueDate: { lte: future },
        },
        select: { amount: true, receivedAmount: true },
      }),
      prisma.paymentSettlement.findMany({
        where: { organizationId, status: "PENDING", expectedDate: { lte: future } },
        select: { netAmount: true },
      }),
      prisma.accountPayable.findMany({
        where: {
          organizationId,
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          dueDate: { lte: future },
        },
        select: { amount: true, paidAmount: true },
      }),
    ]);

  // Realizado
  const buckets = new Map<string, CashFlowDay>();
  const bump = (d: Date | null, field: "inflow" | "outflow", v: number) => {
    if (!d) return;
    const k = dayKey(d);
    const cur = buckets.get(k) ?? { date: k, inflow: 0, outflow: 0 };
    cur[field] += v;
    buckets.set(k, cur);
  };
  let realizedIn = 0;
  let realizedOut = 0;
  for (const p of payments) {
    realizedIn += Number(p.amount);
    bump(p.confirmedAt, "inflow", Number(p.amount));
  }
  for (const p of paidPayables) {
    realizedOut += Number(p.paidAmount);
    bump(p.paidAt, "outflow", Number(p.paidAmount));
  }

  // Projetado
  const projectedIn =
    openReceivables.reduce((s, r) => s + (Number(r.amount) - Number(r.receivedAmount)), 0) +
    pendingSettlements.reduce((s, x) => s + Number(x.netAmount), 0);
  const projectedOut = openPayables.reduce(
    (s, p) => s + (Number(p.amount) - Number(p.paidAmount)),
    0,
  );

  const byDay = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    realized: { inflow: realizedIn, outflow: realizedOut, net: realizedIn - realizedOut },
    projected: { inflow: projectedIn, outflow: projectedOut, net: projectedIn - projectedOut },
    byDay,
  };
}
