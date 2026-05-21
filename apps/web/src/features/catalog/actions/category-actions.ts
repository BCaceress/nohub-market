"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { categorySchema, categoryTaxDefaultSchema } from "../schemas";

/* ── RBAC ────────────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Slug generation ─────────────────────────────────────────── */

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── List ────────────────────────────────────────────────────── */

export async function getCategoriesAction(organizationId: string) {
  return prisma.category.findMany({
    where: { organizationId, deletedAt: null },
    include: {
      children: {
        where: { deletedAt: null },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
      taxDefault: true,
      defaultTags: {
        include: { tag: { select: { id: true, name: true, group: true, color: true } } },
      },
      _count: { select: { products: true } },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function getCategoryDefaultTagsAction(categoryId: string) {
  const rows = await prisma.categoryTag.findMany({
    where: { categoryId },
    include: { tag: { select: { id: true, name: true, group: true, color: true } } },
  });
  return rows.map((r) => r.tag);
}

export async function getCategoryAction(id: string, organizationId: string) {
  return prisma.category.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: { taxDefault: true, children: { where: { deletedAt: null } } },
  });
}

/* ── Create ──────────────────────────────────────────────────── */

export async function createCategoryAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const { name, parentId, position, icon, iconColor } = parsed.data;
  const slug = parsed.data.slug || generateSlug(name);

  // Ensure slug uniqueness within org
  const exists = await prisma.category.findFirst({
    where: { organizationId, slug, deletedAt: null },
  });
  const finalSlug = exists ? `${slug}-${Date.now()}` : slug;

  const category = await prisma.category.create({
    data: {
      organizationId,
      name,
      slug: finalSlug,
      icon: icon || null,
      iconColor: iconColor || "#f59e0b",
      parentId: parentId || null,
      position,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "category.created",
    resourceType: "Category",
    resourceId: category.id,
    after: { name, slug: finalSlug },
  });

  revalidatePath("/app/products/categories");
  return { success: true, data: { id: category.id } };
}

/* ── Update ──────────────────────────────────────────────────── */

export async function updateCategoryAction(
  organizationId: string,
  categoryId: string,
  input: unknown,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const { name, parentId, position, icon, iconColor } = parsed.data;

  await prisma.category.updateMany({
    where: { id: categoryId, organizationId },
    data: {
      name,
      icon: icon || null,
      iconColor: iconColor || "#f59e0b",
      parentId: parentId || null,
      position,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "category.updated",
    resourceType: "Category",
    resourceId: categoryId,
    after: { name },
  });

  revalidatePath("/app/products/categories");
  return { success: true, data: null };
}

/* ── Delete (soft) ───────────────────────────────────────────── */

export async function deleteCategoryAction(
  organizationId: string,
  categoryId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.category.updateMany({
    where: { id: categoryId, organizationId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/app/products/categories");
  return { success: true, data: null };
}

/* ── Fiscal default ──────────────────────────────────────────── */

export async function setCategoryTaxDefaultAction(
  organizationId: string,
  input: unknown,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = categoryTaxDefaultSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const {
    categoryId,
    ncm,
    cest,
    cfopInternal,
    cfopInterstate,
    origin,
    icmsCst,
    icmsCsosn,
    icmsRate,
    pisCst,
    pisRate,
    cofinsCst,
    cofinsRate,
  } = parsed.data;

  const taxPayload = {
    ncm: ncm || null,
    cest: cest || null,
    cfopInternal: cfopInternal || null,
    cfopInterstate: cfopInterstate || null,
    origin,
    icmsCst: (icmsCst || null) as string | null,
    icmsCsosn: (icmsCsosn || null) as string | null,
    icmsRate: icmsRate ?? null,
    pisCst: pisCst || null,
    pisRate: pisRate ?? null,
    cofinsCst: cofinsCst || null,
    cofinsRate: cofinsRate ?? null,
  };

  await prisma.categoryTaxDefault.upsert({
    where: { categoryId },
    create: { organizationId, categoryId, ...taxPayload },
    update: taxPayload,
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "category.tax_default.set",
    resourceType: "CategoryTaxDefault",
    resourceId: categoryId,
    after: { ncm, cest },
  });

  revalidatePath("/app/products/categories");
  return { success: true, data: null };
}

/* ── Category default tags ───────────────────────────────────── */

export async function setCategoryTagsAction(
  organizationId: string,
  categoryId: string,
  tagIds: string[],
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.$transaction([
    prisma.categoryTag.deleteMany({ where: { categoryId } }),
    prisma.categoryTag.createMany({
      data: tagIds.map((tagId) => ({ categoryId, tagId })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath("/app/products/categories");
  return { success: true, data: null };
}
