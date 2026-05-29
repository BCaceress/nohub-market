"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
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

type FlatCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  iconColor: string | null;
  parentId: string | null;
  position: number;
  hasAgeRestriction: boolean;
  storageTemperature: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
  controlsExpiry: boolean;
  controlsLot: boolean;
  taxDefault: {
    ncm: string | null;
    cest: string | null;
    cfopInternal: string | null;
    cfopInterstate: string | null;
    origin: string;
    icmsCst: string | null;
    icmsCsosn: string | null;
    icmsRate: { toString(): string } | null;
    pisCst: string | null;
    pisRate: { toString(): string } | null;
    cofinsCst: string | null;
    cofinsRate: { toString(): string } | null;
    ipiCst: string | null;
    ipiRate: { toString(): string } | null;
    unitTaxable: boolean;
  } | null;
  defaultTags: { tag: { id: string; name: string; group: string | null; color: string | null } }[];
  _count: { products: number };
  children: FlatCategory[];
};

/**
 * Fetch all categories flat then build infinite-depth tree in memory.
 */
export async function getCategoriesAction(organizationId: string): Promise<FlatCategory[]> {
  const rows = await prisma.category.findMany({
    where: { organizationId, deletedAt: null },
    include: {
      taxDefault: true,
      defaultTags: {
        include: { tag: { select: { id: true, name: true, group: true, color: true } } },
      },
      _count: { select: { products: true } },
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  // Build map id → node (with empty children array)
  const map = new Map<string, FlatCategory>();
  for (const row of rows) {
    map.set(row.id, { ...row, children: [] } as FlatCategory);
  }

  // Wire children
  const roots: FlatCategory[] = [];
  for (const node of map.values()) {
    if (node.parentId) {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // orphan → treat as root
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
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

  const {
    name,
    parentId,
    position,
    hasAgeRestriction,
    storageTemperature,
    controlsExpiry,
    controlsLot,
  } = parsed.data;
  const baseSlug = parsed.data.slug || generateSlug(name);

  // Insert with retry on unique conflict (avoids TOCTOU race)
  let category: { id: string };
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Date.now()}`;
    try {
      category = await prisma.category.create({
        data: {
          organizationId,
          name,
          slug,
          icon: null,
          iconColor: null,
          parentId: parentId || null,
          position,
          hasAgeRestriction: hasAgeRestriction ?? false,
          storageTemperature: storageTemperature || null,
          controlsExpiry: controlsExpiry ?? false,
          controlsLot: controlsLot ?? false,
        },
        select: { id: true },
      });
      break;
    } catch (err: unknown) {
      const isUniqueViolation =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (!isUniqueViolation || attempt === 4) throw err;
    }
  }
  // biome-ignore lint/style/noNonNullAssertion: assigned in loop above or thrown
  const finalCategory = category!;

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "category.created",
    resourceType: "Category",
    resourceId: finalCategory.id,
    after: { name },
  });

  revalidatePath("/app/products/categories");
  return { success: true, data: { id: finalCategory.id } };
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

  const {
    name,
    parentId,
    position,
    hasAgeRestriction,
    storageTemperature,
    controlsExpiry,
    controlsLot,
  } = parsed.data;

  await prisma.category.updateMany({
    where: { id: categoryId, organizationId },
    data: {
      name,
      icon: null,
      iconColor: null,
      parentId: parentId || null,
      position,
      hasAgeRestriction: hasAgeRestriction ?? false,
      storageTemperature: storageTemperature || null,
      controlsExpiry: controlsExpiry ?? false,
      controlsLot: controlsLot ?? false,
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

/* ── Clear icons (one-time cleanup) ─────────────────────────── */

export async function clearCategoryIconsAction(organizationId: string): Promise<void> {
  await prisma.category.updateMany({
    where: { organizationId },
    data: { icon: null, iconColor: null },
  });
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
    ipiCst,
    ipiRate,
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
    ipiCst: ipiCst || null,
    ipiRate: ipiRate ?? null,
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

/* ── AI fiscal suggestion for subcategory ────────────────────── */

export interface TaxSuggestion {
  ncm?: string;
  cest?: string;
  cfopInternal?: string;
  cfopInterstate?: string;
  origin?: string;
  icmsCst?: string;
  icmsCsosn?: string;
  icmsRate?: string;
  pisCst?: string;
  pisRate?: string;
  cofinsCst?: string;
  cofinsRate?: string;
  confidence: "high" | "medium" | "low";
  notes?: string; // e.g. "NCM 22021000 — Cervejas de malte"
}

export async function suggestSubcategoryTaxAction(params: {
  subcategoryName: string;
  parentCategoryName?: string;
  taxRegime: string | null;
}): Promise<Result<TaxSuggestion>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "Gemini não configurado" };

  const { subcategoryName, parentCategoryName, taxRegime } = params;
  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI" || !taxRegime;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const context = parentCategoryName
      ? `Categoria: "${parentCategoryName}" > Subcategoria: "${subcategoryName}"`
      : `Subcategoria: "${subcategoryName}"`;

    const prompt = `Você é especialista fiscal brasileiro especializado em NCM/CEST para varejo.

${context}
Regime tributário: ${isSimples ? "Simples Nacional / MEI" : "Regime Normal (Lucro Real/Presumido)"}

Identifique o NCM correto para produtos desta subcategoria e preencha todos os valores fiscais padrão.
Retorne APENAS JSON válido sem markdown:
{
  "ncm": "8 dígitos NCM (obrigatório)",
  "ncmDescription": "descrição do NCM escolhido",
  "cest": "7 dígitos CEST ou null",
  "cfopInternal": "${isSimples ? "5405" : "5102"}",
  "cfopInterstate": "${isSimples ? "6404" : "6102"}",
  "origin": "NACIONAL",
  ${
    isSimples
      ? `"icmsCsosn": "400",
  "icmsCst": null,`
      : `"icmsCst": "00",
  "icmsCsosn": null,`
  }
  "icmsRate": ${isSimples ? "null" : "12"},
  "pisCst": "${isSimples ? "07" : "01"}",
  "pisRate": ${isSimples ? "null" : "0.65"},
  "cofinsCst": "${isSimples ? "07" : "01"}",
  "cofinsRate": ${isSimples ? "null" : "3.0"},
  "confidence": "high",
  "notes": "NCM XXXXXXXX — descrição curta do que representa"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = (response.text ?? "").trim();
    if (!text) return { success: false, error: "Sem resposta da IA" };

    const data = JSON.parse(text) as {
      ncm?: string;
      ncmDescription?: string;
      cest?: string | null;
      cfopInternal?: string;
      cfopInterstate?: string;
      origin?: string;
      icmsCst?: string | null;
      icmsCsosn?: string | null;
      icmsRate?: number | null;
      pisCst?: string;
      pisRate?: number | null;
      cofinsCst?: string;
      cofinsRate?: number | null;
      confidence?: string;
      notes?: string;
    };

    return {
      success: true,
      data: {
        ncm: data.ncm?.replace(/\D/g, "").slice(0, 8) || undefined,
        cest: data.cest ? data.cest.replace(/\D/g, "").slice(0, 7) || undefined : undefined,
        cfopInternal: data.cfopInternal || undefined,
        cfopInterstate: data.cfopInterstate || undefined,
        origin: data.origin || "NACIONAL",
        icmsCst: data.icmsCst || undefined,
        icmsCsosn: data.icmsCsosn || undefined,
        icmsRate: data.icmsRate != null ? String(data.icmsRate) : undefined,
        pisCst: data.pisCst || undefined,
        pisRate: data.pisRate != null ? String(data.pisRate) : undefined,
        cofinsCst: data.cofinsCst || undefined,
        cofinsRate: data.cofinsRate != null ? String(data.cofinsRate) : undefined,
        confidence: (data.confidence as "high" | "medium" | "low") || "medium",
        notes: data.notes || data.ncmDescription || undefined,
      },
    };
  } catch {
    return { success: false, error: "Erro ao consultar IA" };
  }
}
