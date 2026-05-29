/**
 * Caixa PDV — sessão de caixa, sangria e suprimento (RN-V14).
 * Só para channel POS.
 */

import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";

/* ── Abrir caixa ─────────────────────────────────────────────── */

export type OpenCashSessionInput = {
  organizationId: string;
  locationId: string;
  operatorId: string;
  openingAmount: number;
  note?: string;
};

export type OpenCashSessionResult =
  | { success: true; sessionId: string }
  | { success: false; error: string };

export async function openCashSession(input: OpenCashSessionInput): Promise<OpenCashSessionResult> {
  // Verifica se já há caixa aberto neste local
  const existing = await prisma.cashSession.findFirst({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      status: "OPEN",
    },
  });
  if (existing) {
    return { success: false, error: "Já existe um caixa aberto neste local" };
  }

  const session = await prisma.cashSession.create({
    data: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      operatorId: input.operatorId,
      openingAmount: input.openingAmount,
      note: input.note ?? null,
      movements: {
        create: {
          type: "OPEN",
          amount: input.openingAmount,
          note: "Abertura de caixa",
          actorId: input.operatorId,
        },
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.operatorId,
    action: "cash.opened",
    resourceType: "CashSession",
    resourceId: session.id,
    after: { openingAmount: input.openingAmount, locationId: input.locationId },
  });

  return { success: true, sessionId: session.id };
}

/* ── Fechar caixa ────────────────────────────────────────────── */

export type CloseCashSessionInput = {
  organizationId: string;
  sessionId: string;
  closingAmount: number;
  actorId: string;
  note?: string;
};

export type CloseCashSessionResult =
  | { success: true; sessionId: string; divergence: number }
  | { success: false; error: string };

export async function closeCashSession(
  input: CloseCashSessionInput,
): Promise<CloseCashSessionResult> {
  const session = await prisma.cashSession.findUnique({
    where: { id: input.sessionId },
    include: {
      movements: true,
      orders: {
        where: { status: { in: ["COMPLETED", "PAID"] } },
        include: { payments: { where: { status: "CONFIRMED" } } },
      },
    },
  });

  if (!session || session.organizationId !== input.organizationId) {
    return { success: false, error: "Sessão de caixa não encontrada" };
  }
  if (session.status === "CLOSED") {
    return { success: false, error: "Caixa já fechado" };
  }

  // Calcular valor do sistema:
  // abertura + suprimentos - sangrias + pagamentos em dinheiro
  const cashMovementBalance = session.movements.reduce((acc, mv) => {
    if (mv.type === "OPEN" || mv.type === "SUPPLY") return acc + Number(mv.amount);
    if (mv.type === "BLEED") return acc - Number(mv.amount);
    return acc;
  }, 0);

  const cashSalesTotal = session.orders.reduce((acc, order) => {
    return (
      acc +
      order.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + Number(p.amount), 0)
    );
  }, 0);

  const systemAmount = cashMovementBalance + cashSalesTotal;
  const divergence = input.closingAmount - systemAmount;

  await prisma.$transaction([
    prisma.cashSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closingAmount: input.closingAmount,
        systemAmount,
        divergence,
        closedAt: new Date(),
        note: input.note ?? session.note,
      },
    }),
    prisma.cashMovement.create({
      data: {
        cashSessionId: session.id,
        type: "CLOSE",
        amount: input.closingAmount,
        note: `Fechamento — divergência: ${divergence.toFixed(2)}`,
        actorId: input.actorId,
      },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "cash.closed",
    resourceType: "CashSession",
    resourceId: session.id,
    after: { closingAmount: input.closingAmount, systemAmount, divergence },
  });

  return { success: true, sessionId: session.id, divergence };
}

/* ── Sangria ─────────────────────────────────────────────────── */

export async function bleedCash(
  sessionId: string,
  organizationId: string,
  amount: number,
  note: string,
  actorId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
  if (!session || session.organizationId !== organizationId || session.status !== "OPEN") {
    return { success: false, error: "Sessão inválida ou fechada" };
  }
  if (amount <= 0) return { success: false, error: "Valor deve ser positivo" };

  await prisma.cashMovement.create({
    data: { cashSessionId: sessionId, type: "BLEED", amount, note, actorId },
  });

  await writeAudit({
    organizationId,
    actorId,
    action: "cash.bleed",
    resourceType: "CashSession",
    resourceId: sessionId,
    after: { amount, note },
  });

  return { success: true };
}

/* ── Suprimento ──────────────────────────────────────────────── */

export async function supplyCash(
  sessionId: string,
  organizationId: string,
  amount: number,
  note: string,
  actorId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
  if (!session || session.organizationId !== organizationId || session.status !== "OPEN") {
    return { success: false, error: "Sessão inválida ou fechada" };
  }
  if (amount <= 0) return { success: false, error: "Valor deve ser positivo" };

  await prisma.cashMovement.create({
    data: { cashSessionId: sessionId, type: "SUPPLY", amount, note, actorId },
  });

  await writeAudit({
    organizationId,
    actorId,
    action: "cash.supply",
    resourceType: "CashSession",
    resourceId: sessionId,
    after: { amount, note },
  });

  return { success: true };
}
