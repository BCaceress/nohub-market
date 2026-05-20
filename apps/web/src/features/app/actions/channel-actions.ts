"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";

async function assertAdminOrOwner(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || !["owner", "admin"].includes(m.role)) throw new Error("FORBIDDEN");
  return m;
}

export async function getChannelsAction(organizationId: string) {
  return prisma.salesChannel.findMany({
    where: { organizationId },
    include: {
      channelLocations: {
        include: { location: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function toggleChannelAction(
  organizationId: string,
  channelId: string,
  enabled: boolean,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.salesChannel.updateMany({
    where: { id: channelId, organizationId },
    data: { enabled },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: enabled ? "channel.enabled" : "channel.disabled",
    resourceType: "SalesChannel",
    resourceId: channelId,
  });

  revalidatePath("/app/channels");
  return { success: true, data: null };
}

export async function linkChannelLocationAction(
  organizationId: string,
  channelId: string,
  locationId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.channelLocation.upsert({
    where: { salesChannelId_locationId: { salesChannelId: channelId, locationId } },
    create: { organizationId, salesChannelId: channelId, locationId },
    update: {},
  });

  revalidatePath("/app/channels");
  return { success: true, data: null };
}

export async function updateChannelConfigAction(
  organizationId: string,
  channelId: string,
  config: Record<string, string>,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.salesChannel.updateMany({
    where: { id: channelId, organizationId },
    data: { config },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "channel.configured",
    resourceType: "SalesChannel",
    resourceId: channelId,
  });

  revalidatePath("/app/channels");
  return { success: true, data: null };
}

export async function unlinkChannelLocationAction(
  organizationId: string,
  channelId: string,
  locationId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.channelLocation.deleteMany({
    where: { salesChannelId: channelId, locationId },
  });

  revalidatePath("/app/channels");
  return { success: true, data: null };
}
