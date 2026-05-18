import "server-only";
import { prisma } from "@nohub/db";

// Auditoria inline nas server actions (decisão 18 / RN-10).
export async function writeAudit(input: {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      before: (input.before as object) ?? undefined,
      after: (input.after as object) ?? undefined,
      metadata: (input.metadata as object) ?? undefined,
    },
  });
}
