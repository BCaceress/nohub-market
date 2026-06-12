"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";

const productSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.coerce.number().min(0, "Preço inválido"),
  costPrice: z.coerce.number().min(0).optional(),
  unit: z.enum(["UN", "KG", "G", "L", "ML", "CX", "PCT"]).default("UN"),
  supplierId: z.string().optional(),
  active: z.boolean().default(true),
  hasAgeRestriction: z.boolean().default(false),
  minAge: z.coerce.number().int().min(0).optional(),
  allowFractioned: z.boolean().default(false),
});

export type ProductInput = z.infer<typeof productSchema>;

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

export async function getProductsAction(
  organizationId: string,
  opts: { search?: string; active?: boolean } = {},
) {
  return prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(opts.active !== undefined ? { active: opts.active } : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: "insensitive" } },
              { sku: { contains: opts.search, mode: "insensitive" } },
              { barcode: { contains: opts.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });
}

export async function getProductAction(id: string, organizationId: string) {
  return prisma.product.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: { supplier: { select: { id: true, name: true } } },
  });
}

export async function getProductCategoriesAction(organizationId: string) {
  // Return category names from the Category relation
  const rows = await prisma.category.findMany({
    where: { organizationId, deletedAt: null },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.name);
}

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
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { price, costPrice, ...rest } = parsed.data;
  const product = await prisma.product.create({
    data: {
      ...rest,
      organizationId,
      price,
      costPrice: costPrice ?? null,
      supplierId: rest.supplierId || null,
      minAge: rest.hasAgeRestriction ? (rest.minAge ?? null) : null,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.created",
    resourceType: "Product",
    resourceId: product.id,
    after: { name: product.name },
  });

  revalidatePath("/app/catalog");
  return { success: true, data: { id: product.id } };
}

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
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const { price, costPrice, ...rest } = parsed.data;
  await prisma.product.updateMany({
    where: { id: productId, organizationId },
    data: {
      ...rest,
      price,
      costPrice: costPrice ?? null,
      supplierId: rest.supplierId || null,
      minAge: rest.hasAgeRestriction ? (rest.minAge ?? null) : null,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.updated",
    resourceType: "Product",
    resourceId: productId,
    after: { name: parsed.data.name },
  });

  revalidatePath("/app/catalog");
  return { success: true, data: null };
}

export async function toggleProductAction(
  organizationId: string,
  productId: string,
  active: boolean,
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
    data: { active },
  });

  revalidatePath("/app/catalog");
  return { success: true, data: null };
}

export async function deleteProductAction(
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
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.deleted",
    resourceType: "Product",
    resourceId: productId,
  });

  revalidatePath("/app/catalog");
  return { success: true, data: null };
}
