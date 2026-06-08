"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { type ProductOptionGroupInput, productOptionGroupSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/**
 * Substitui todos os grupos de opção de um produto CUSTOM (transação).
 * Opções apontam para Product/Variant reais (herdam estoque/custo/fiscal).
 */
export async function setOptionGroupsAction(
  organizationId: string,
  productId: string,
  groups: ProductOptionGroupInput[],
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  // Validate each group
  for (const [i, g] of groups.entries()) {
    const parsed = productOptionGroupSchema.safeParse(g);
    if (!parsed.success) {
      return { success: false, error: `Grupo ${i + 1}: ${parsed.error.errors[0]?.message}` };
    }
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    select: { productType: true },
  });
  if (!product) return { success: false, error: "Produto não encontrado" };
  if (product.productType !== "CUSTOM") {
    return { success: false, error: "Produto não é do tipo Personalizado (CUSTOM)" };
  }

  // RN-C04 análogo: opção não pode apontar para KIT/CUSTOM (sem composição aninhada)
  const componentIds = groups.flatMap((g) => g.options.map((o) => o.componentProductId));
  if (componentIds.length > 0) {
    const nested = await prisma.product.findMany({
      where: { id: { in: componentIds }, productType: { in: ["KIT", "CUSTOM"] } },
      select: { id: true, name: true },
    });
    if (nested.length > 0) {
      const names = nested.map((n) => n.name).join(", ");
      return { success: false, error: `Opção não pode ser KIT/Personalizado: ${names}` };
    }
  }

  // Replace all in transaction (delete cascateia options)
  await prisma.$transaction(async (tx) => {
    await tx.productOptionGroup.deleteMany({ where: { productId } });
    for (const [gi, g] of groups.entries()) {
      await tx.productOptionGroup.create({
        data: {
          organizationId,
          productId,
          name: g.name,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          position: g.position ?? gi,
          options: {
            create: g.options.map((o, oi) => ({
              componentProductId: o.componentProductId,
              componentVariantId: o.componentVariantId || null,
              name: o.name,
              quantity: o.quantity,
              priceDelta: o.priceDelta,
              isDefault: o.isDefault,
              position: o.position ?? oi,
            })),
          },
        },
      });
    }
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "product.option_groups.set",
    resourceType: "ProductOptionGroup",
    resourceId: productId,
    after: { groupCount: groups.length },
  });

  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: null };
}

export async function getOptionGroupsAction(productId: string, organizationId: string) {
  return prisma.productOptionGroup.findMany({
    where: { productId, organizationId },
    include: {
      options: {
        include: {
          componentProduct: { select: { id: true, name: true, unit: true, imageUrl: true } },
          componentVariant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });
}
