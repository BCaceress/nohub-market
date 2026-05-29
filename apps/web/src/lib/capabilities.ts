import "server-only";
import { prisma } from "@nohub/db";

export {
  type DerivedCapability,
  deriveCapabilities,
  OMNICHANNEL_CHANNELS,
  type OperationInput,
  type SegmentType,
  type StockStructureType,
} from "./capability-rules";

export async function getCapabilities(
  organizationId: string,
): Promise<Map<string, Record<string, unknown> | null>> {
  const rows = await prisma.organizationCapability.findMany({
    where: { organizationId, enabled: true },
  });
  return new Map(rows.map((r) => [r.key, (r.config as Record<string, unknown>) ?? null]));
}

export async function hasCapability(organizationId: string, key: string): Promise<boolean> {
  const row = await prisma.organizationCapability.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  return !!row?.enabled;
}

// Guard de servidor — bloqueia recurso não habilitado.
export async function requireCapability(organizationId: string, key: string) {
  if (!(await hasCapability(organizationId, key))) {
    throw new Error(`CAPABILITY_REQUIRED:${key}`);
  }
}
