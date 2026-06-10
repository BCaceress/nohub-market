/**
 * Financeiro — página única. Todas as áreas (visão geral, contas a pagar/receber,
 * fluxo de caixa, conciliação de cartão, caixas e DRE) empilhadas numa só rolagem;
 * ações pontuais (baixa, lançamento, categorias) acontecem em side panels.
 */

import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import {
  getCashFlowAction,
  getDreAction,
  getFinanceOverviewAction,
  listCashSessionsAction,
  listCategoriesAction,
} from "@/features/financeiro/actions/financeiro-actions";
import { getSession } from "@/lib/auth-server";
import { FinanceiroHub } from "./financeiro-hub";

export const metadata = { title: "Financeiro — NoHub Market" };

const MGMT = ["owner", "admin", "manager"];
const OPEN_PAYABLE = ["PENDING", "PARTIALLY_PAID"];
const OPEN_RECEIVABLE = ["PENDING", "PARTIALLY_RECEIVED"];

export default async function FinanceiroPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");
  if (!MGMT.includes(member.role)) redirect("/app");

  const orgId = member.organizationId;

  const [
    overview,
    cashflow,
    dre,
    categories,
    customers,
    payables,
    receivables,
    settlements,
    sessions,
  ] = await Promise.all([
    getFinanceOverviewAction(),
    getCashFlowAction(30),
    getDreAction(),
    listCategoriesAction(),
    prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.accountPayable.findMany({
      where: { organizationId: orgId, status: { in: OPEN_PAYABLE as never } },
      include: {
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.accountReceivable.findMany({
      where: { organizationId: orgId, status: { in: OPEN_RECEIVABLE as never } },
      include: {
        customer: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.paymentSettlement.findMany({
      where: { organizationId: orgId, status: "PENDING" },
      include: { payment: { select: { method: true, orderId: true, confirmedAt: true } } },
      orderBy: { expectedDate: "asc" },
      take: 50,
    }),
    listCashSessionsAction(),
  ]);

  return (
    <FinanceiroHub
      overview={overview}
      cashflow={cashflow}
      dre={dre}
      categories={categories}
      customers={customers}
      payables={payables}
      receivables={receivables}
      settlements={settlements}
      sessions={sessions}
    />
  );
}
