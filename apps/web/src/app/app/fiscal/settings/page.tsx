/**
 * Configurações Fiscais — cert upload, CSC, série, provider, ambiente.
 */

import { getFiscalSettingsAction } from "@/features/fiscal/actions/fiscal-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { FiscalSettingsClient } from "./fiscal-settings-client";

export const metadata = { title: "Config Fiscal — NoHub Market" };

export default async function FiscalSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const result = await getFiscalSettingsAction();

  return (
    <FiscalSettingsClient
      config={result.success ? result.data.config : null}
      certificate={result.success ? result.data.certificate : null}
      error={result.success ? null : result.error}
    />
  );
}
