"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ── RBAC guard ─────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Stats ──────────────────────────────────────────────────── */

export async function getInventoryStatsAction(organizationId: string) {
  const [totalProducts, totalEntries, lowStockEntries, expiringEntries] =
    await Promise.all([
      prisma.product.count({ where: { organizationId, deletedAt: null, active: true } }),

      prisma.stockEntry.aggregate({
        where: { organizationId },
        _sum: { quantity: true },
        _count: true,
      }),

      // stock below minQuantity
      prisma.stockEntry.findMany({
        where: {
          organizationId,
          minQuantity: { not: null },
        },
        select: {
          id: true,
          quantity: true,
          minQuantity: true,
          product: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      }).then((rows) =>
        rows.filter((r) => r.minQuantity !== null && Number(r.quantity) <= Number(r.minQuantity)),
      ),

      // expiring within 30 days
      prisma.stockEntry.findMany({
        where: {
          organizationId,
          expiryDate: {
            not: null,
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
        include: {
          product: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 20,
      }),
    ]);

  const recentMovements = await prisma.stockMovement.findMany({
    where: { organizationId },
    include: {
      product: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    totalProducts,
    totalStockUnits: Number(totalEntries._sum.quantity ?? 0),
    totalEntries: totalEntries._count,
    lowStockCount: lowStockEntries.length,
    lowStockItems: lowStockEntries.slice(0, 5),
    expiringCount: expiringEntries.length,
    expiringItems: expiringEntries.slice(0, 5),
    recentMovements,
  };
}

/* ── Unit stock ─────────────────────────────────────────────── */

export async function getLocationStockAction(
  organizationId: string,
  locationId: string,
  opts: { search?: string; lowStock?: boolean } = {},
) {
  const entries = await prisma.stockEntry.findMany({
    where: {
      organizationId,
      locationId,
      ...(opts.search
        ? {
            product: {
              OR: [
                { name: { contains: opts.search, mode: "insensitive" } },
                { sku: { contains: opts.search, mode: "insensitive" } },
                { barcode: { contains: opts.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unit: true,
          category: true,
          price: true,
          costPrice: true,
          imageUrl: true,
          active: true,
        },
      },
    },
    orderBy: { product: { name: "asc" } },
    take: 300,
  });

  if (opts.lowStock) {
    return entries.filter(
      (e) => e.minQuantity !== null && Number(e.quantity) <= Number(e.minQuantity),
    );
  }

  return entries;
}

/* ── Movement log ───────────────────────────────────────────── */

export async function getMovementsAction(
  organizationId: string,
  opts: {
    locationId?: string;
    productId?: string;
    type?: string;
    from?: Date;
    to?: Date;
    take?: number;
    skip?: number;
  } = {},
) {
  const where = {
    organizationId,
    ...(opts.locationId ? { locationId: opts.locationId } : {}),
    ...(opts.productId ? { productId: opts.productId } : {}),
    ...(opts.type ? { type: opts.type as never } : {}),
    ...(opts.from || opts.to
      ? {
          createdAt: {
            ...(opts.from ? { gte: opts.from } : {}),
            ...(opts.to ? { lte: opts.to } : {}),
          },
        }
      : {}),
  };

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, unit: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
    }),
  ]);

  return { total, movements };
}

/* ── Receive stock (entrada) ────────────────────────────────── */

const receiveStockSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().positive("Quantidade deve ser positiva"),
  costPrice: z.coerce.number().min(0).optional(),
  expiryDate: z.string().optional(),
  batchCode: z.string().optional(),
  shelfLocation: z.string().optional(),
  notes: z.string().optional(),
});

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export async function receiveStockAction(
  organizationId: string,
  input: ReceiveStockInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = receiveStockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { locationId, productId, quantity, costPrice, expiryDate, batchCode, shelfLocation, notes } =
    parsed.data;

  const existing = await prisma.stockEntry.findUnique({
    where: { locationId_productId: { locationId, productId } },
  });

  const previousQty = existing ? Number(existing.quantity) : 0;
  const newQty = previousQty + quantity;

  await prisma.$transaction([
    prisma.stockEntry.upsert({
      where: { locationId_productId: { locationId, productId } },
      create: {
        organizationId,
        locationId,
        productId,
        quantity: newQty,
        ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
        batchCode: batchCode || null,
        shelfLocation: shelfLocation || null,
      },
      update: {
        quantity: newQty,
        ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
        ...(batchCode ? { batchCode } : {}),
        ...(shelfLocation ? { shelfLocation } : {}),
      },
    }),

    prisma.stockMovement.create({
      data: {
        organizationId,
        locationId,
        productId,
        type: "IN",
        quantity,
        previousQty,
        newQty,
        notes: notes || null,
        userId: session.user.id,
        userName: session.user.name,
      },
    }),

    ...(costPrice !== undefined
      ? [
          prisma.product.updateMany({
            where: { id: productId, organizationId },
            data: { costPrice },
          }),
        ]
      : []),
  ]);

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "stock.received",
    resourceType: "StockEntry",
    resourceId: `${locationId}:${productId}`,
    after: { quantity: newQty, previousQty, locationId, productId },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}

/* ── Adjust stock (loss / adjustment) ───────────────────────── */

const adjustStockSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  type: z.enum(["OUT", "LOSS", "ADJUSTMENT"]),
  quantity: z.coerce.number().positive("Quantidade deve ser positiva"),
  notes: z.string().optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export async function adjustStockAction(
  organizationId: string,
  input: AdjustStockInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { locationId, productId, type, quantity, notes } = parsed.data;

  const existing = await prisma.stockEntry.findUnique({
    where: { locationId_productId: { locationId, productId } },
  });

  const previousQty = existing ? Number(existing.quantity) : 0;
  let newQty: number;

  if (type === "ADJUSTMENT") {
    // quantity IS the new absolute value
    newQty = quantity;
  } else {
    // OUT / LOSS: subtract
    newQty = Math.max(0, previousQty - quantity);
  }

  await prisma.$transaction([
    prisma.stockEntry.upsert({
      where: { locationId_productId: { locationId, productId } },
      create: {
        organizationId,
        locationId,
        productId,
        quantity: newQty,
      },
      update: { quantity: newQty },
    }),

    prisma.stockMovement.create({
      data: {
        organizationId,
        locationId,
        productId,
        type,
        quantity: type === "ADJUSTMENT" ? Math.abs(newQty - previousQty) : quantity,
        previousQty,
        newQty,
        notes: notes || null,
        userId: session.user.id,
        userName: session.user.name,
      },
    }),
  ]);

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: `stock.${type.toLowerCase()}`,
    resourceType: "StockEntry",
    resourceId: `${locationId}:${productId}`,
    after: { type, quantity, newQty, previousQty },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}

/* ── Transfer between units ─────────────────────────────────── */

const transferSchema = z.object({
  fromLocationId: z.string().min(1),
  toLocationId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().positive("Quantidade deve ser positiva"),
  notes: z.string().optional(),
}).refine((d) => d.fromLocationId !== d.toLocationId, {
  message: "Origem e destino devem ser diferentes",
  path: ["toLocationId"],
});

export type TransferInput = z.infer<typeof transferSchema>;

export async function createTransferAction(
  organizationId: string,
  input: TransferInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { fromLocationId, toLocationId, productId, quantity, notes } = parsed.data;

  const fromEntry = await prisma.stockEntry.findUnique({
    where: { locationId_productId: { locationId: fromLocationId, productId } },
  });

  if (!fromEntry || Number(fromEntry.quantity) < quantity) {
    return { success: false, error: "Estoque insuficiente na unidade de origem" };
  }

  const toEntry = await prisma.stockEntry.findUnique({
    where: { locationId_productId: { locationId: toLocationId, productId } },
  });

  const fromPrev = Number(fromEntry.quantity);
  const fromNew = fromPrev - quantity;
  const toPrev = toEntry ? Number(toEntry.quantity) : 0;
  const toNew = toPrev + quantity;

  const transfer = await prisma.$transaction(async (tx) => {
    const t = await tx.stockTransfer.create({
      data: {
        organizationId,
        fromLocationId,
        toLocationId,
        productId,
        quantity,
        notes: notes || null,
        status: "completed",
        userId: session.user.id,
        userName: session.user.name,
      },
    });

    await tx.stockEntry.update({
      where: { locationId_productId: { locationId: fromLocationId, productId } },
      data: { quantity: fromNew },
    });

    await tx.stockEntry.upsert({
      where: { locationId_productId: { locationId: toLocationId, productId } },
      create: {
        organizationId,
        locationId: toLocationId,
        productId,
        quantity: toNew,
      },
      update: { quantity: toNew },
    });

    await tx.stockMovement.createMany({
      data: [
        {
          organizationId,
          locationId: fromLocationId,
          productId,
          type: "TRANSFER_OUT",
          quantity,
          previousQty: fromPrev,
          newQty: fromNew,
          transferId: t.id,
          notes: notes || null,
          userId: session.user.id,
          userName: session.user.name,
        },
        {
          organizationId,
          locationId: toLocationId,
          productId,
          type: "TRANSFER_IN",
          quantity,
          previousQty: toPrev,
          newQty: toNew,
          transferId: t.id,
          notes: notes || null,
          userId: session.user.id,
          userName: session.user.name,
        },
      ],
    });

    return t;
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "stock.transferred",
    resourceType: "StockTransfer",
    resourceId: transfer.id,
    after: { fromLocationId, toLocationId, productId, quantity },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}

/* ── Update min/max thresholds ───────────────────────────────── */

const thresholdSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  minQuantity: z.coerce.number().min(0).optional(),
  maxQuantity: z.coerce.number().min(0).optional(),
});

export async function updateStockThresholdsAction(
  organizationId: string,
  input: z.infer<typeof thresholdSchema>,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = thresholdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { locationId, productId, minQuantity, maxQuantity } = parsed.data;

  await prisma.stockEntry.upsert({
    where: { locationId_productId: { locationId, productId } },
    create: {
      organizationId,
      locationId,
      productId,
      quantity: 0,
      minQuantity: minQuantity ?? null,
      maxQuantity: maxQuantity ?? null,
    },
    update: {
      minQuantity: minQuantity ?? null,
      maxQuantity: maxQuantity ?? null,
    },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: null };
}
