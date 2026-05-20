/**
 * PDV — Ponto de Venda rápido (venda balcão).
 * Server Component: carrega produtos e sessão de caixa; renderiza POSClient.
 */

import { redirect } from "next/navigation";
import { prisma } from "@nohub/db";
import { getSession } from "@/lib/auth-server";
import { POSClient } from "./pos-client";

export const metadata = { title: "PDV — NoHub Market" };

export default async function POSPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const orgId  = member.organizationId;
  const userId = session.user.id;

  const products = await prisma.product.findMany({
    where: {
      organizationId: orgId,
      deletedAt:      null,
      isActive:       true,
      productType:    { in: ["SIMPLE", "FRACTIONED"] },
    },
    select: {
      id:          true,
      name:        true,
      sku:         true,
      price:       true,
      unit:        true,
      productType: true,
    },
    orderBy: { name: "asc" },
    take:    200,
  });

  const locations = await prisma.location.findMany({
    where:   { organizationId: orgId, deletedAt: null },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">PDV — Ponto de Venda</h1>
        <p className="text-sm text-muted-foreground">Venda balcão rápida</p>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <POSClient
          products={products.map((p) => ({
            ...p,
            price: Number(p.price),
          }))}
          locations={locations}
          organizationId={orgId}
          actorId={userId}
        />
      </div>
    </div>
  );
}
