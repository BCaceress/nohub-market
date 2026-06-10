"use server";

/**
 * Financeiro — server actions.
 * Padrão: requireSessionWithOrg() → organizationId → domain lib → Result<T,E>.
 */

import { prisma } from "@nohub/db";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireSessionWithOrg } from "@/lib/auth-server";
import { calculateCashFlow } from "../lib/calculate-cash-flow";
import { computeDre } from "../lib/compute-dre";
import { recordPayablePayment } from "../lib/record-payable-payment";
import { recordReceivableReceipt } from "../lib/record-receivable-receipt";

const OPEN_PAYABLE = ["PENDING", "PARTIALLY_PAID"] as const;
const OPEN_RECEIVABLE = ["PENDING", "PARTIALLY_RECEIVED"] as const;

// ── Visão geral (KPIs) ───────────────────────────────────────────────
export async function getFinanceOverviewAction() {
  const { organizationId } = await requireSessionWithOrg();
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  const [payables, receivables, pendingSettlements, openSessions] = await Promise.all([
    prisma.accountPayable.findMany({
      where: { organizationId, status: { in: [...OPEN_PAYABLE] } },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
    prisma.accountReceivable.findMany({
      where: { organizationId, status: { in: [...OPEN_RECEIVABLE] } },
      select: { amount: true, receivedAmount: true, dueDate: true },
    }),
    prisma.paymentSettlement.aggregate({
      where: { organizationId, status: "PENDING" },
      _sum: { netAmount: true },
      _count: true,
    }),
    prisma.cashSession.count({ where: { organizationId, status: "OPEN" } }),
  ]);

  const sumBuckets = (rows: { amount: unknown; settled: unknown; dueDate: Date }[]) => {
    let open = 0;
    let today = 0;
    let next7 = 0;
    let overdue = 0;
    for (const r of rows) {
      const remaining = Number(r.amount) - Number(r.settled);
      open += remaining;
      const due = new Date(r.dueDate);
      if (due < now) overdue += remaining;
      else if (due <= endToday) today += remaining;
      else if (due <= in7) next7 += remaining;
    }
    return { open, today, next7, overdue };
  };

  return {
    payable: sumBuckets(
      payables.map((p) => ({ amount: p.amount, settled: p.paidAmount, dueDate: p.dueDate })),
    ),
    receivable: sumBuckets(
      receivables.map((r) => ({ amount: r.amount, settled: r.receivedAmount, dueDate: r.dueDate })),
    ),
    settlements: {
      pendingNet: Number(pendingSettlements._sum.netAmount ?? 0),
      pendingCount: pendingSettlements._count,
    },
    openCashSessions: openSessions,
  };
}

// ── Contas a pagar ───────────────────────────────────────────────────
export async function listPayablesAction(params?: {
  status?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await requireSessionWithOrg();
  const { status, overdue, page = 1, pageSize = 20 } = params ?? {};
  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (overdue) where.dueDate = { lt: new Date() };

  const [payables, total] = await Promise.all([
    prisma.accountPayable.findMany({
      where: where as never,
      include: {
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accountPayable.count({ where: where as never }),
  ]);
  return { payables, total, page, pageSize };
}

const payablePaymentSchema = z.object({
  payableId: z.string(),
  amount: z.coerce.number().positive(),
  paymentDate: z.string().optional(),
});

export async function recordPayablePaymentAction(input: z.infer<typeof payablePaymentSchema>) {
  const parsed = payablePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  const { organizationId, user } = await requireSessionWithOrg();
  return recordPayablePayment({ ...parsed.data, organizationId, actorId: user.id });
}

// ── Contas a receber ─────────────────────────────────────────────────
export async function listReceivablesAction(params?: {
  status?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await requireSessionWithOrg();
  const { status, overdue, page = 1, pageSize = 20 } = params ?? {};
  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (overdue) where.dueDate = { lt: new Date() };

  const [receivables, total] = await Promise.all([
    prisma.accountReceivable.findMany({
      where: where as never,
      include: {
        customer: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accountReceivable.count({ where: where as never }),
  ]);
  return { receivables, total, page, pageSize };
}

const createReceivableSchema = z.object({
  customerId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  dueDate: z.string(),
  description: z.string().min(1),
  installmentNumber: z.coerce.number().int().positive().default(1),
  totalInstallments: z.coerce.number().int().positive().default(1),
  categoryId: z.string().optional().nullable(),
});

export async function createReceivableAction(input: z.input<typeof createReceivableSchema>) {
  const parsed = createReceivableSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  const { organizationId, user } = await requireSessionWithOrg();
  const d = parsed.data;
  const rec = await prisma.accountReceivable.create({
    data: {
      organizationId,
      customerId: d.customerId || null,
      orderId: d.orderId || null,
      amount: d.amount,
      dueDate: new Date(d.dueDate),
      description: d.description,
      installmentNumber: d.installmentNumber,
      totalInstallments: d.totalInstallments,
      categoryId: d.categoryId || null,
    },
  });
  await writeAudit({
    organizationId,
    actorId: user.id,
    action: "receivable.created",
    resourceType: "AccountReceivable",
    resourceId: rec.id,
    after: { amount: d.amount, dueDate: d.dueDate, description: d.description },
  });
  return { success: true as const, id: rec.id };
}

const receivableReceiptSchema = z.object({
  receivableId: z.string(),
  amount: z.coerce.number().positive(),
  receiptDate: z.string().optional(),
});

export async function recordReceivableReceiptAction(
  input: z.infer<typeof receivableReceiptSchema>,
) {
  const parsed = receivableReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  const { organizationId, user } = await requireSessionWithOrg();
  return recordReceivableReceipt({ ...parsed.data, organizationId, actorId: user.id });
}

// ── Fluxo de caixa ───────────────────────────────────────────────────
export async function getCashFlowAction(rangeDays = 30) {
  const { organizationId } = await requireSessionWithOrg();
  return calculateCashFlow(organizationId, rangeDays);
}

// ── Conciliação de cartão ────────────────────────────────────────────
export async function listSettlementsAction(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await requireSessionWithOrg();
  const { status, page = 1, pageSize = 20 } = params ?? {};
  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;

  const [settlements, total] = await Promise.all([
    prisma.paymentSettlement.findMany({
      where: where as never,
      include: {
        payment: { select: { method: true, orderId: true, confirmedAt: true } },
      },
      orderBy: { expectedDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paymentSettlement.count({ where: where as never }),
  ]);
  return { settlements, total, page, pageSize };
}

export async function markSettlementSettledAction(settlementId: string) {
  const { organizationId, user } = await requireSessionWithOrg();
  const s = await prisma.paymentSettlement.findUnique({ where: { id: settlementId } });
  if (!s || s.organizationId !== organizationId) {
    return { success: false as const, error: "Liquidação não encontrada" };
  }
  if (s.status !== "PENDING") {
    return { success: false as const, error: "Liquidação já processada" };
  }
  await prisma.paymentSettlement.update({
    where: { id: settlementId },
    data: { status: "SETTLED", settledAt: new Date() },
  });
  await writeAudit({
    organizationId,
    actorId: user.id,
    action: "settlement.settled",
    resourceType: "PaymentSettlement",
    resourceId: settlementId,
    after: { netAmount: Number(s.netAmount) },
  });
  return { success: true as const };
}

// ── Sessões de caixa ─────────────────────────────────────────────────
export async function listCashSessionsAction(locationId?: string) {
  const { organizationId } = await requireSessionWithOrg();
  return prisma.cashSession.findMany({
    where: { organizationId, ...(locationId && { locationId }) },
    orderBy: { openedAt: "desc" },
    take: 50,
    include: {
      location: { select: { name: true } },
      movements: { select: { type: true, amount: true, createdAt: true }, take: 5 },
      _count: { select: { orders: true } },
    },
  });
}

// ── Categorias / DRE ─────────────────────────────────────────────────
export async function listCategoriesAction() {
  const { organizationId } = await requireSessionWithOrg();
  return prisma.financeCategory.findMany({
    where: { organizationId, archived: false },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

const upsertCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  kind: z.enum(["INCOME", "EXPENSE"]),
  archived: z.boolean().optional(),
});

export async function upsertCategoryAction(input: z.infer<typeof upsertCategorySchema>) {
  const parsed = upsertCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  const { organizationId } = await requireSessionWithOrg();
  const d = parsed.data;
  try {
    if (d.id) {
      await prisma.financeCategory.update({
        where: { id: d.id },
        data: { name: d.name, kind: d.kind, archived: d.archived ?? false },
      });
    } else {
      await prisma.financeCategory.create({
        data: { organizationId, name: d.name, kind: d.kind },
      });
    }
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Categoria já existe com esse nome e tipo" };
  }
}

export async function getDreAction(params?: { from?: string; to?: string }) {
  const { organizationId } = await requireSessionWithOrg();
  const now = new Date();
  const from = params?.from
    ? new Date(params.from)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = params?.to
    ? new Date(params.to)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return computeDre(organizationId, from, to);
}
