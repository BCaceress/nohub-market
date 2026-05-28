"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { type ProductTaxInput, productTaxSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/**
 * Cria/atualiza dados fiscais de um produto/variante.
 * Valida NCM (8 dígitos) e CEST (7 dígitos) — RN-C07.
 * Decide CST vs CSOSN pelo regime da organização — RN-C06.
 */
export async function setProductTaxAction(
  organizationId: string,
  input: ProductTaxInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = productTaxSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  // RN-C06: Check regime consistency
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { taxRegime: true },
  });
  const isSimples = org?.taxRegime === "SIMPLES_NACIONAL" || org?.taxRegime === "MEI";

  if (isSimples && d.icmsCst) {
    return {
      success: false,
      error: "Organização com Simples Nacional deve usar CSOSN, não CST (RN-C06)",
    };
  }
  if (!isSimples && d.icmsCsosn) {
    return {
      success: false,
      error: "Organização com regime Normal deve usar CST, não CSOSN (RN-C06)",
    };
  }

  const taxData = {
    ncm: d.ncm,
    cest: d.cest || null,
    cfopInternal: d.cfopInternal || null,
    cfopInterstate: d.cfopInterstate || null,
    origin: d.origin,
    icmsCst: d.icmsCst || null,
    icmsCsosn: d.icmsCsosn || null,
    icmsRate: d.icmsRate ?? null,
    pisCst: d.pisCst || null,
    pisRate: d.pisRate ?? null,
    cofinsCst: d.cofinsCst || null,
    cofinsRate: d.cofinsRate ?? null,
    ipiCst: d.ipiCst || null,
    ipiRate: d.ipiRate ?? null,
    unitTaxable: d.unitTaxable,
  };

  const variantId = d.variantId || null;

  await prisma.productTax.upsert({
    where: {
      productId_variantId: {
        productId: d.productId,
        variantId: variantId as string, // Prisma compound unique — null handled by Prisma internally
      },
    },
    create: { organizationId, productId: d.productId, variantId, ...taxData },
    update: taxData,
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.tax.set",
    resourceType: "ProductTax",
    resourceId: d.productId,
    after: { ncm: d.ncm, cest: d.cest, productId: d.productId },
  });

  revalidatePath(`/app/products/${d.productId}`);
  return { success: true, data: null };
}

export async function getProductTaxAction(productId: string, variantId?: string) {
  return prisma.productTax.findFirst({
    where: { productId, variantId: variantId ?? null },
  });
}

export async function getFiscalTemplatesAction(segment?: string) {
  return prisma.fiscalTemplate.findMany({
    where: segment ? { segment: segment as never } : undefined,
    orderBy: [{ segment: "asc" }, { productName: "asc" }],
  });
}
