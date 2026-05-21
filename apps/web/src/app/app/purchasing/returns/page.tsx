/**
 * Devoluções ao Fornecedor — listagem.
 */

import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { ReturnsClient } from "./returns-client";

export const metadata = { title: "Devoluções ao Fornecedor — NoHub Market" };

export default async function ReturnsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const returns = await prisma.supplierReturn.findMany({
    where: { organizationId: member.organizationId },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Recibos confirmados disponíveis para devolução
  const confirmedReceipts = await prisma.goodsReceipt.findMany({
    where: { organizationId: member.organizationId, status: "CONFIRMED" },
    include: { purchaseOrder: { select: { supplier: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <ReturnsClient returns={returns} confirmedReceipts={confirmedReceipts} />;
}
