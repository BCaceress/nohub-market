"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { sendEmail, link } from "@nohub/auth/mailer";
import { prisma } from "@nohub/db";
import { getEnv } from "@nohub/shared/env";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";

type EditableRole = "admin" | "manager" | "operator" | "viewer";

async function assertAdminOrOwner(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || !["owner", "admin"].includes(m.role)) throw new Error("FORBIDDEN");
  return m;
}

export async function sendInvitationAction(
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

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { legalName: true, tradeName: true },
  });

  // Verificar se já é membro
  const existingMember = await prisma.user.findUnique({
    where: { email },
    include: { members: { where: { organizationId } } },
  });
  if (existingMember?.members.length) {
    return { success: false, error: "Este e-mail já é membro da organização" };
  }

  // Criar ou reutilizar convite (substituir pendente se existir)
  await prisma.invitation.deleteMany({
    where: { organizationId, email, status: "pending" },
  });

  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      email,
      role,
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      status: "pending",
    },
  });

  const { NEXT_PUBLIC_APP_URL } = getEnv();
  const inviteUrl = `${NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;
  const orgName = org?.tradeName ?? org?.legalName ?? "NoHub Market";

  await sendEmail({
    to: email,
    subject: `Você foi convidado para ${orgName}`,
    html: `
      <h2>Convite para ${orgName}</h2>
      <p>Você foi convidado para fazer parte da organização <strong>${orgName}</strong> como <strong>${role}</strong>.</p>
      <p><a href="${inviteUrl}" style="background:#1A1A2E;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Aceitar convite</a></p>
      <p style="color:#999;font-size:12px;">O link expira em 7 dias.</p>
    `,
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "member.invited",
    resourceType: "Invitation",
    after: { email, role },
  });

  revalidatePath("/app/settings/team");
  return { success: true, data: null };
}

export async function getPendingInvitationsAction(organizationId: string) {
  return prisma.invitation.findMany({
    where: { organizationId, status: "pending", expiresAt: { gt: new Date() } },
    include: { invitedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelInvitationAction(
  organizationId: string,
  invitationId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.invitation.updateMany({
    where: { id: invitationId, organizationId },
    data: { status: "revoked" },
  });

  revalidatePath("/app/settings/team");
  return { success: true, data: null };
}

export async function acceptInvitationAction(token: string): Promise<Result<{ orgName: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Faça login para aceitar o convite" };

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { id: true, legalName: true, tradeName: true } } },
  });

  if (!invitation) return { success: false, error: "Convite não encontrado" };
  if (invitation.status !== "pending") return { success: false, error: "Este convite já foi utilizado ou revogado" };
  if (invitation.expiresAt < new Date()) return { success: false, error: "Convite expirado" };
  if (invitation.email !== session.user.email) {
    return { success: false, error: `Este convite é para ${invitation.email}. Você está logado como ${session.user.email}` };
  }

  const exists = await prisma.member.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: invitation.organizationId } },
  });
  if (exists) {
    await prisma.invitation.update({ where: { token }, data: { status: "accepted" } });
    return { success: true, data: { orgName: invitation.organization.tradeName ?? invitation.organization.legalName } };
  }

  await prisma.$transaction([
    prisma.member.create({
      data: {
        userId: session.user.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    }),
    prisma.invitation.update({ where: { token }, data: { status: "accepted" } }),
    prisma.session.updateMany({
      where: { userId: session.user.id },
      data: { activeOrganizationId: invitation.organizationId },
    }),
  ]);

  await writeAudit({
    organizationId: invitation.organizationId,
    actorId: session.user.id,
    action: "invitation.accepted",
    resourceType: "Member",
    after: { email: session.user.email, role: invitation.role },
  });

  const orgName = invitation.organization.tradeName ?? invitation.organization.legalName;
  return { success: true, data: { orgName } };
}

export async function getInvitationAction(token: string) {
  return prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { legalName: true, tradeName: true } }, invitedBy: { select: { name: true } } },
  });
}
