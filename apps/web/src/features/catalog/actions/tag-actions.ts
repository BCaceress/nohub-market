"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ── RBAC ────────────────────────────────────────────────────── */

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Slug ────────────────────────────────────────────────────── */

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── Schemas ─────────────────────────────────────────────────── */

/* ── Scope map — derivado do grupo ──────────────────────────── */

const SCOPE_BY_GROUP: Record<string, "SUBCATEGORY" | "PRODUCT"> = {
  tipo: "PRODUCT",
  volume: "PRODUCT",
  temperatura: "SUBCATEGORY",
  dieta: "SUBCATEGORY",
  publico: "SUBCATEGORY",
  ocasiao: "SUBCATEGORY",
  comercial: "PRODUCT",
  operacional: "PRODUCT",
  "bebidas-alcoolicas": "SUBCATEGORY",
  energeticos: "SUBCATEGORY",
  ia: "SUBCATEGORY",
  sazonalidade: "SUBCATEGORY",
  localizacao: "PRODUCT",
  marketplace: "PRODUCT",
  geral: "PRODUCT",
};

/* ── Schemas ─────────────────────────────────────────────────── */

const tagSchema = z.object({
  name: z.string().min(1).max(60),
  group: z.string().min(1).max(50).default("geral"),
  color: z.string().optional(),
  description: z.string().optional(),
  scope: z.enum(["SUBCATEGORY", "PRODUCT"]).optional(),
});

const bulkTagSchema = z.object({
  tags: z.array(
    z.object({
      name: z.string().min(1).max(60),
      group: z.string().min(1).max(50),
    }),
  ),
});

/* ── List ────────────────────────────────────────────────────── */

export async function getTagsAction(organizationId: string) {
  return prisma.tag.findMany({
    where: { organizationId },
    include: { _count: { select: { products: true } } },
    orderBy: [{ group: "asc" }, { name: "asc" }],
  });
}

/* ── Create ──────────────────────────────────────────────────── */

export async function createTagAction(
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

  const parsed = tagSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const { name, group, color, description, scope } = parsed.data;
  const baseSlug = generateSlug(name);

  const exists = await prisma.tag.findFirst({ where: { organizationId, slug: baseSlug } });
  const slug = exists ? `${baseSlug}-${Date.now()}` : baseSlug;

  const tag = await prisma.tag.create({
    data: {
      organizationId,
      name,
      slug,
      group,
      color: color || null,
      description: description || null,
      scope: scope ?? SCOPE_BY_GROUP[group] ?? "PRODUCT",
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "tag.created",
    resourceType: "Tag",
    resourceId: tag.id,
    after: { name, group, slug },
  });

  revalidatePath("/app/products/tags");
  return { success: true, data: { id: tag.id } };
}

/* ── Bulk create (from suggestions) ─────────────────────────── */

export async function bulkCreateTagsAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ count: number }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = bulkTagSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const { tags } = parsed.data;

  // Get existing slugs to avoid conflicts
  const existingSlugs = new Set(
    (await prisma.tag.findMany({ where: { organizationId }, select: { slug: true } })).map(
      (t) => t.slug,
    ),
  );

  const toCreate = tags
    .map((t) => {
      const slug = generateSlug(t.name);
      if (existingSlugs.has(slug)) return null;
      existingSlugs.add(slug);
      return {
        organizationId,
        name: t.name,
        slug,
        group: t.group,
        scope: SCOPE_BY_GROUP[t.group] ?? ("PRODUCT" as const),
      };
    })
    .filter(Boolean) as {
    organizationId: string;
    name: string;
    slug: string;
    group: string;
    scope: "SUBCATEGORY" | "PRODUCT";
  }[];

  if (toCreate.length === 0) return { success: true, data: { count: 0 } };

  await prisma.tag.createMany({ data: toCreate });

  revalidatePath("/app/products/tags");
  return { success: true, data: { count: toCreate.length } };
}

/* ── Update ──────────────────────────────────────────────────── */

export async function updateTagAction(
  organizationId: string,
  tagId: string,
  input: unknown,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = tagSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const { name, group, color, description, scope } = parsed.data;

  await prisma.tag.updateMany({
    where: { id: tagId, organizationId },
    data: {
      name,
      group,
      color: color || null,
      description: description || null,
      scope: scope ?? SCOPE_BY_GROUP[group] ?? "PRODUCT",
    },
  });

  revalidatePath("/app/products/tags");
  return { success: true, data: null };
}

/* ── Delete ──────────────────────────────────────────────────── */

export async function deleteTagAction(
  organizationId: string,
  tagId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.tag.delete({ where: { id: tagId, organizationId } });

  revalidatePath("/app/products/tags");
  return { success: true, data: null };
}

/* ── Product ↔ Tag association ───────────────────────────────── */

export async function addTagToProductAction(
  organizationId: string,
  productId: string,
  tagId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.productTag.upsert({
    where: { productId_tagId: { productId, tagId } },
    create: { productId, tagId },
    update: {},
  });

  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: null };
}

export async function removeTagFromProductAction(
  organizationId: string,
  productId: string,
  tagId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.productTag.deleteMany({ where: { productId, tagId } });

  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: null };
}

export async function setProductTagsAction(
  organizationId: string,
  productId: string,
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
    prisma.productTag.deleteMany({ where: { productId } }),
    prisma.productTag.createMany({
      data: tagIds.map((tagId) => ({ productId, tagId })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: null };
}
