/**
 * PDV — Ponto de Venda rápido (venda balcão).
 * Server Component: carrega produtos e sessão de caixa; renderiza POSClient.
 */

import { prisma } from "@nohub/db";
import { convertQuantity } from "@nohub/db/catalog";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { POSClient } from "./pos-client";

export const metadata = { title: "PDV — NoHub Market" };

export default async function POSPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const orgId = member.organizationId;
  const userId = session.user.id;

  const [products, stockBalances] = await Promise.all([
    prisma.product.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        isActive: true,
        productType: { in: ["SIMPLE", "FRACTIONED", "CUSTOM", "KIT"] },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        unit: true,
        productType: true,
        compositionKind: true,
        imageUrl: true,
        category: { select: { id: true, name: true } },
        // Grupos de opção (apenas CUSTOM os possui) para montar no PDV
        optionGroups: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            unit: true,
            required: true,
            minSelect: true,
            maxSelect: true,
            options: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                name: true,
                quantity: true,
                priceDelta: true,
                isDefault: true,
                componentProductId: true,
                componentProduct: { select: { unit: true } },
              },
            },
          },
        },
        // Itens fixos de CUSTOM/KIT (para cálculo de montável)
        kitComponents: {
          select: { componentProductId: true, quantity: true },
        },
      },
      orderBy: { name: "asc" },
      take: 400,
    }),
    prisma.stockBalance.findMany({
      where: { organizationId: orgId, variantId: null, quantityOnHand: { gt: 0 } },
      select: { productId: true, locationId: true, quantityOnHand: true, quantityReserved: true },
    }),
  ]);

  // productId[] com estoque disponível por localização (compat — grid)
  const stockByLocation: Record<string, string[]> = {};
  // quantidade disponível por local→produto (para checagem fina no CUSTOM)
  const stockQtyByLocation: Record<string, Record<string, number>> = {};
  for (const sb of stockBalances) {
    const available = Number(sb.quantityOnHand) - Number(sb.quantityReserved);
    stockQtyByLocation[sb.locationId] ??= {};
    const loc = stockQtyByLocation[sb.locationId]!;
    loc[sb.productId] = (loc[sb.productId] ?? 0) + Math.max(0, available);
    if (available <= 0) continue;
    stockByLocation[sb.locationId] ??= [];
    stockByLocation[sb.locationId]!.push(sb.productId);
  }

  const locations = await prisma.location.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // CUSTOM/KIT não têm saldo próprio — exibíveis em todo local; o client
  // oculta quando o montável (estoque dos componentes) é zero.
  const composableIds = products
    .filter((p) => p.productType === "CUSTOM" || p.productType === "KIT")
    .map((p) => p.id);
  if (composableIds.length > 0) {
    for (const loc of locations) {
      stockByLocation[loc.id] ??= [];
      stockByLocation[loc.id]!.push(...composableIds);
    }
  }

  // Grupos de opção por produto (somente CUSTOM) para o modal de montagem.
  // stockQty já convertido para a unidade de estoque do insumo.
  const optionGroupsByProduct: Record<
    string,
    Array<{
      id: string;
      name: string;
      required: boolean;
      minSelect: number;
      maxSelect: number;
      options: Array<{
        id: string;
        name: string;
        priceDelta: number;
        isDefault: boolean;
        componentProductId: string;
        stockQty: number;
      }>;
    }>
  > = {};
  // Itens fixos por produto CUSTOM/KIT (qty já na unidade do insumo)
  const fixedComponentsByProduct: Record<
    string,
    Array<{ componentProductId: string; stockQty: number }>
  > = {};
  for (const p of products) {
    if (p.productType !== "CUSTOM" && p.productType !== "KIT") continue;
    if (p.productType === "CUSTOM" && p.optionGroups.length > 0) {
      optionGroupsByProduct[p.id] = p.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: Number(o.priceDelta),
          isDefault: o.isDefault,
          componentProductId: o.componentProductId,
          stockQty: convertQuantity(Number(o.quantity), g.unit, o.componentProduct.unit),
        })),
      }));
    }
    fixedComponentsByProduct[p.id] = p.kitComponents.map((c) => ({
      componentProductId: c.componentProductId,
      stockQty: Number(c.quantity),
    }));
  }

  const scopedIds =
    member.locationScopes.length > 0
      ? locations.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : locations.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const defaultLocationId =
    cookieSelected === ALL_LOCATIONS ? (locations[0]?.id ?? "") : cookieSelected;

  // Sessões de caixa — painel lateral de Caixa do PDV.
  const [openCashSessions, recentClosedSessions] = await Promise.all([
    prisma.cashSession.findMany({
      where: { organizationId: orgId, status: "OPEN" },
      include: {
        location: { select: { name: true } },
        movements: { orderBy: { createdAt: "desc" }, take: 5 },
        _count: { select: { orders: true } },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.cashSession.findMany({
      where: { organizationId: orgId, status: "CLOSED" },
      include: { location: { select: { name: true } } },
      orderBy: { closedAt: "desc" },
      take: 5,
    }),
  ]);

  // Bleed-out of the main padding for full PDV canvas
  return (
    <div className="-mx-4 -my-6 md:-mx-8 md:-my-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <POSClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: Number(p.price),
          unit: p.unit,
          productType: p.productType,
          compositionKind: p.compositionKind ?? null,
          imageUrl: p.imageUrl ?? null,
          categoryName: p.category?.name ?? null,
        }))}
        stockByLocation={stockByLocation}
        stockQtyByLocation={stockQtyByLocation}
        optionGroupsByProduct={optionGroupsByProduct}
        fixedComponentsByProduct={fixedComponentsByProduct}
        locations={locations}
        defaultLocationId={defaultLocationId}
        organizationId={orgId}
        actorId={userId}
        openSessions={openCashSessions.map((s) => ({
          id: s.id,
          locationId: s.locationId,
          location: s.location,
          openingAmount: Number(s.openingAmount),
          status: s.status,
          openedAt: s.openedAt.toISOString(),
          movements: s.movements.map((m) => ({
            id: m.id,
            type: m.type,
            amount: Number(m.amount),
            note: m.note,
            createdAt: m.createdAt.toISOString(),
          })),
          _count: s._count,
        }))}
        recentClosed={recentClosedSessions.map((s) => ({
          id: s.id,
          location: s.location,
          closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
          divergence: s.divergence ? Number(s.divergence) : null,
          openedAt: s.openedAt.toISOString(),
          closedAt: s.closedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
