"use server";

import { normalizeBrandName } from "@/features/catalog/lib/product-helpers";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";

export async function getBrandsAction(organizationId: string) {
  const session = await getSession();
  if (!session) return [];
  return prisma.brand.findMany({
    where: { organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function upsertBrandAction(
  organizationId: string,
  name: string,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const trimmed = normalizeBrandName(name);
  if (!trimmed) return { success: false, error: "Nome obrigatório" };

  try {
    const brand = await prisma.brand.upsert({
      where: { organizationId_name: { organizationId, name: trimmed } },
      create: { organizationId, name: trimmed },
      update: {},
      select: { id: true },
    });
    return { success: true, id: brand.id };
  } catch {
    return { success: false, error: "Erro ao salvar marca" };
  }
}
