"use server";

import { Prisma, prisma } from "@nohub/db";
import { onlyDigits } from "@nohub/shared/brazilian";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSession, requireSessionWithOrg } from "@/lib/auth-server";

/* ── Schemas ──────────────────────────────────────────────────────── */

const paymentTermsSchema = z
  .object({
    termsDays: z.number().int().min(0),
    type: z.enum(["NET", "INSTALLMENT"]),
    installments: z.array(z.object({ days: z.number().int(), percent: z.number() })).optional(),
  })
  .nullable()
  .optional();

const supplierSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  tradeName: z.string().optional(),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  contactName: z.string().optional(),
  segment: z.string().optional(),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  defaultPaymentTerms: paymentTermsSchema,
  defaultLeadTimeDays: z.number().int().min(0).optional().nullable(),
  minOrderAmount: z.number().min(0).optional().nullable(),
  deliveryDays: z.array(z.string()).optional().nullable(),
  defaultDiscountPercent: z.number().min(0).max(100).optional().nullable(),
  freightFixedAmount: z.number().min(0).optional().nullable(),
  freightFreeAbove: z.number().min(0).optional().nullable(),
  freightNotes: z.string().optional(),
  notes: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

/* ── Auth helper ─────────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Audit log helper ────────────────────────────────────────────── */

async function writeSupplierAudit(params: {
  organizationId: string;
  supplierId: string;
  userId?: string;
  userName?: string;
  action: string;
  changedFields?: Record<string, { from: unknown; to: unknown }>;
}) {
  await prisma.supplierAuditLog.create({
    data: {
      organizationId: params.organizationId,
      supplierId: params.supplierId,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      changedFields: (params.changedFields ?? undefined) as never,
    },
  });
}

/* ── CRUD ─────────────────────────────────────────────────────────── */

export async function getSuppliersAction(organizationId: string) {
  return prisma.supplier.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      email: true,
      phone: true,
      segment: true,
      contactName: true,
      addressCity: true,
      addressState: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { purchaseOrders: true, supplierProductMappings: true } },
    },
  });
}

export type SupplierFull = Awaited<ReturnType<typeof prisma.supplier.findFirstOrThrow>>;

export async function getSupplierAction(supplierId: string): Promise<Result<SupplierFull>> {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId, deletedAt: null },
  });
  if (!supplier) return { success: false, error: "Fornecedor não encontrado" };
  return { success: true, data: supplier as SupplierFull };
}

export async function createSupplierAction(
  organizationId: string,
  input: SupplierInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const supplier = await prisma.supplier.create({
    data: {
      organizationId,
      name: data.name,
      tradeName: data.tradeName || undefined,
      document: data.document ? onlyDigits(data.document) : undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      website: data.website || undefined,
      contactName: data.contactName || undefined,
      segment: data.segment || undefined,
      addressStreet: data.addressStreet || undefined,
      addressNumber: data.addressNumber || undefined,
      addressComplement: data.addressComplement || undefined,
      addressDistrict: data.addressDistrict || undefined,
      addressCity: data.addressCity || undefined,
      addressState: data.addressState || undefined,
      addressZip: data.addressZip || undefined,
      defaultPaymentTerms:
        data.defaultPaymentTerms != null
          ? (data.defaultPaymentTerms as Prisma.InputJsonValue)
          : undefined,
      defaultLeadTimeDays: data.defaultLeadTimeDays ?? undefined,
      minOrderAmount: data.minOrderAmount ?? undefined,
      deliveryDays:
        data.deliveryDays != null ? (data.deliveryDays as Prisma.InputJsonValue) : undefined,
      defaultDiscountPercent: data.defaultDiscountPercent ?? undefined,
      freightFixedAmount: data.freightFixedAmount ?? undefined,
      freightFreeAbove: data.freightFreeAbove ?? undefined,
      freightNotes: data.freightNotes || undefined,
      notes: data.notes || undefined,
    },
  });

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: "supplier.created",
      resourceType: "Supplier",
      resourceId: supplier.id,
      after: { name: supplier.name },
    }),
    writeSupplierAudit({
      organizationId,
      supplierId: supplier.id,
      userId: session.user.id,
      userName: session.user.name,
      action: "CREATED",
    }),
  ]);

  revalidatePath("/app/suppliers");
  return { success: true, data: { id: supplier.id } };
}

export async function updateSupplierAction(
  organizationId: string,
  supplierId: string,
  input: SupplierInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const before = await prisma.supplier.findFirst({ where: { id: supplierId, organizationId } });

  const data = parsed.data;
  await prisma.supplier.updateMany({
    where: { id: supplierId, organizationId },
    data: {
      name: data.name,
      tradeName: data.tradeName || null,
      document: data.document ? onlyDigits(data.document) : null,
      email: data.email || null,
      phone: data.phone || null,
      website: data.website || null,
      contactName: data.contactName || null,
      segment: data.segment || null,
      addressStreet: data.addressStreet || null,
      addressNumber: data.addressNumber || null,
      addressComplement: data.addressComplement || null,
      addressDistrict: data.addressDistrict || null,
      addressCity: data.addressCity || null,
      addressState: data.addressState || null,
      addressZip: data.addressZip || null,
      defaultPaymentTerms:
        data.defaultPaymentTerms != null
          ? (data.defaultPaymentTerms as Prisma.InputJsonValue)
          : Prisma.DbNull,
      defaultLeadTimeDays: data.defaultLeadTimeDays ?? null,
      minOrderAmount: data.minOrderAmount ?? null,
      deliveryDays:
        data.deliveryDays != null ? (data.deliveryDays as Prisma.InputJsonValue) : Prisma.DbNull,
      defaultDiscountPercent: data.defaultDiscountPercent ?? null,
      freightFixedAmount: data.freightFixedAmount ?? null,
      freightFreeAbove: data.freightFreeAbove ?? null,
      freightNotes: data.freightNotes || null,
      notes: data.notes || null,
    },
  });

  const changedFields: Record<string, { from: unknown; to: unknown }> = {};
  if (before) {
    const tracked = ["name", "tradeName", "document", "email", "phone", "segment"] as const;
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
      action: "supplier.updated",
      resourceType: "Supplier",
      resourceId: supplierId,
    }),
    writeSupplierAudit({
      organizationId,
      supplierId,
      userId: session.user.id,
      userName: session.user.name,
      action: "UPDATED",
      changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
    }),
  ]);

  revalidatePath("/app/suppliers");
  revalidatePath(`/app/suppliers/${supplierId}`);
  return { success: true, data: null };
}

export async function deleteSupplierAction(
  organizationId: string,
  supplierId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.supplier.updateMany({
    where: { id: supplierId, organizationId },
    data: { deletedAt: new Date() },
  });

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: "supplier.deleted",
      resourceType: "Supplier",
      resourceId: supplierId,
    }),
    writeSupplierAudit({
      organizationId,
      supplierId,
      userId: session.user.id,
      userName: session.user.name,
      action: "DELETED",
    }),
  ]);

  revalidatePath("/app/suppliers");
  return { success: true, data: null };
}

export async function toggleSupplierActiveAction(
  organizationId: string,
  supplierId: string,
  isActive: boolean,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.supplier.updateMany({
    where: { id: supplierId, organizationId },
    data: { deletedAt: isActive ? null : new Date() },
  });

  await Promise.all([
    writeAudit({
      organizationId,
      actorId: session.user.id,
      action: isActive ? "supplier.reactivated" : "supplier.deactivated",
      resourceType: "Supplier",
      resourceId: supplierId,
    }),
    writeSupplierAudit({
      organizationId,
      supplierId,
      userId: session.user.id,
      userName: session.user.name,
      action: isActive ? "REACTIVATED" : "DEACTIVATED",
    }),
  ]);

  revalidatePath("/app/suppliers");
  return { success: true, data: null };
}

/* ── CNPJ Lookup ─────────────────────────────────────────────────── */

export type CnpjData = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  segmento?: string;
};

export async function lookupCnpjAction(cnpj: string): Promise<Result<CnpjData>> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return { success: false, error: "CNPJ deve ter 14 dígitos" };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        signal: controller.signal,
        headers: { "User-Agent": "nohub-market/1.0" },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      if (res.status === 404)
        return { success: false, error: "CNPJ não encontrado na Receita Federal" };
      if (res.status === 429)
        return { success: false, error: "Limite de consultas atingido, tente em alguns segundos" };
      return { success: false, error: `Erro ao consultar CNPJ (${res.status})` };
    }

    const raw = (await res.json()) as Record<string, unknown>;
    const str = (key: string) => (raw[key] as string | null | undefined) ?? undefined;
    const ddd = raw.ddd_telefone_1 as string | undefined;

    return {
      success: true,
      data: {
        cnpj: str("cnpj") ?? "",
        razaoSocial: str("razao_social") ?? "",
        nomeFantasia: str("nome_fantasia") ?? "",
        email: str("email"),
        telefone: ddd ? `(${ddd.slice(0, 2)}) ${ddd.slice(2).trim()}` : undefined,
        logradouro: str("logradouro"),
        numero: str("numero"),
        complemento: str("complemento"),
        bairro: str("bairro"),
        municipio: str("municipio"),
        uf: str("uf"),
        cep: str("cep"),
        segmento: str("cnae_fiscal_descricao"),
      },
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, error: "Consulta demorou muito, tente novamente" };
    }
    return { success: false, error: "Falha na consulta de CNPJ" };
  }
}

/* ── Detail / Stats ──────────────────────────────────────────────── */

export async function getSupplierDetailAction(supplierId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.supplier.findFirst({
    where: { id: supplierId, organizationId, deletedAt: null },
    include: {
      supplierProductMappings: {
        where: { active: true },
        include: {
          product: { select: { id: true, name: true, sku: true, imageUrl: true } },
          variant: { select: { id: true, name: true } },
        },
        orderBy: { lastPurchaseAt: "desc" },
      },
    },
  });
}

export async function getSupplierStatsAction(supplierId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const [aggregate, lastOrder, topProducts] = await Promise.all([
    prisma.purchaseOrder.aggregate({
      where: { supplierId, organizationId, status: { not: "CANCELED" } },
      _sum: { total: true },
      _count: { id: true },
      _avg: { total: true },
    }),
    prisma.purchaseOrder.findFirst({
      where: { supplierId, organizationId, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, total: true },
    }),
    prisma.purchaseOrderItem.groupBy({
      by: ["productId"],
      where: { purchaseOrder: { supplierId, organizationId, status: { not: "CANCELED" } } },
      _sum: { lineTotal: true },
      _count: { id: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
  ]);

  const productIds = topProducts.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return {
    totalPurchased: aggregate._sum.total ?? 0,
    orderCount: aggregate._count.id,
    avgTicket: aggregate._avg.total ?? 0,
    lastOrder,
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      productName: productMap[p.productId] ?? "—",
      totalValue: p._sum.lineTotal ?? 0,
      orderCount: p._count.id,
    })),
  };
}

export async function getSupplierPurchaseHistoryAction(
  supplierId: string,
  page = 1,
  pageSize = 20,
) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { supplierId, organizationId },
      include: {
        items: { select: { id: true } },
        receipts: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where: { supplierId, organizationId } }),
  ]);

  return { orders, total, page, pageSize };
}

export async function getSupplierPriceEvolutionAction(supplierId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.supplierProductMapping.findMany({
    where: { supplierId, organizationId, active: true },
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
      priceHistory: { orderBy: { recordedAt: "desc" }, take: 10 },
    },
  });
}

export async function getSupplierAccountsPayableAction(
  supplierId: string,
  page = 1,
  pageSize = 20,
) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const [payables, total] = await Promise.all([
    prisma.accountPayable.findMany({
      where: { supplierId, organizationId },
      include: {
        goodsReceipt: { select: { id: true, supplierInvoiceNumber: true } },
        purchaseOrder: { select: { id: true, number: true } },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accountPayable.count({ where: { supplierId, organizationId } }),
  ]);

  return { payables, total, page, pageSize };
}

export async function listSupplierMappingsAction(supplierId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const mappings = await prisma.supplierProductMapping.findMany({
    where: { organizationId, supplierId },
    include: {
      product: { select: { id: true, name: true, sku: true, imageUrl: true } },
      variant: { select: { id: true, name: true } },
    },
    orderBy: [{ isPreferred: "desc" }, { lastPurchaseAt: "desc" }],
  });

  return mappings.map((m) => ({
    id: m.id,
    supplierId: m.supplierId,
    productId: m.productId,
    variantId: m.variantId,
    supplierProductCode: m.supplierProductCode,
    supplierProductName: m.supplierProductName,
    purchaseUnit: m.purchaseUnit,
    defaultPackQuantity: m.defaultPackQuantity ? Number(m.defaultPackQuantity) : null,
    minOrderQuantity: m.minOrderQuantity ? Number(m.minOrderQuantity) : null,
    barcode: m.barcode,
    leadTimeDays: m.leadTimeDays,
    discountPercent: m.discountPercent ? Number(m.discountPercent) : null,
    lastCost: m.lastCost ? Number(m.lastCost) : null,
    previousCost: m.previousCost ? Number(m.previousCost) : null,
    lastPurchaseAt: m.lastPurchaseAt ? m.lastPurchaseAt.toISOString() : null,
    isPreferred: m.isPreferred,
    active: m.active,
    product: m.product,
    variant: m.variant,
  }));
}

export async function searchOrgProductsAction(search?: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}

export async function getSupplierAuditLogAction(supplierId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const [auditLogs, purchaseOrders, goodsReceipts, accountPayables] = await Promise.all([
    prisma.supplierAuditLog.findMany({
      where: { supplierId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.purchaseOrder.findMany({
      where: { supplierId, organizationId },
      select: { id: true, number: true, status: true, total: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.goodsReceipt.findMany({
      where: { organizationId, purchaseOrder: { supplierId } },
      select: {
        id: true,
        status: true,
        receivedAt: true,
        supplierInvoiceNumber: true,
        purchaseOrder: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.accountPayable.findMany({
      where: { supplierId, organizationId, status: "PAID" },
      select: { id: true, amount: true, paidAt: true, dueDate: true },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
  ]);

  return { auditLogs, purchaseOrders, goodsReceipts, accountPayables };
}
