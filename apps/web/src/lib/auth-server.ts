import "server-only";
import { auth } from "@nohub/auth/server";
import { prisma } from "@nohub/db";
import { headers } from "next/headers";

export { auth };

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// Helpers de tenant (Etapa 5). Lançam para a borda de erro do route handler.
export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireSessionWithOrg() {
  const session = await requireSession();
  // activeOrganizationId can be null when the session pre-dates org creation or
  // was not refreshed after onboarding — fall back to the member record.
  const orgId =
    session.session.activeOrganizationId ??
    (
      await prisma.member.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { organizationId: true },
      })
    )?.organizationId ??
    null;
  if (!orgId) throw new Error("NO_ACTIVE_ORGANIZATION");
  return { ...session, organizationId: orgId };
}
