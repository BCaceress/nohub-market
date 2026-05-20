"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { onlyDigits } from "@nohub/shared/brazilian";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  type: z.enum(["STORE", "DC", "HYBRID"]),
  isSelfService: z.boolean().default(false),
  is24h: z.boolean().default(false),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
});

export type LocationInput = z.infer<typeof locationSchema>;

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || ["viewer"].includes(m.role)) throw new Error("FORBIDDEN");
  return m;
}

export async function getLocationsAction(organizationId: string) {
  return prisma.location.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function getLocationAction(id: string, organizationId: string) {
  return prisma.location.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
}

export async function createLocationAction(
  organizationId: string,
  input: LocationInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const location = await prisma.location.create({
    data: {
      ...parsed.data,
      organizationId,
      zipCode: parsed.data.zipCode ? onlyDigits(parsed.data.zipCode) : undefined,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "location.created",
    resourceType: "Location",
    resourceId: location.id,
    after: { name: location.name, type: location.type },
  });

  revalidatePath("/app/locations");
  return { success: true, data: { id: location.id } };
}

export async function updateLocationAction(
  organizationId: string,
  locationId: string,
  input: LocationInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  await prisma.location.updateMany({
    where: { id: locationId, organizationId },
    data: {
      ...parsed.data,
      zipCode: parsed.data.zipCode ? onlyDigits(parsed.data.zipCode) : undefined,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "location.updated",
    resourceType: "Location",
    resourceId: locationId,
    after: { name: parsed.data.name },
  });

  revalidatePath("/app/locations");
  return { success: true, data: null };
}

export async function deleteLocationAction(
  organizationId: string,
  locationId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  // Soft delete para manter histórico de pedidos/canais
  await prisma.location.updateMany({
    where: { id: locationId, organizationId },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "location.deleted",
    resourceType: "Location",
    resourceId: locationId,
  });

  revalidatePath("/app/locations");
  return { success: true, data: null };
}
