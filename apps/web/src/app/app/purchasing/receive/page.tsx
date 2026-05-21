/**
 * Recebimento de Mercadorias — fluxo guiado: seleciona PO → registra itens → confirma.
 */

import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { ReceiveClient } from "./receive-client";

export const metadata = { title: "Receber Mercadorias — NoHub Market" };

export default async function ReceivePage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const { poId } = await searchParams;
  const organizationId = member.organizationId;

  // POs prontos para recebimento
  const readyPOs = await prisma.purchaseOrder.findMany({
    where: { organizationId, status: { in: ["CONFIRMED", "RECEIVING"] } },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // PO selecionada
  let selectedPO = null;
  if (poId) {
    selectedPO = await prisma.purchaseOrder.findFirst({
      where: { id: poId, organizationId },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  return <ReceiveClient readyPOs={readyPOs} selectedPO={selectedPO} />;
}
