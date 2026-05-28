/**
 * PDV — Ponto de Venda rápido (venda balcão).
 * Server Component: carrega produtos e sessão de caixa; renderiza POSClient.
 */

import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
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

  const products = await prisma.product.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      isActive: true,
      productType: { in: ["SIMPLE", "FRACTIONED"] },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      unit: true,
      productType: true,
      imageUrl: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
    take: 400,
  });

  const locations = await prisma.location.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const scopedIds =
    member.locationScopes.length > 0
      ? locations.filter((l) => member.locationScopes.includes(l.id)).map((l) => l.id)
      : locations.map((l) => l.id);
  const cookieSelected = await readSelectedLocation(scopedIds, ALL_LOCATIONS);
  const defaultLocationId =
    cookieSelected === ALL_LOCATIONS ? (locations[0]?.id ?? "") : cookieSelected;

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
          imageUrl: p.imageUrl ?? null,
          categoryName: p.category?.name ?? null,
        }))}
        locations={locations}
        defaultLocationId={defaultLocationId}
        organizationId={orgId}
        actorId={userId}
      />
    </div>
  );
}
