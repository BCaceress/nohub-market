"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/** SKU sequencial para kit: KIT-000123. */
async function nextKitSku(organizationId: string): Promise<string> {
  const rows = await prisma.product.findMany({
    where: { organizationId, sku: { startsWith: "KIT-" } },
    select: { sku: true },
  });
  let max = 0;
  for (const { sku } of rows) {
    const n = Number(sku?.slice(4));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `KIT-${String(max + 1).padStart(6, "0")}`;
}

/* ── Opções de componente (produtos simples) com custo e estoque ── */

export type KitComponentOption = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  cost: number; // costPrice ?? price
  stock: number; // soma disponível em todos os locais (onHand - reserved)
};

export async function getKitComponentOptionsAction(
  organizationId: string,
  excludeId?: string,
): Promise<KitComponentOption[]> {
  // RN-C04: componente de kit só pode ser produto simples/fracionado (insumo real)
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      isActive: true,
      productType: { in: ["SIMPLE", "FRACTIONED"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true, sku: true, unit: true, price: true, costPrice: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  if (products.length === 0) return [];

  const balances = await prisma.stockBalance.groupBy({
    by: ["productId"],
    where: { organizationId, productId: { in: products.map((p) => p.id) } },
    _sum: { quantityOnHand: true, quantityReserved: true },
  });
  const stockMap = new Map(
    balances.map((b) => [
      b.productId,
      Number(b._sum.quantityOnHand ?? 0) - Number(b._sum.quantityReserved ?? 0),
    ]),
  );

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
    cost: Number(p.costPrice ?? p.price),
    stock: stockMap.get(p.id) ?? 0,
  }));
}

/* ── Salvar kit (cadastro completo num passo) ───────────────────── */

const kitComponentInput = z.object({
  componentProductId: z.string().cuid(),
  quantity: z.coerce.number().positive("Quantidade deve ser maior que zero"),
});

const kitProductSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  sku: z.string().max(50).optional().or(z.literal("")),
  categoryId: z.string().cuid().optional().or(z.literal("")),
  imageUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  // COMBO = produtos prontos (qtd inteira); RECIPE = insumos fracionados
  compositionKind: z.enum(["COMBO", "RECIPE"]).default("COMBO"),
  price: z.coerce.number().min(0, "Preço inválido"),
  components: z.array(kitComponentInput).default([]),
});

export type KitProductInput = z.input<typeof kitProductSchema>;

/**
 * Cria ou atualiza um produto KIT completo:
 * dados base + composição (ProductKitComponent). O kit não tem estoque
 * próprio — a venda baixa os componentes (RN-C03) e a tributação é herdada.
 */
export async function saveKitProductAction(
  organizationId: string,
  productId: string | null,
  input: KitProductInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = kitProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };
  }
  const d = parsed.data;

  // Consolida o mesmo produto somando quantidades (doc: incluir mais de uma vez = consolidar)
  const consolidated = new Map<string, number>();
  for (const c of d.components) {
    consolidated.set(
      c.componentProductId,
      (consolidated.get(c.componentProductId) ?? 0) + c.quantity,
    );
  }
  const components = [...consolidated.entries()].map(([componentProductId, quantity]) => ({
    componentProductId,
    quantity,
  }));

  // Validações do kit
  if (components.length < 2) {
    return { success: false, error: "O kit deve possuir no mínimo 2 produtos." };
  }

  // RN-C04: componente não pode ser KIT/CUSTOM/VARIANT_PARENT — só insumo real
  const invalid = await prisma.product.findMany({
    where: {
      id: { in: components.map((c) => c.componentProductId) },
      organizationId,
      productType: { notIn: ["SIMPLE", "FRACTIONED"] },
    },
    select: { name: true },
  });
  if (invalid.length > 0) {
    const names = invalid.map((p) => p.name).join(", ");
    return { success: false, error: `Componente deve ser produto simples: ${names}` };
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
    if (existing.productType !== "KIT") {
      return { success: false, error: "Produto não é do tipo Kit/Combo" };
    }
    await prisma.product.update({
      where: { id },
      data: {
        name: d.name,
        posName,
        description: d.description || null,
        sku: d.sku || null,
        price: d.price,
        compositionKind: d.compositionKind,
        isActive: d.isActive,
        active: d.isActive,
        categoryId: d.categoryId || null,
        imageUrl: d.imageUrl || null,
      },
    });
  } else {
    const sku = d.sku || (await nextKitSku(organizationId));
    const created = await prisma.product.create({
      data: {
        organizationId,
        name: d.name,
        posName,
        sku,
        description: d.description || null,
        price: d.price,
        productType: "KIT",
        compositionKind: d.compositionKind,
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

  // Substituir composição numa transação
  const kitId = id;
  await prisma.$transaction([
    prisma.productKitComponent.deleteMany({ where: { kitProductId: kitId } }),
    prisma.productKitComponent.createMany({
      data: components.map((c, i) => ({
        kitProductId: kitId,
        componentProductId: c.componentProductId,
        quantity: c.quantity,
        position: i,
      })),
    }),
  ]);

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: productId ? "product.kit.updated" : "product.kit.created",
    resourceType: "Product",
    resourceId: id,
    after: { name: d.name, componentCount: components.length },
  });

  revalidatePath("/app/products");
  revalidatePath(`/app/products/${id}`);
  return { success: true, data: { id } };
}
