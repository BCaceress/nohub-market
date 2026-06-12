"use server";

import { prisma } from "@nohub/db";
import { onlyDigits } from "@nohub/shared/brazilian";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSession, requireSessionWithOrg } from "@/lib/auth-server";
import { lookupCep } from "@/lib/brasilapi";

/* ── Schema ───────────────────────────────────────────────────────── */

const customerSchema = z.object({
  personType: z.enum(["PF", "PJ"]).default("PF"),
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  contactName: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

/* ── Auth helper ──────────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Audit log helper ─────────────────────────────────────────────── */

async function writeCustomerAudit(params: {
  organizationId: string;
  customerId: string;
  userId?: string;
  userName?: string;
  action: string;
  changedFields?: Record<string, { from: unknown; to: unknown }>;
}) {
  await prisma.customerAuditLog.create({
    data: {
      organizationId: params.organizationId,
      customerId: params.customerId,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      changedFields: (params.changedFields ?? undefined) as never,
    },
  });
}

/* ── CRUD ─────────────────────────────────────────────────────────── */

export async function getCustomersAction(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      personType: true,
      name: true,
      document: true,
      email: true,
      phone: true,
      whatsapp: true,
      contactName: true,
      addressCity: true,
      addressState: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { orders: true, invoices: true } },
    },
  });
}

export type CustomerFull = Awaited<ReturnType<typeof prisma.customer.findFirstOrThrow>>;

export async function getCustomerAction(customerId: string): Promise<Result<CustomerFull>> {
  const session = await requireSessionWithOrg();
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId, deletedAt: null },
  });
  if (!customer) return { success: false, error: "Cliente não encontrado" };
  return { success: true, data: customer as CustomerFull };
}

export async function createCustomerAction(
  organizationId: string,
  input: CustomerInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      organizationId,
      personType: data.personType,
      name: data.name,
      document: data.document ? onlyDigits(data.document) : undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      whatsapp: data.whatsapp || undefined,
      contactName: data.contactName || undefined,
      addressStreet: data.addressStreet || undefined,
      addressNumber: data.addressNumber || undefined,
      addressComplement: data.addressComplement || undefined,
      addressDistrict: data.addressDistrict || undefined,
      addressCity: data.addressCity || undefined,
      addressState: data.addressState || undefined,
      addressZip: data.addressZip || undefined,
      notes: data.notes || undefined,
    },
  });

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: "customer.created",
      resourceType: "Customer",
      resourceId: customer.id,
      after: { name: customer.name },
    }),
    writeCustomerAudit({
      organizationId,
      customerId: customer.id,
      userId: session.user.id,
      userName: session.user.name,
      action: "CREATED",
    }),
  ]);

  revalidatePath("/app/customers");
  return { success: true, data: { id: customer.id } };
}

export async function updateCustomerAction(
  organizationId: string,
  customerId: string,
  input: CustomerInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const before = await prisma.customer.findFirst({ where: { id: customerId, organizationId } });

  const data = parsed.data;
  await prisma.customer.updateMany({
    where: { id: customerId, organizationId },
    data: {
      personType: data.personType,
      name: data.name,
      document: data.document ? onlyDigits(data.document) : null,
      email: data.email || null,
      phone: data.phone || null,
      whatsapp: data.whatsapp || null,
      contactName: data.contactName || null,
      addressStreet: data.addressStreet || null,
      addressNumber: data.addressNumber || null,
      addressComplement: data.addressComplement || null,
      addressDistrict: data.addressDistrict || null,
      addressCity: data.addressCity || null,
      addressState: data.addressState || null,
      addressZip: data.addressZip || null,
      notes: data.notes || null,
    },
  });

  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  if (before) {
    const tracked = ["name", "document", "email", "phone", "whatsapp", "contactName"] as const;
    for (const k of tracked) {
      if (before[k] !== (data as Record<string, unknown>)[k]) {
        changedFields[k] = { from: before[k], to: (data as Record<string, unknown>)[k] };
      }
    }
  }

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: "customer.updated",
      resourceType: "Customer",
      resourceId: customerId,
    }),
    writeCustomerAudit({
      organizationId,
      customerId,
      userId: session.user.id,
      userName: session.user.name,
      action: "UPDATED",
      changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
    }),
  ]);

  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${customerId}`);
  return { success: true, data: null };
}

export async function deleteCustomerAction(
  organizationId: string,
  customerId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.customer.updateMany({
    where: { id: customerId, organizationId },
    data: { deletedAt: new Date() },
  });

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: "customer.deleted",
      resourceType: "Customer",
      resourceId: customerId,
    }),
    writeCustomerAudit({
      organizationId,
      customerId,
      userId: session.user.id,
      userName: session.user.name,
      action: "DELETED",
    }),
  ]);

  revalidatePath("/app/customers");
  return { success: true, data: null };
}

export async function toggleCustomerActiveAction(
  organizationId: string,
  customerId: string,
  isActive: boolean,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.customer.updateMany({
    where: { id: customerId, organizationId },
    data: { deletedAt: isActive ? null : new Date() },
  });

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: isActive ? "customer.reactivated" : "customer.deactivated",
      resourceType: "Customer",
      resourceId: customerId,
    }),
    writeCustomerAudit({
      organizationId,
      customerId,
      userId: session.user.id,
      userName: session.user.name,
      action: isActive ? "REACTIVATED" : "DEACTIVATED",
    }),
  ]);

  revalidatePath("/app/customers");
  return { success: true, data: null };
}

/* ── CEP Lookup ───────────────────────────────────────────────────── */

export async function lookupCustomerCepAction(cep: string) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return { success: false as const, error: "CEP deve ter 8 dígitos" };
  const data = await lookupCep(digits);
  if (!data) return { success: false as const, error: "CEP não encontrado" };
  return { success: true as const, data };
}

/* ── Detail / Stats / History ─────────────────────────────────────── */

export async function getCustomerStatsAction(customerId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const [aggregate, lastOrder, invoiceCount] = await Promise.all([
    prisma.order.aggregate({
      where: { customerId, organizationId, status: { not: "CANCELED" } },
      _sum: { total: true },
      _count: { id: true },
      _avg: { total: true },
    }),
    prisma.order.findFirst({
      where: { customerId, organizationId, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, total: true },
    }),
    prisma.invoice.count({ where: { customerId, organizationId } }),
  ]);

  return {
    totalSpent: Number(aggregate._sum.total ?? 0),
    orderCount: aggregate._count.id,
    avgTicket: Number(aggregate._avg.total ?? 0),
    invoiceCount,
    lastOrder: lastOrder
      ? { createdAt: lastOrder.createdAt, total: Number(lastOrder.total) }
      : null,
  };
}

export async function getCustomerOrderHistoryAction(customerId: string, page = 1, pageSize = 20) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where: { customerId, organizationId },
      select: {
        id: true,
        channel: true,
        status: true,
        total: true,
        createdAt: true,
        _count: { select: { items: true } },
        invoice: { select: { id: true, status: true, number: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: { customerId, organizationId } }),
  ]);

  const orders = rows.map((o) => ({
    id: o.id,
    channel: o.channel,
    status: o.status,
    total: Number(o.total),
    createdAt: o.createdAt,
    itemCount: o._count.items,
    invoice: o.invoice,
  }));

  return { orders, total, page, pageSize };
}

export async function getCustomerAuditLogAction(customerId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.customerAuditLog.findMany({
    where: { customerId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/* ── Search / Quick-create (PDV) ──────────────────────────────────── */

export async function searchCustomersAction(search?: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const q = (search ?? "").trim();
  const digits = onlyDigits(q);

  return prisma.customer.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              ...(digits
                ? [{ document: { contains: digits } }, { phone: { contains: digits } }]
                : []),
            ],
          }
        : {}),
    },
    select: { id: true, name: true, document: true, phone: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

export async function quickCreateCustomerAction(input: {
  name: string;
  phone?: string;
  document?: string;
}): Promise<
  Result<{ id: string; name: string | null; document: string | null; phone: string | null }>
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) return { success: false, error: "Sem organização" };
  if (member.role === "viewer") return { success: false, error: "Sem permissão" };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nome obrigatório" };

  const customer = await prisma.customer.create({
    data: {
      organizationId: member.organizationId,
      personType: "PF",
      name,
      phone: input.phone ? input.phone.trim() : undefined,
      document: input.document ? onlyDigits(input.document) : undefined,
    },
    select: { id: true, name: true, document: true, phone: true },
  });

  await writeCustomerAudit({
    organizationId: member.organizationId,
    customerId: customer.id,
    userId: session.user.id,
    userName: session.user.name,
    action: "CREATED",
  });

  revalidatePath("/app/customers");
  return { success: true, data: customer };
}
