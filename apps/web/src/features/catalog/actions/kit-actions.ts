"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { type KitComponentInput, kitComponentSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/**
 * Substitui toda a composição do kit de uma vez (transação).
 * RN-C04: componente não pode ser KIT.
 */
export async function setKitComponentsAction(
  organizationId: string,
  kitProductId: string,
  components: KitComponentInput[],
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  // Validate each component
  for (const [i, comp] of components.entries()) {
    const parsed = kitComponentSchema.safeParse(comp);
    if (!parsed.success) {
      return { success: false, error: `Componente ${i + 1}: ${parsed.error.errors[0]?.message}` };
    }
  }

  // Check kit product
  const kit = await prisma.product.findFirst({
    where: { id: kitProductId, organizationId, deletedAt: null },
  });
  if (!kit) return { success: false, error: "Kit não encontrado" };
  if (kit.productType !== "KIT" && kit.productType !== "CUSTOM") {
    return {
      success: false,
      error: "Produto não aceita composição (deve ser KIT ou Personalizado)",
    };
  }

  // RN-C04: check no component is a KIT
  const componentIds = components.map((c) => c.componentProductId);
  const kitComponents = await prisma.product.findMany({
    where: { id: { in: componentIds }, productType: "KIT" },
    select: { id: true, name: true },
  });
  if (kitComponents.length > 0) {
    const names = kitComponents.map((k) => k.name).join(", ");
    return { success: false, error: `Kit-de-kit não é permitido: ${names}` };
  }

  // Replace all in transaction
  await prisma.$transaction([
    prisma.productKitComponent.deleteMany({ where: { kitProductId } }),
    prisma.productKitComponent.createMany({
      data: components.map((c, i) => ({
        kitProductId,
        componentProductId: c.componentProductId,
        componentVariantId: c.componentVariantId || null,
        quantity: c.quantity,
        position: c.position ?? i,
      })),
    }),
  ]);

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "kit.components.set",
    resourceType: "ProductKitComponent",
    resourceId: kitProductId,
    after: { count: components.length, componentIds },
  });

  revalidatePath(`/app/products/${kitProductId}`);
  return { success: true, data: null };
}

export async function getKitComponentsAction(kitProductId: string, organizationId: string) {
  return prisma.productKitComponent.findMany({
    where: {
      kitProductId,
      kitProduct: { organizationId },
    },
    include: {
      componentProduct: {
        select: {
          id: true,
          name: true,
          unit: true,
          price: true,
          imageUrl: true,
          productType: true,
        },
      },
      componentVariant: {
        select: { id: true, name: true, sku: true },
      },
    },
    orderBy: { position: "asc" },
  });
}
