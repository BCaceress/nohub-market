import { prisma } from "@nohub/db";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";

// LGPD — direito ao esquecimento. Respeita RN-03 (owner único não sai).
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const soleOwner = await prisma.member.findFirst({
    where: {
      userId: session.user.id,
      role: "owner",
      organization: {
        members: { every: { userId: session.user.id } },
      },
    },
  });
  if (soleOwner) {
    return NextResponse.json(
      {
        error:
          "Você é o único owner de uma organização. Transfira a titularidade ou exclua a organização antes.",
      },
      { status: 409 },
    );
  }

  await writeAudit({
    actorId: session.user.id,
    action: "lgpd.account_deletion_requested",
    resourceType: "User",
    resourceId: session.user.id,
    metadata: { email: session.user.email },
  });

  // Marca solicitação e remove a conta (cascata definida no schema).
  await prisma.user.update({
    where: { id: session.user.id },
    data: { dataDeletionRequestedAt: new Date() },
  });
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
