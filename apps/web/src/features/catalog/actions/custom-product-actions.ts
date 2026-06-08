"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { productOptionGroupSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/** SKU sequencial para produto personalizado: PER-000123. */
async function nextCustomSku(organizationId: string): Promise<string> {
  const rows = await prisma.product.findMany({
    where: { organizationId, sku: { startsWith: "PER-" } },
    select: { sku: true },
  });
  let max = 0;
  for (const { sku } of rows) {
    const n = Number(sku?.slice(4));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `PER-${String(max + 1).padStart(6, "0")}`;
}

const fixedComponentSchema = z.object({
  componentProductId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
});

const customProductSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Preço base inválido"),
  isActive: z.boolean().default(true),
  categoryId: z.string().cuid().optional().or(z.literal("")),
  imageUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  fixedComponents: z.array(fixedComponentSchema).default([]),
  groups: z.array(productOptionGroupSchema).default([]),
});

export type CustomProductInput = z.input<typeof customProductSchema>;

/**
 * Cria ou atualiza um produto CUSTOM completo num passo:
 * dados base + itens fixos (ProductKitComponent) + grupos de opção.
 */
export async function saveCustomProductAction(
  organizationId: string,
  productId: string | null,
  input: CustomProductInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = customProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };
  }
  const d = parsed.data;

  // Insumos (fixos + opções) só podem ser produtos do cadastro simples
  const componentIds = [
    ...d.fixedComponents.map((c) => c.componentProductId),
    ...d.groups.flatMap((g) => g.options.map((o) => o.componentProductId)),
  ];
  if (componentIds.length > 0) {
    const invalid = await prisma.product.findMany({
      where: {
        id: { in: componentIds },
        organizationId,
        productType: { notIn: ["SIMPLE", "FRACTIONED"] },
      },
      select: { name: true },
    });
    if (invalid.length > 0) {
      const names = invalid.map((p) => p.name).join(", ");
      return { success: false, error: `Insumo deve ser produto simples: ${names}` };
    }
  }

  const posName = d.name.slice(0, 40);

  // Criar ou atualizar o produto base
  let id = productId;
  if (id) {
    const existing = await prisma.product.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { productType: true },
    });
    if (!existing) return { success: false, error: "Produto não encontrado" };
    if (existing.productType !== "CUSTOM") {
      return { success: false, error: "Produto não é do tipo Personalizado" };
    }
    await prisma.product.update({
      where: { id },
      data: {
        name: d.name,
        posName,
        description: d.description || null,
        price: d.price,
        isActive: d.isActive,
        active: d.isActive,
        categoryId: d.categoryId || null,
        imageUrl: d.imageUrl || null,
      },
    });
  } else {
    const sku = await nextCustomSku(organizationId);
    const created = await prisma.product.create({
      data: {
        organizationId,
        name: d.name,
        posName,
        sku,
        description: d.description || null,
        price: d.price,
        productType: "CUSTOM",
        isActive: d.isActive,
        active: d.isActive,
        categoryId: d.categoryId || null,
        imageUrl: d.imageUrl || null,
      },
    });
    id = created.id;
  }

  // Preço base canônico (resolvePrice usa ProductPrice)
  const existingPrice = await prisma.productPrice.findFirst({
    where: { organizationId, productId: id, variantId: null, locationId: null, channel: null },
    select: { id: true },
  });
  if (existingPrice) {
    await prisma.productPrice.update({ where: { id: existingPrice.id }, data: { price: d.price } });
  } else {
    await prisma.productPrice.create({ data: { organizationId, productId: id, price: d.price } });
  }

  // Substituir itens fixos + grupos numa transação
  const fixedProductId = id;
  await prisma.$transaction(async (tx) => {
    await tx.productKitComponent.deleteMany({ where: { kitProductId: fixedProductId } });
    if (d.fixedComponents.length > 0) {
      await tx.productKitComponent.createMany({
        data: d.fixedComponents.map((c, i) => ({
          kitProductId: fixedProductId,
          componentProductId: c.componentProductId,
          quantity: c.quantity,
          position: i,
        })),
      });
    }

    await tx.productOptionGroup.deleteMany({ where: { productId: fixedProductId } });
    for (const [gi, g] of d.groups.entries()) {
      await tx.productOptionGroup.create({
        data: {
          organizationId,
          productId: fixedProductId,
          name: g.name,
          unit: g.unit,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          position: gi,
          options: {
            create: g.options.map((o, oi) => ({
              componentProductId: o.componentProductId,
              componentVariantId: o.componentVariantId || null,
              name: o.name,
              quantity: o.quantity,
              priceDelta: o.priceDelta,
              isDefault: o.isDefault,
              position: oi,
            })),
          },
        },
      });
    }
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: productId ? "product.custom.updated" : "product.custom.created",
    resourceType: "Product",
    resourceId: id,
    after: { name: d.name, groupCount: d.groups.length, fixedCount: d.fixedComponents.length },
  });

  revalidatePath("/app/products");
  revalidatePath(`/app/products/${id}`);
  return { success: true, data: { id } };
}
