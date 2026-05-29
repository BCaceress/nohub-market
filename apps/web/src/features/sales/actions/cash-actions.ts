"use server";

import { prisma } from "@nohub/db";
import { z } from "zod";
import { bleedCash, closeCashSession, openCashSession, supplyCash } from "../lib/cash-session";

const openSchema = z.object({
  organizationId: z.string(),
  locationId: z.string(),
  operatorId: z.string(),
  openingAmount: z.coerce.number().min(0),
  note: z.string().optional(),
});

const closeSchema = z.object({
  organizationId: z.string(),
  sessionId: z.string(),
  closingAmount: z.coerce.number().min(0),
  actorId: z.string(),
  note: z.string().optional(),
});

const movementSchema = z.object({
  sessionId: z.string(),
  organizationId: z.string(),
  amount: z.coerce.number().positive(),
  note: z.string().min(1),
  actorId: z.string(),
});

export async function openCashSessionAction(input: z.infer<typeof openSchema>) {
  const parsed = openSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  return openCashSession(parsed.data);
}

export async function closeCashSessionAction(input: z.infer<typeof closeSchema>) {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  return closeCashSession(parsed.data);
}

export async function bleedCashAction(input: z.infer<typeof movementSchema>) {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  return bleedCash(
    parsed.data.sessionId,
    parsed.data.organizationId,
    parsed.data.amount,
    parsed.data.note,
    parsed.data.actorId,
  );
}

export async function supplyCashAction(input: z.infer<typeof movementSchema>) {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  }
  return supplyCash(
    parsed.data.sessionId,
    parsed.data.organizationId,
    parsed.data.amount,
    parsed.data.note,
    parsed.data.actorId,
  );
}

export async function getOpenCashSessionAction(organizationId: string, locationId: string) {
  return prisma.cashSession.findFirst({
    where: { organizationId, locationId, status: "OPEN" },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { orders: true } },
    },
  });
}

export async function getCashSessionsAction(organizationId: string, locationId?: string) {
  return prisma.cashSession.findMany({
    where: {
      organizationId,
      ...(locationId && { locationId }),
    },
    orderBy: { openedAt: "desc" },
    take: 50,
    include: {
      location: { select: { name: true } },
      movements: { select: { type: true, amount: true, createdAt: true }, take: 5 },
      _count: { select: { orders: true } },
    },
  });
}
