import "server-only";
import { auth } from "@nohub/auth/server";
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
  const orgId = session.session.activeOrganizationId;
  if (!orgId) throw new Error("NO_ACTIVE_ORGANIZATION");
  return { ...session, organizationId: orgId };
}
