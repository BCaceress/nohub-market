import "server-only";
import { prisma } from "@nohub/db";

/**
 * DRE simplificado — agrupa o realizado do período por categoria financeira.
 *   Receitas = AccountReceivable.receivedAmount (por receivedAt)
 *   Despesas = AccountPayable.paidAmount (por paidAt)
 * Itens sem categoria caem em "Sem categoria".
 */
export type DreRow = { categoryId: string | null; name: string; total: number };

export type Dre = {
  income: DreRow[];
  expense: DreRow[];
  totalIncome: number;
  totalExpense: number;
  result: number;
};

const UNCATEGORIZED = "Sem categoria";

export async function computeDre(organizationId: string, from: Date, to: Date): Promise<Dre> {
  const [receivables, payables] = await Promise.all([
    prisma.accountReceivable.findMany({
      where: {
        organizationId,
        status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
        receivedAt: { gte: from, lte: to },
      },
      select: { receivedAmount: true, categoryId: true, category: { select: { name: true } } },
    }),
    prisma.accountPayable.findMany({
      where: {
        organizationId,
        status: { in: ["PAID", "PARTIALLY_PAID"] },
        paidAt: { gte: from, lte: to },
      },
      select: { paidAmount: true, categoryId: true, category: { select: { name: true } } },
    }),
  ]);

  const group = (
    rows: { value: number; categoryId: string | null; name: string | undefined }[],
  ): DreRow[] => {
    const map = new Map<string, DreRow>();
    for (const r of rows) {
      const key = r.categoryId ?? "__none__";
      const cur = map.get(key) ?? {
        categoryId: r.categoryId,
        name: r.name ?? UNCATEGORIZED,
        total: 0,
      };
      cur.total += r.value;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  };

  const income = group(
    receivables.map((r) => ({
      value: Number(r.receivedAmount),
      categoryId: r.categoryId,
      name: r.category?.name,
    })),
  );
  const expense = group(
    payables.map((p) => ({
      value: Number(p.paidAmount),
      categoryId: p.categoryId,
      name: p.category?.name,
    })),
  );

  const totalIncome = income.reduce((s, r) => s + r.total, 0);
  const totalExpense = expense.reduce((s, r) => s + r.total, 0);

  return { income, expense, totalIncome, totalExpense, result: totalIncome - totalExpense };
}
