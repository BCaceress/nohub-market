"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { onlyDigits } from "@nohub/shared/brazilian";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  document: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || ["viewer"].includes(m.role)) throw new Error("FORBIDDEN");
  return m;
}

export async function getSuppliersAction(organizationId: string) {
  return prisma.supplier.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function createSupplierAction(
  organizationId: string,
  input: SupplierInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const supplier = await prisma.supplier.create({
    data: {
      ...parsed.data,
      organizationId,
      document: parsed.data.document ? onlyDigits(parsed.data.document) : undefined,
      email: parsed.data.email || undefined,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "supplier.created",
    resourceType: "Supplier",
    resourceId: supplier.id,
    after: { name: supplier.name },
  });

  revalidatePath("/app/suppliers");
  return { success: true, data: { id: supplier.id } };
}

export async function updateSupplierAction(
  organizationId: string,
  supplierId: string,
  input: SupplierInput,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  await prisma.supplier.updateMany({
    where: { id: supplierId, organizationId },
    data: {
      ...parsed.data,
      document: parsed.data.document ? onlyDigits(parsed.data.document) : undefined,
      email: parsed.data.email || undefined,
    },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "supplier.updated",
    resourceType: "Supplier",
    resourceId: supplierId,
  });

  revalidatePath("/app/suppliers");
  return { success: true, data: null };
}

export async function deleteSupplierAction(
  organizationId: string,
  supplierId: string,
): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  await prisma.supplier.updateMany({
    where: { id: supplierId, organizationId },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "supplier.deleted",
    resourceType: "Supplier",
    resourceId: supplierId,
  });

  revalidatePath("/app/suppliers");
  return { success: true, data: null };
}
