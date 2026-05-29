/**
 * Cotações — lista e comparação de respostas de fornecedores.
 */

import { redirect } from "next/navigation";
import { listQuotationsAction } from "@/features/purchasing/actions/purchasing-actions";
import { getSession } from "@/lib/auth-server";
import { QuotationsClient } from "./quotations-client";

export const metadata = { title: "Cotações — NoHub Market" };

export default async function QuotationsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const quotations = await listQuotationsAction();

  return <QuotationsClient quotations={quotations} />;
}
