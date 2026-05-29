"use server";

import { prisma } from "@nohub/db";
import { getSession } from "@/lib/auth-server";

export type ProductPackage = {
  id: string;
  barcode: string;
  label: string | null;
  factor: number;
  isDefault: boolean;
  sortOrder: number;
  type: string;
};

export async function listProductPackagesAction(
  organizationId: string,
  productId: string,
): Promise<ProductPackage[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await prisma.productBarcode.findMany({
    where: { organizationId, productId },
    orderBy: [{ sortOrder: "asc" }, { factor: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    barcode: r.barcode,
    label: r.label,
    factor: Number(r.factor),
    isDefault: r.isDefault,
    sortOrder: r.sortOrder,
    type: r.type,
  }));
}

export async function upsertProductPackageAction(
  organizationId: string,
  productId: string,
  data: {
    id?: string;
    barcode: string;
    label?: string | null;
    factor: number;
    isDefault?: boolean;
    sortOrder?: number;
  },
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const barcode = data.barcode.trim().replace(/\s+/g, "");
  if (!barcode) return { success: false, error: "Código de barras obrigatório" };
  if (!Number.isFinite(data.factor) || data.factor <= 0) {
    return { success: false, error: "Fator deve ser maior que zero" };
  }

  const type = barcode.length === 14 ? "DUN14" : barcode.length === 8 ? "EAN8" : "EAN13";

  try {
    if (data.isDefault) {
      await prisma.productBarcode.updateMany({
        where: { organizationId, productId, isDefault: true, NOT: data.id ? { id: data.id } : {} },
        data: { isDefault: false },
      });
    }

    if (data.id) {
      const row = await prisma.productBarcode.update({
        where: { id: data.id },
        data: {
          barcode,
          label: data.label ?? null,
          factor: data.factor,
          isDefault: data.isDefault ?? false,
          sortOrder: data.sortOrder ?? 0,
          type,
        },
      });
      return { success: true, id: row.id };
    }

    const row = await prisma.productBarcode.create({
      data: {
        organizationId,
        productId,
        barcode,
        label: data.label ?? null,
        factor: data.factor,
        isDefault: data.isDefault ?? false,
        sortOrder: data.sortOrder ?? 0,
        type,
      },
    });
    return { success: true, id: row.id };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === "P2002") return { success: false, error: "Código já cadastrado" };
    return { success: false, error: e.message ?? "Erro ao salvar embalagem" };
  }
}

export async function deleteProductPackageAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await prisma.productBarcode.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    const e = err as { message?: string };
    return { success: false, error: e.message ?? "Erro ao remover embalagem" };
  }
}

/**
 * Lookup por código de barras retornando produto + fator da embalagem.
 * Para uso no PDV: bipar "Fardo 6" soma 6 ao invés de 1.
 */
export async function findProductByBarcodeWithPackageAction(
  organizationId: string,
  barcode: string,
): Promise<{
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  price: number;
  factor: number;
  label: string | null;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const clean = barcode.trim().replace(/\D/g, "");
  if (clean.length < 8) return null;

  const row = await prisma.productBarcode.findFirst({
    where: { organizationId, barcode: clean },
    select: {
      label: true,
      factor: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          price: true,
          deletedAt: true,
          isActive: true,
        },
      },
    },
  });

  if (row?.product && !row.product.deletedAt && row.product.isActive) {
    return {
      productId: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      unit: row.product.unit,
      price: Number(row.product.price),
      factor: Number(row.factor),
      label: row.label,
    };
  }

  // Fallback: barcode legado em Product.barcode (factor = 1)
  const direct = await prisma.product.findFirst({
    where: { organizationId, barcode: clean, deletedAt: null, isActive: true },
    select: { id: true, name: true, sku: true, unit: true, price: true },
  });
  if (direct) {
    return {
      productId: direct.id,
      name: direct.name,
      sku: direct.sku,
      unit: direct.unit,
      price: Number(direct.price),
      factor: 1,
      label: null,
    };
  }

  return null;
}
