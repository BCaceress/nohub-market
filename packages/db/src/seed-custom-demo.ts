/**
 * Seed de demonstração — produto CUSTOM "Drink Energético".
 * Cria insumos (com estoque), itens fixos e grupos de opção.
 * Idempotente: insumos por SKU, produto CUSTOM recriado a cada run.
 * Uso: npx tsx src/seed-custom-demo.ts
 */

import { prisma } from "./index";

async function ensureSimpleProduct(opts: {
  organizationId: string;
  sku: string;
  name: string;
  unit: "UN" | "ML";
  price: number;
  categoryId?: string | null;
}) {
  const existing = await prisma.product.findFirst({
    where: { organizationId: opts.organizationId, sku: opts.sku },
  });
  if (existing) return existing;
  return prisma.product.create({
    data: {
      organizationId: opts.organizationId,
      sku: opts.sku,
      name: opts.name,
      unit: opts.unit,
      saleUnit: opts.unit,
      price: opts.price,
      productType: "SIMPLE",
      categoryId: opts.categoryId ?? null,
      isActive: true,
      active: true,
    },
  });
}

async function setBalance(
  organizationId: string,
  productId: string,
  locationId: string,
  qty: number,
) {
  const existing = await prisma.stockBalance.findFirst({
    where: { organizationId, productId, locationId, variantId: null, lotId: null },
    select: { id: true },
  });
  if (existing) {
    await prisma.stockBalance.update({
      where: { id: existing.id },
      data: { quantityOnHand: qty },
    });
  } else {
    await prisma.stockBalance.create({
      data: { organizationId, productId, locationId, quantityOnHand: qty },
    });
  }
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: { onboardingCompleted: true },
    select: { id: true, tradeName: true },
  });
  if (!org) throw new Error("Nenhuma organização com onboarding concluído.");

  const locations = await prisma.location.findMany({
    where: { organizationId: org.id, deletedAt: null },
    select: { id: true },
  });
  if (locations.length === 0) throw new Error("Organização sem locais.");

  console.log(`Org: ${org.tradeName} (${org.id}) — ${locations.length} local(is)`);

  // Categoria Drinks (raiz)
  const category = await prisma.category.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "drinks" } },
    create: { organizationId: org.id, name: "Drinks", slug: "drinks", icon: "wine" },
    update: {},
  });

  // ── Insumos ──────────────────────────────────────────────
  const copo = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-COPO",
    name: "Copo plástico 400ml",
    unit: "UN",
    price: 0,
    categoryId: category.id,
  });
  const gelo = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-GELO",
    name: "Gelo",
    unit: "ML",
    price: 0,
    categoryId: category.id,
  });
  const smirnoff = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-VODKA-SMIRNOFF",
    name: "Vodka Smirnoff",
    unit: "ML",
    price: 0,
    categoryId: category.id,
  });
  const absolut = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-VODKA-ABSOLUT",
    name: "Vodka Absolut",
    unit: "ML",
    price: 0,
    categoryId: category.id,
  });
  const redbull = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-EN-REDBULL",
    name: "Energético Red Bull",
    unit: "UN",
    price: 0,
    categoryId: category.id,
  });
  const monster = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-EN-MONSTER",
    name: "Energético Monster",
    unit: "UN",
    price: 0,
    categoryId: category.id,
  });
  const morango = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-XAR-MORANGO",
    name: "Xarope Morango",
    unit: "ML",
    price: 0,
    categoryId: category.id,
  });
  const limao = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-XAR-LIMAO",
    name: "Xarope Limão",
    unit: "ML",
    price: 0,
    categoryId: category.id,
  });
  const uva = await ensureSimpleProduct({
    organizationId: org.id,
    sku: "DEMO-XAR-UVA",
    name: "Xarope Uva",
    unit: "ML",
    price: 0,
    categoryId: category.id,
  });

  // Estoque dos insumos em todos os locais
  const stock: Array<[string, number]> = [
    [copo.id, 500],
    [gelo.id, 100000],
    [smirnoff.id, 50000],
    [absolut.id, 50000],
    [redbull.id, 300],
    [monster.id, 300],
    [morango.id, 20000],
    [limao.id, 20000],
    [uva.id, 20000],
  ];
  for (const loc of locations) {
    for (const [productId, qty] of stock) {
      await setBalance(org.id, productId, loc.id, qty);
    }
  }

  // ── Produto CUSTOM ───────────────────────────────────────
  // Recria do zero para idempotência
  await prisma.product.deleteMany({
    where: { organizationId: org.id, sku: "DEMO-DRINK-ENERGETICO" },
  });

  const drink = await prisma.product.create({
    data: {
      organizationId: org.id,
      sku: "DEMO-DRINK-ENERGETICO",
      name: "Drink Energético",
      posName: "Drink Energetico",
      description: "Monte seu drink: vodka + energético + sabor.",
      unit: "UN",
      saleUnit: "UN",
      price: 18, // base (Smirnoff + Red Bull + sabor)
      productType: "CUSTOM",
      categoryId: category.id,
      isActive: true,
      active: true,
    },
  });

  // Preço canônico em ProductPrice (resolvePrice usa este)
  await prisma.productPrice.create({
    data: { organizationId: org.id, productId: drink.id, price: 18 },
  });

  // Itens fixos (copo + 200ml de gelo)
  await prisma.productKitComponent.createMany({
    data: [
      { kitProductId: drink.id, componentProductId: copo.id, quantity: 1, position: 0 },
      { kitProductId: drink.id, componentProductId: gelo.id, quantity: 200, position: 1 },
    ],
  });

  // Grupos de opção
  await prisma.productOptionGroup.create({
    data: {
      organizationId: org.id,
      productId: drink.id,
      name: "Escolha da Vodka",
      unit: "ML",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      position: 0,
      options: {
        create: [
          {
            componentProductId: smirnoff.id,
            name: "Smirnoff",
            quantity: 50,
            priceDelta: 0,
            isDefault: true,
            position: 0,
          },
          {
            componentProductId: absolut.id,
            name: "Absolut",
            quantity: 50,
            priceDelta: 5,
            position: 1,
          },
        ],
      },
    },
  });

  await prisma.productOptionGroup.create({
    data: {
      organizationId: org.id,
      productId: drink.id,
      name: "Escolha do Energético",
      unit: "UN",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      position: 1,
      options: {
        create: [
          {
            componentProductId: redbull.id,
            name: "Red Bull",
            quantity: 1,
            priceDelta: 0,
            isDefault: true,
            position: 0,
          },
          {
            componentProductId: monster.id,
            name: "Monster",
            quantity: 1,
            priceDelta: 2,
            position: 1,
          },
        ],
      },
    },
  });

  await prisma.productOptionGroup.create({
    data: {
      organizationId: org.id,
      productId: drink.id,
      name: "Escolha do Sabor",
      unit: "ML",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      position: 2,
      options: {
        create: [
          {
            componentProductId: morango.id,
            name: "Morango",
            quantity: 30,
            priceDelta: 0,
            isDefault: true,
            position: 0,
          },
          { componentProductId: limao.id, name: "Limão", quantity: 30, priceDelta: 0, position: 1 },
          { componentProductId: uva.id, name: "Uva", quantity: 30, priceDelta: 0, position: 2 },
        ],
      },
    },
  });

  console.log(`✓ Produto CUSTOM criado: "${drink.name}" (${drink.id})`);
  console.log("  Itens fixos: Copo x1, Gelo x200ml");
  console.log("  Grupos: Vodka (Smirnoff/Absolut+5), Energético (Red Bull/Monster+2), Sabor (3)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
