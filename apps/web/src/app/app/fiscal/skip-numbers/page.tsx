/**
 * Inutilização de Numeração — formulário + histórico.
 */

import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { listNumberSkipsAction } from "@/features/fiscal/actions/fiscal-actions";
import { getSession } from "@/lib/auth-server";
import { SkipNumbersClient } from "./skip-numbers-client";

export const metadata = { title: "Inutilização de Numeração — NoHub Market" };

export default async function SkipNumbersPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const result = await listNumberSkipsAction();

  return (
    <SkipNumbersClient
      skips={result.success ? result.skips : []}
      error={result.success ? null : result.error}
    />
  );
}
