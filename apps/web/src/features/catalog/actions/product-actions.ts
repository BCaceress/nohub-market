"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { productSchema, type ProductInput } from "../schemas";

/* ── RBAC ────────────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── List ────────────────────────────────────────────────────── */

export async function getProductsAction(
  organizationId: string,
  opts: {
    search?: string;
    categoryId?: string;
    productType?: string;
    isActive?: boolean;
    take?: number;
    skip?: number;
  } = {},
) {
  const where = {
    organizationId,
    deletedAt: null,
    ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.productType ? { productType: opts.productType as never } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" as const } },
            { sku: { contains: opts.search, mode: "insensitive" as const } },
            { barcode: { contains: opts.search, mode: "insensitive" as const } },
            { brand: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: { select: { variants: true, taxData: true } },
      },
      orderBy: { name: "asc" },
      take: opts.take ?? 100,
      skip: opts.skip ?? 0,
    }),
  ]);

  return { total, products };
}

export async function getProductAction(id: string, organizationId: string) {
  return prisma.product.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      barcodes: true,
      variants: { where: { isActive: true }, orderBy: { position: "asc" } },
      kitComponents: {
        include: {
          componentProduct: { select: { id: true, name: true, unit: true, productType: true } },
          componentVariant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { position: "asc" },
      },
      prices: { orderBy: { createdAt: "asc" } },
      taxData: true,
    },
  });
}

/* ── Create ──────────────────────────────────────────────────── */

export async function createProductAction(
  organizationId: string,
  input: ProductInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  // SKU unique per org (RN-C01)
  if (d.sku) {
    const skuExists = await prisma.product.findFirst({
      where: { organizationId, sku: d.sku, deletedAt: null },
    });
    if (skuExists) return { success: false, error: "SKU já cadastrado nesta organização" };
  }

  // barcode unique per org (RN-C01)
  if (d.barcode) {
    const bcExists = await prisma.product.findFirst({
      where: { organizationId, barcode: d.barcode, deletedAt: null },
    });
    if (bcExists) return { success: false, error: "Código de barras já cadastrado nesta organização" };
  }

  const product = await prisma.product.create({
    data: {
      organizationId,
      name: d.name,
      description: d.description || null,
      brand: d.brand || null,
      sku: d.sku || null,
      barcode: d.barcode || null,
      tags: d.tags,
      productType: d.productType,
      unit: d.unit,
      saleUnit: d.saleUnit,
      conversionFactor: d.conversionFactor,
      price: d.price,
      costPrice: d.costPrice ?? null,
      weight: d.weight ?? null,
      imageUrl: d.imageUrl || null,
      isActive: d.isActive,
      active: d.isActive, // compat field
      categoryId: d.categoryId || null,
      supplierId: d.supplierId || null,
      hasAgeRestriction: d.hasAgeRestriction,
      minAge: d.hasAgeRestriction ? (d.minAge ?? null) : null,
      expiryDays: d.expiryDays ?? null,
    },
  });

  // If barcode provided, also register in ProductBarcode
  if (d.barcode) {
    await prisma.productBarcode.create({
      data: {
        organizationId,
        productId: product.id,
        barcode: d.barcode,
        type: d.barcode.length === 8 ? "EAN8" : "EAN13",
      },
    }).catch(() => {}); // ignore if already exists (race)
  }

  // Create base price in ProductPrice if provided
  if (d.price > 0) {
    await prisma.productPrice.create({
      data: {
        organizationId,
        productId: product.id,
        price: d.price,
        cost: d.costPrice ?? null,
      },
    });
  }

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.created",
    resourceType: "Product",
    resourceId: product.id,
    after: { name: product.name, productType: product.productType, sku: product.sku },
  });

  revalidatePath("/app/products");
  return { success: true, data: { id: product.id } };
}

/* ── Update ──────────────────────────────────────────────────── */

export async function updateProductAction(
  organizationId: string,
  productId: string,
  input: ProductInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  // SKU conflict check (exclude self)
  if (d.sku) {
    const conflict = await prisma.product.findFirst({
      where: { organizationId, sku: d.sku, deletedAt: null, id: { not: productId } },
    });
    if (conflict) return { success: false, error: "SKU já cadastrado nesta organização" };
  }

  // productType is immutable (RN-C02)
  const existing = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: { productType: true },
  });
  if (existing && existing.productType !== d.productType) {
    return { success: false, error: "Tipo do produto é imutável após criação (RN-C02)" };
  }

  await prisma.product.updateMany({
    where: { id: productId, organizationId },
    data: {
      name: d.name,
      description: d.description || null,
      brand: d.brand || null,
      sku: d.sku || null,
      tags: d.tags,
      unit: d.unit,
      saleUnit: d.saleUnit,
      conversionFactor: d.conversionFactor,
      price: d.price,
      costPrice: d.costPrice ?? null,
      weight: d.weight ?? null,
      imageUrl: d.imageUrl || null,
      isActive: d.isActive,
      active: d.isActive,
      categoryId: d.categoryId || null,
      supplierId: d.supplierId || null,
      hasAgeRestriction: d.hasAgeRestriction,
      minAge: d.hasAgeRestriction ? (d.minAge ?? null) : null,
      expiryDays: d.expiryDays ?? null,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.updated",
    resourceType: "Product",
    resourceId: productId,
    after: { name: d.name, isActive: d.isActive },
  });

  revalidatePath("/app/products");
  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: null };
}

/* ── Archive (soft delete — RN-C10) ─────────────────────────── */

export async function archiveProductAction(
  organizationId: string,
  productId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.product.updateMany({
    where: { id: productId, organizationId },
    data: { deletedAt: new Date(), isActive: false, active: false },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.archived",
    resourceType: "Product",
    resourceId: productId,
  });

  revalidatePath("/app/products");
  return { success: true, data: null };
}

/* ── Getters aux ─────────────────────────────────────────────── */

export async function getProductCategoriesAction(organizationId: string) {
  return prisma.category.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true, parentId: true, slug: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}
