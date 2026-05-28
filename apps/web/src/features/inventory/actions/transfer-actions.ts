"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { generateTransferSuggestion } from "../lib/generate-transfer-suggestion";
import { transfer } from "../lib/transfer";
import { transferSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

export async function createTransferAction(
  organizationId: string,
  input: unknown,
): Promise<Result<{ transferGroupId: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Inválido" };

  const d = parsed.data;

  if (d.fromLocationId === d.toLocationId) {
    return { success: false, error: "Origem e destino devem ser diferentes" };
  }

  const result = await transfer({
    organizationId,
    fromLocationId: d.fromLocationId,
    toLocationId: d.toLocationId,
    productId: d.productId,
    variantId: d.variantId || null,
    lotId: d.lotId || null,
    quantity: d.quantity,
    note: d.note || null,
    actorId: session.user.id,
    actorName: session.user.name,
  });

  if (!result.success) return { success: false, error: result.error };

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "stock.transfer",
    resourceType: "StockMovement",
    resourceId: result.transferGroupId,
    after: {
      productId: d.productId,
      fromLocationId: d.fromLocationId,
      toLocationId: d.toLocationId,
      quantity: d.quantity,
    },
  });

  revalidatePath("/app/inventory");
  return { success: true, data: { transferGroupId: result.transferGroupId } };
}

export async function getLocationsAction(organizationId: string) {
  return prisma.location.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Gera sugestões de transferência interna: local com excedente → local com déficit.
 * Resultado in-memory — não persiste (exibição imediata, usuário decide executar).
 */
export async function getTransferSuggestionsAction(
  organizationId: string,
  opts: { locationIds?: string[]; productIds?: string[] } = {},
): Promise<Result<Awaited<ReturnType<typeof generateTransferSuggestion>>>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
  });
  if (!m) return { success: false, error: "Sem permissão" };

  const result = await generateTransferSuggestion({
    organizationId,
    actorId: session.user.id,
    locationIds: opts.locationIds,
    productIds: opts.productIds,
  });

  return { success: true, data: result };
}
