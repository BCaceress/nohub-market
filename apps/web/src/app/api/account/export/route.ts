import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { NextResponse } from "next/server";

// LGPD — portabilidade: exporta todos os dados do usuário.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      members: { include: { organization: true } },
      preferences: true,
      sessions: { select: { createdAt: true, ipAddress: true } },
      accounts: { select: { providerId: true, createdAt: true } },
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { dataExportRequestedAt: new Date() },
  });
  await writeAudit({
    actorId: session.user.id,
    action: "lgpd.data_exported",
    resourceType: "User",
    resourceId: session.user.id,
  });

  return new NextResponse(JSON.stringify(user, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nohub-meus-dados-${Date.now()}.json"`,
    },
  });
}
