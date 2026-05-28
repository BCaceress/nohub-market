"use server";

import { getSession } from "@/lib/auth-server";
import { ALL_LOCATIONS, SELECTED_LOCATION_COOKIE } from "@/lib/selected-location";
import { prisma } from "@nohub/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function setSelectedLocationAction(
  organizationId: string,
  locationId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const member = await prisma.member.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
  });
  if (!member) return { success: false, error: "Sem acesso à organização" };

  if (locationId !== ALL_LOCATIONS) {
    const loc = await prisma.location.findFirst({
      where: { id: locationId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!loc) return { success: false, error: "Unidade não encontrada" };

    if (member.locationScopes.length > 0 && !member.locationScopes.includes(locationId)) {
      return { success: false, error: "Sem permissão nesta unidade" };
    }
  }

  const store = await cookies();
  store.set(SELECTED_LOCATION_COOKIE, locationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/app", "layout");
  return { success: true };
}
