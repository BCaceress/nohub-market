/**
 * Detalhes de uma Nota Fiscal — timeline, DANFE, ações.
 */

import { getInvoiceAction } from "@/features/fiscal/actions/fiscal-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { notFound, redirect } from "next/navigation";
import { InvoiceDetailClient } from "./invoice-detail-client";

export const metadata = { title: "Nota Fiscal — NoHub Market" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const { id } = await params;
  const result = await getInvoiceAction(id);

  if (!result.success) notFound();

  return <InvoiceDetailClient invoice={result.invoice} />;
}
