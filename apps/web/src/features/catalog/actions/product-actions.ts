"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { type ProductInput, productSchema } from "../schemas";

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
    locationId?: string;
    isActive?: boolean;
    noFiscal?: boolean;
    take?: number;
    skip?: number;
  } = {},
) {
  // Filtrar por categoria inclui seus produtos diretos + os das subcategorias
  let categoryFilter: Record<string, unknown> = {};
  if (opts.categoryId) {
    const children = await prisma.category.findMany({
      where: { organizationId, parentId: opts.categoryId, deletedAt: null },
      select: { id: true },
    });
    const ids = [opts.categoryId, ...children.map((c) => c.id)];
    categoryFilter = { categoryId: { in: ids } };
  }

  const where = {
    organizationId,
    deletedAt: null,
    ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    ...categoryFilter,
    ...(opts.productType ? { productType: opts.productType as never } : {}),
    ...(opts.noFiscal ? { taxData: { none: {} } } : {}),
    ...(opts.locationId ? { stockEntries: { some: { locationId: opts.locationId } } } : {}),
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
        taxData: { select: { ncm: true, cest: true } },
        _count: {
          select: {
            variants: true,
            taxData: true,
            prices: { where: { locationId: { not: null } } },
          },
        },
        prices: {
          where: opts.locationId
            ? { locationId: opts.locationId, variantId: null }
            : { locationId: { not: null }, variantId: null },
          select: {
            id: true,
            price: true,
            promoPrice: true,
            location: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        stockEntries: {
          where: opts.locationId ? { locationId: opts.locationId } : undefined,
          select: {
            id: true,
            quantity: true,
            minQuantity: true,
            location: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
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
      productTags: {
        include: { tag: { select: { id: true, name: true, group: true, color: true } } },
      },
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
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

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
    if (bcExists)
      return { success: false, error: "Código de barras já cadastrado nesta organização" };
  }

  const product = await prisma.product.create({
    data: {
      organizationId,
      name: d.name,
      posName: d.posName || null,
      description: d.description || null,
      brand: d.brand || null,
      brandId: d.brandId || null,
      sku: d.sku || null,
      barcode: d.barcode || null,
      tags: d.tags,
      productType: d.productType,
      unit: d.unit,
      saleUnit: d.saleUnit,
      conversionFactor: d.conversionFactor,
      packUnit: d.packUnit ?? null,
      packSize: d.packSize ?? null,
      price: d.price,
      costPrice: d.costPrice ?? null,
      weight: d.weight ?? null,
      height: d.height ?? null,
      width: d.width ?? null,
      length: d.length ?? null,
      imageUrl: d.imageUrl || null,
      stockMin: d.stockMin ?? null,
      stockIdeal: d.stockIdeal ?? null,
      location: d.location || null,
      isActive: d.isActive,
      active: d.isActive, // compat field
      categoryId: d.categoryId || null,
      supplierId: d.supplierId || null,
      hasAgeRestriction: d.hasAgeRestriction,
      minAge: d.hasAgeRestriction ? (d.minAge ?? null) : null,
      expiryDays: d.expiryDays ?? null,
      storageTemperature: d.storageTemperature || null,
    },
  });

  // If barcode provided, also register in ProductBarcode
  if (d.barcode) {
    await prisma.productBarcode
      .create({
        data: {
          organizationId,
          productId: product.id,
          barcode: d.barcode,
          type: d.barcode.length === 8 ? "EAN8" : "EAN13",
        },
      })
      .catch(() => {}); // ignore if already exists (race)
  }

  // Pack/wholesale barcode (caixa, fardo) — DUN14
  if (d.packBarcode && d.packBarcode !== d.barcode) {
    await prisma.productBarcode
      .create({
        data: {
          organizationId,
          productId: product.id,
          barcode: d.packBarcode,
          type: "DUN14",
        },
      })
      .catch(() => {});
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
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

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
      posName: d.posName || null,
      description: d.description || null,
      brand: d.brand || null,
      sku: d.sku || null,
      tags: d.tags,
      unit: d.unit,
      saleUnit: d.saleUnit,
      conversionFactor: d.conversionFactor,
      packUnit: d.packUnit ?? null,
      packSize: d.packSize ?? null,
      price: d.price,
      costPrice: d.costPrice ?? null,
      weight: d.weight ?? null,
      height: d.height ?? null,
      width: d.width ?? null,
      length: d.length ?? null,
      imageUrl: d.imageUrl || null,
      stockMin: d.stockMin ?? null,
      stockIdeal: d.stockIdeal ?? null,
      location: d.location || null,
      isActive: d.isActive,
      active: d.isActive,
      categoryId: d.categoryId || null,
      supplierId: d.supplierId || null,
      hasAgeRestriction: d.hasAgeRestriction,
      minAge: d.hasAgeRestriction ? (d.minAge ?? null) : null,
      expiryDays: d.expiryDays ?? null,
      storageTemperature: d.storageTemperature || null,
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

/* ── Set active (inativar/ativar sem deletar) ───────────────── */

export async function setProductActiveAction(
  organizationId: string,
  productId: string,
  isActive: boolean,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.product.updateMany({
    where: { id: productId, organizationId, deletedAt: null },
    data: { isActive, active: isActive },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: isActive ? "product.activated" : "product.inactivated",
    resourceType: "Product",
    resourceId: productId,
  });

  revalidatePath("/app/products");
  return { success: true, data: null };
}

/* ── Bulk set active ─────────────────────────────────────────── */

export async function bulkSetProductsActiveAction(
  organizationId: string,
  productIds: string[],
  isActive: boolean,
): Promise<Result<{ count: number }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  if (productIds.length === 0) return { success: true, data: { count: 0 } };

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds }, organizationId, deletedAt: null },
    data: { isActive, active: isActive },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: isActive ? "product.bulk_activated" : "product.bulk_inactivated",
    resourceType: "Product",
    resourceId: productIds.join(","),
    metadata: { count: result.count },
  });

  revalidatePath("/app/products");
  return { success: true, data: { count: result.count } };
}

/* ── Duplicate ───────────────────────────────────────────────── */

export async function duplicateProductAction(
  organizationId: string,
  productId: string,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const src = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
  });
  if (!src) return { success: false, error: "Produto não encontrado" };

  const cloned = await prisma.product.create({
    data: {
      organizationId: src.organizationId,
      name: `${src.name} (cópia)`,
      description: src.description,
      brand: src.brand,
      sku: null,
      barcode: null,
      tags: src.tags,
      productType: src.productType,
      unit: src.unit,
      saleUnit: src.saleUnit,
      conversionFactor: src.conversionFactor,
      packUnit: src.packUnit,
      packSize: src.packSize,
      price: src.price,
      costPrice: src.costPrice,
      weight: src.weight,
      height: src.height,
      width: src.width,
      length: src.length,
      imageUrl: src.imageUrl,
      categoryId: src.categoryId,
      supplierId: src.supplierId,
      isActive: src.isActive,
      active: src.active,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.duplicated",
    resourceType: "Product",
    resourceId: cloned.id,
    metadata: { sourceId: src.id },
  });

  revalidatePath("/app/products");
  return { success: true, data: { id: cloned.id } };
}

/* ── Archive (soft delete — RN-C10) ─────────────────────────── */

export async function archiveProductAction(
  organizationId: string,
  productId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
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
    select: {
      id: true,
      name: true,
      icon: true,
      parentId: true,
      slug: true,
      hasAgeRestriction: true,
      storageTemperature: true,
      controlsExpiry: true,
      controlsLot: true,
      defaultTags: {
        include: { tag: { select: { id: true, name: true, group: true, color: true } } },
      },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

/* ── SKU sequencial (PRD-NNNNNN) ─────────────────────────────── */

/**
 * Próximo SKU sequencial da organização no padrão PRD-000123.
 * Usado pelo Cadastro Rápido (gerado no load, somente leitura).
 * Unicidade final é garantida no create; em colisão, gerar de novo.
 */
export async function generateNextSkuAction(
  organizationId: string,
): Promise<{ success: true; sku: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const rows = await prisma.product.findMany({
    where: { organizationId, sku: { startsWith: "PRD-" } },
    select: { sku: true },
  });

  let max = 0;
  for (const { sku } of rows) {
    const n = Number(sku?.slice(4));
    if (Number.isFinite(n) && n > max) max = n;
  }

  return { success: true, sku: `PRD-${String(max + 1).padStart(6, "0")}` };
}

/* ── SKU generation (por categoria) ──────────────────────────── */

export async function generateSkuAction(
  organizationId: string,
  categoryId: string,
): Promise<{ success: true; sku: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId, deletedAt: null },
    include: { parent: { select: { name: true } } },
  });
  if (!category) return { success: false, error: "Categoria não encontrada" };

  // Prefixo: primeiras 3 letras (uppercase, sem acentos)
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3)
      .padEnd(3, "X");

  const catPrefix = normalize(category.name);
  const parentPrefix = category.parent ? normalize(category.parent.name) : catPrefix;

  // Prefixo final: PAI-CAT (se houver pai) ou CAT-CAT (se raiz)
  const prefix = category.parent ? `${parentPrefix}-${catPrefix}` : catPrefix;

  // 4-digit random suffix, unique per org (retry up to 20 times)
  const existing = await prisma.product.findMany({
    where: { organizationId, sku: { startsWith: `${prefix}-` }, deletedAt: null },
    select: { sku: true },
  });
  const usedSuffixes = new Set(existing.map((p) => p.sku?.slice(prefix.length + 1)));

  for (let attempt = 0; attempt < 20; attempt++) {
    const rand = String(Math.floor(Math.random() * 9000) + 1000); // 1000–9999
    if (!usedSuffixes.has(rand)) {
      return { success: true, sku: `${prefix}-${rand}` };
    }
  }
  // Fallback: timestamp-based suffix
  return { success: true, sku: `${prefix}-${Date.now().toString().slice(-4)}` };
}

/* ── Duplicate detection by barcode ──────────────────────────── */

export async function findProductByBarcodeAction(
  organizationId: string,
  barcode: string,
): Promise<{ id: string; name: string; imageUrl: string | null; sku: string | null } | null> {
  const session = await getSession();
  if (!session) return null;

  const clean = barcode.trim().replace(/\D/g, "");
  if (clean.length < 8) return null;

  // Check legacy Product.barcode and canonical ProductBarcode
  const [direct, viaTable] = await Promise.all([
    prisma.product.findFirst({
      where: { organizationId, barcode: clean, deletedAt: null },
      select: { id: true, name: true, imageUrl: true, sku: true },
    }),
    prisma.productBarcode.findFirst({
      where: { organizationId, barcode: clean },
      select: {
        product: {
          select: { id: true, name: true, imageUrl: true, sku: true, deletedAt: true },
        },
      },
    }),
  ]);

  if (direct) return direct;
  if (viaTable?.product && !viaTable.product.deletedAt) {
    const { id, name, imageUrl, sku } = viaTable.product;
    return { id, name, imageUrl, sku };
  }
  return null;
}

/* ── Catalog autocomplete (anti-duplicado) ───────────────────── */

export interface CatalogMatch {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
  categoryName: string | null;
}

/** Busca produtos da org por nome/SKU/EAN — usado no autocomplete do cadastro. */
export async function searchCatalogAction(
  organizationId: string,
  query: string,
): Promise<CatalogMatch[]> {
  const session = await getSession();
  if (!session) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const rows = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q.replace(/\D/g, "") || q } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      brand: true,
      sku: true,
      barcode: true,
      imageUrl: true,
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 8,
  });

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    sku: p.sku,
    barcode: p.barcode,
    imageUrl: p.imageUrl,
    categoryName: p.category?.name ?? null,
  }));
}

/* ── Product search for Kit composer ─────────────────────────── */

export async function searchProductsForKitAction(
  organizationId: string,
  query: string,
): Promise<
  Array<{
    id: string;
    name: string;
    unit: string;
    costPrice: number | null;
    imageUrl: string | null;
  }>
> {
  const session = await getSession();
  if (!session) return [];

  const rows = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      productType: { not: "KIT" }, // RN-C04
      isActive: true,
      ...(query.trim()
        ? {
            OR: [
              { name: { contains: query.trim(), mode: "insensitive" } },
              { sku: { contains: query.trim(), mode: "insensitive" } },
              { barcode: { contains: query.trim() } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, unit: true, costPrice: true, imageUrl: true },
    orderBy: { name: "asc" },
    take: 15,
  });

  return rows.map((p) => ({
    ...p,
    costPrice: p.costPrice ? Number(p.costPrice) : null,
  }));
}

/* ── Fornecedores do produto (multi) ─────────────────────────── */

/**
 * Vincula um ou mais fornecedores a um produto via SupplierProductMapping.
 * O primeiro da lista vira o supplierId principal do produto.
 * `code` é usado como supplierProductCode (SKU ou EAN do produto).
 */
export async function setProductSuppliersAction(
  organizationId: string,
  productId: string,
  supplierIds: string[],
  opts: { code: string; name: string },
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const ids = [...new Set(supplierIds.filter(Boolean))];
  if (ids.length === 0) return { success: true, data: null };

  const code = opts.code.trim() || productId;
  const name = opts.name.trim() || code;

  await prisma.product.update({
    where: { id: productId },
    data: { supplierId: ids[0] },
  });

  for (const supplierId of ids) {
    await prisma.supplierProductMapping
      .upsert({
        where: { supplierId_supplierProductCode: { supplierId, supplierProductCode: code } },
        create: {
          organizationId,
          supplierId,
          supplierProductCode: code,
          supplierProductName: name,
          productId,
        },
        update: { productId, supplierProductName: name },
      })
      .catch(() => {});
  }

  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: null };
}
