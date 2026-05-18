import "server-only";
import { prisma } from "@nohub/db";
import { maskDocument, maskEmail, maskPhone } from "@nohub/shared/brazilian";

// Campos PII mascarados antes de gravar no AuditLog (RN-12).
const PII_KEYS: Record<string, (v: string) => string> = {
  email: maskEmail,
  document: maskDocument,
  cnpj: maskDocument,
  cpf: maskDocument,
  phone: maskPhone,
};

function maskPii(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPii);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        const masker = PII_KEYS[k.toLowerCase()];
        if (masker && typeof v === "string") return [k, masker(v)];
        return [k, maskPii(v)];
      }),
    );
  }
  return value;
}

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
      before: (maskPii(input.before) as object) ?? undefined,
      after: (maskPii(input.after) as object) ?? undefined,
      metadata: (maskPii(input.metadata) as object) ?? undefined,
    },
  });
}
