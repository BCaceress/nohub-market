"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { lookupCep } from "@/lib/brasilapi";
import { prisma } from "@nohub/db";
import { formatCEP, onlyDigits } from "@nohub/shared/brazilian";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateOrgSchema = z.object({
  legalName: z.string().min(2, "Razão social obrigatória"),
  tradeName: z.string().optional(),
  taxRegime: z.enum(["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI"]).optional(),
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

async function assertAdminOrOwner(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || !["owner", "admin"].includes(m.role)) {
    throw new Error("FORBIDDEN");
  }
  return m;
}

export async function updateOrgAction(
  organizationId: string,
  input: UpdateOrgInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertAdminOrOwner(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = updateOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const before = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { legalName: true },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...parsed.data,
      zipCode: parsed.data.zipCode ? onlyDigits(parsed.data.zipCode) : undefined,
      taxRegime: parsed.data.taxRegime ?? null,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "organization.updated",
    resourceType: "Organization",
    resourceId: organizationId,
    before: { legalName: before?.legalName },
    after: { legalName: parsed.data.legalName },
  });

  revalidatePath("/app/settings");
  return { success: true, data: null };
}

export async function cepLookupForSettingsAction(cep: string): Promise<Result<unknown>> {
  const data = await lookupCep(cep);
  if (!data) return { success: false, error: "CEP não encontrado" };
  return { success: true, data };
}

export async function getOrgAction(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      document: true,
      taxRegime: true,
      businessType: true,
      zipCode: true,
      street: true,
      number: true,
      complement: true,
      district: true,
      city: true,
      state: true,
      cnae: true,
      slug: true,
    },
  });
}
