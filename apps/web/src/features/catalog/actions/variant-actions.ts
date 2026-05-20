"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { variantSchema, type VariantInput } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

export async function createVariantAction(
  organizationId: string,
  productId: string,
  input: VariantInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  // Verify product is VARIANT_PARENT
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
  });
  if (!product) return { success: false, error: "Produto não encontrado" };
  if (product.productType !== "VARIANT_PARENT") {
    return { success: false, error: "Produto não é do tipo VARIANT_PARENT" };
  }

  const d = parsed.data;

  // SKU unique per org
  if (d.sku) {
    const exists = await prisma.productVariant.findFirst({
      where: { organizationId, sku: d.sku },
    });
    if (exists) return { success: false, error: "SKU de variante já cadastrado" };
  }

  const variant = await prisma.productVariant.create({
    data: {
      organizationId,
      productId,
      name: d.name,
      sku: d.sku || null,
      attributes: d.attributes,
      isActive: d.isActive,
      position: d.position,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "variant.created",
    resourceType: "ProductVariant",
    resourceId: variant.id,
    after: { name: variant.name, productId },
  });

  revalidatePath(`/app/products/${productId}`);
  return { success: true, data: { id: variant.id } };
}

export async function updateVariantAction(
  organizationId: string,
  variantId: string,
  input: VariantInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = variantSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, organizationId },
  });
  if (!variant) return { success: false, error: "Variante não encontrada" };

  await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: d.name,
      sku: d.sku || null,
      attributes: d.attributes,
      isActive: d.isActive,
      position: d.position,
    },
  });

  revalidatePath(`/app/products/${variant.productId}`);
  return { success: true, data: null };
}

export async function deleteVariantAction(
  organizationId: string,
  variantId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, organizationId },
  });
  if (!variant) return { success: false, error: "Variante não encontrada" };

  // Soft-delete via isActive = false (variant may have price/tax history)
  await prisma.productVariant.update({
    where: { id: variantId },
    data: { isActive: false },
  });

  revalidatePath(`/app/products/${variant.productId}`);
  return { success: true, data: null };
}
