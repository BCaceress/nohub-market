"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";

type EditableRole = "admin" | "manager" | "operator" | "viewer";

async function assertAdminOrOwner(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || !["owner", "admin"].includes(m.role)) throw new Error("FORBIDDEN");
  return m;
}

export async function getMembersAction(organizationId: string) {
  return prisma.member.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMemberAction(
  organizationId: string,
  email: string,
  role: EditableRole,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) {
    return {
      success: false,
      error: "Usuário não encontrado. Peça que ele se cadastre antes.",
    };
  }

  const exists = await prisma.member.findUnique({
    where: { userId_organizationId: { userId: target.id, organizationId } },
  });
  if (exists) return { success: false, error: "Usuário já é membro desta organização" };

  await prisma.member.create({
    data: { userId: target.id, organizationId, role },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "member.added",
    resourceType: "Member",
    after: { email, role },
  });

  revalidatePath("/app/settings/team");
  return { success: true, data: null };
}

export async function updateMemberRoleAction(
  organizationId: string,
  memberId: string,
  role: EditableRole,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target) return { success: false, error: "Membro não encontrado" };
  if (target.role === "owner")
    return { success: false, error: "Não é possível alterar o papel do owner" };

  await prisma.member.update({ where: { id: memberId }, data: { role } });

  revalidatePath("/app/settings/team");
  return { success: true, data: null };
}

export async function removeMemberAction(
  organizationId: string,
  memberId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target) return { success: false, error: "Membro não encontrado" };
  if (target.role === "owner") return { success: false, error: "Não é possível remover o owner" };

  await prisma.member.delete({ where: { id: memberId } });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "member.removed",
    resourceType: "Member",
    after: { memberId },
  });

  revalidatePath("/app/settings/team");
  return { success: true, data: null };
}
