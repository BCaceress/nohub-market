"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { productPriceSchema, type ProductPriceInput } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/**
 * Cria ou atualiza um preço dimensional (produto × variante × location × canal).
 * Upsert por combinação única das dimensões.
 */
export async function setProductPriceAction(
  organizationId: string,
  input: ProductPriceInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = productPriceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  // Find existing row matching all dimensions
  const existing = await prisma.productPrice.findFirst({
    where: {
      organizationId,
      productId: d.productId,
      variantId: d.variantId || null,
      locationId: d.locationId || null,
      channel: (d.channel || null) as never,
    },
  });

  const data = {
    price: d.price,
    promoPrice: d.promoPrice ?? null,
    cost: d.cost ?? null,
    validFrom: d.validFrom ? new Date(d.validFrom) : null,
    validTo: d.validTo ? new Date(d.validTo) : null,
  };

  let priceId: string;

  if (existing) {
    await prisma.productPrice.update({ where: { id: existing.id }, data });
    priceId = existing.id;
  } else {
    const created = await prisma.productPrice.create({
      data: {
        organizationId,
        productId: d.productId,
        variantId: d.variantId || null,
        locationId: d.locationId || null,
        channel: (d.channel || null) as never,
        ...data,
      },
    });
    priceId = created.id;
  }

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: existing ? "price.updated" : "price.created",
    resourceType: "ProductPrice",
    resourceId: priceId,
    after: { productId: d.productId, price: d.price, channel: d.channel, locationId: d.locationId },
  });

  revalidatePath("/app/products/prices");
  revalidatePath(`/app/products/${d.productId}`);
  return { success: true, data: { id: priceId } };
}

export async function deleteProductPriceAction(
  organizationId: string,
  priceId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try { await assertMember(session.user.id, organizationId); } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.productPrice.deleteMany({
    where: { id: priceId, organizationId },
  });

  revalidatePath("/app/products/prices");
  return { success: true, data: null };
}

export async function getProductPricesAction(
  organizationId: string,
  productId?: string,
) {
  return prisma.productPrice.findMany({
    where: {
      organizationId,
      ...(productId ? { productId } : {}),
    },
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [{ productId: "asc" }, { channel: "asc" }],
  });
}
