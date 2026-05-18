"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { lookupCep, lookupCnpj } from "@/lib/brasilapi";
import { type ProductCategory, deriveCapabilities } from "@/lib/capabilities";
import { type Prisma, prisma } from "@nohub/db";
import { isValidCNPJ, onlyDigits } from "@nohub/shared/brazilian";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";

const MAX_ORGS_PER_USER = 5; // RN-04

type AuthedResult =
  | { error: string }
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> };

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
  return `${base || "org"}-${Math.random().toString(36).slice(2, 7)}`;
}

async function authed(): Promise<AuthedResult> {
  const session = await getSession();
  if (!session) return { error: "Não autenticado" as const };
  if (!session.user.emailVerified) return { error: "Email não verificado" as const }; // RN-05
  return { ok: true, session };
}

export async function cnpjLookupAction(cnpj: string): Promise<Result<unknown>> {
  if (!isValidCNPJ(cnpj)) return { success: false, error: "CNPJ inválido" };
  const data = await lookupCnpj(cnpj);
  if (!data)
    return {
      success: false,
      error: "Consulta indisponível — preencha manualmente",
    };
  return { success: true, data };
}

export async function cepLookupAction(cep: string): Promise<Result<unknown>> {
  const data = await lookupCep(cep);
  if (!data) return { success: false, error: "CEP não encontrado" };
  return { success: true, data };
}

interface CreateOrgInput {
  document: string;
  legalName: string;
  tradeName?: string;
  cnae?: string;
  taxRegime?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
}

// Passo 2 — cria o tenant, vincula owner, define org ativa na sessão.
export async function createOrganizationAction(
  input: CreateOrgInput,
): Promise<Result<{ organizationId: string }>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  const { session } = a;

  const document = onlyDigits(input.document);
  if (!isValidCNPJ(document)) return { success: false, error: "CNPJ inválido" };

  const existing = await prisma.organization.findUnique({
    where: { document },
  });
  if (existing) return { success: false, error: "Já existe organização com este CNPJ" }; // RN-01

  const count = await prisma.member.count({
    where: { userId: session.user.id },
  });
  if (count >= MAX_ORGS_PER_USER)
    return {
      success: false,
      error: `Limite de ${MAX_ORGS_PER_USER} organizações por usuário`,
    };

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        slug: slugify(input.tradeName || input.legalName),
        legalName: input.legalName,
        tradeName: input.tradeName,
        document,
        documentType: "CNPJ",
        taxRegime: (input.taxRegime as never) || null,
        cnae: input.cnae,
        zipCode: input.zipCode ? onlyDigits(input.zipCode) : null,
        street: input.street,
        number: input.number,
        complement: input.complement,
        district: input.district,
        city: input.city,
        state: input.state,
        onboardingStep: 3,
      },
    });
    await tx.member.create({
      data: {
        userId: session.user.id,
        organizationId: created.id,
        role: "owner",
      }, // RN-03
    });
    await tx.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        activeScopeType: "organization",
        activeScopeId: created.id,
      },
      update: { activeScopeType: "organization", activeScopeId: created.id },
    });
    await tx.session.updateMany({
      where: { userId: session.user.id },
      data: { activeOrganizationId: created.id },
    });
    return created;
  });

  await writeAudit({
    organizationId: org.id,
    actorId: session.user.id,
    action: "organization.created",
    resourceType: "Organization",
    resourceId: org.id,
    after: { document, legalName: org.legalName },
  });

  return { success: true, data: { organizationId: org.id } };
}

// Passo 3 — materializa capabilities (RN-06/07/08).
export async function saveOperationAction(input: {
  organizationId: string;
  businessType: "UNMANNED_MARKET" | "CONVENIENCE" | "BEVERAGE" | "HYBRID";
  salesChannels: string[];
  productCategories: ProductCategory[];
}): Promise<Result<{ capabilities: string[] }>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);

  const caps = deriveCapabilities({
    businessType: input.businessType,
    productCategories: input.productCategories,
  });

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: input.organizationId },
      data: { businessType: input.businessType, onboardingStep: 4 },
    });
    for (const c of caps) {
      const config = c.config as Prisma.InputJsonValue | undefined;
      await tx.organizationCapability.upsert({
        where: {
          organizationId_key: {
            organizationId: input.organizationId,
            key: c.key,
          },
        },
        create: {
          organizationId: input.organizationId,
          key: c.key,
          config,
        },
        update: { config, enabled: true },
      });
    }
    for (const ch of input.salesChannels) {
      await tx.salesChannel.create({
        data: {
          organizationId: input.organizationId,
          type: ch as never,
          name: ch,
          enabled: false,
        },
      });
    }
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: a.session.user.id,
    action: "capabilities.materialized",
    resourceType: "OrganizationCapability",
    after: { keys: caps.map((c) => c.key) },
  });

  return { success: true, data: { capabilities: caps.map((c) => c.key) } };
}

// Passo 4 — unidades físicas.
export async function saveLocationsAction(input: {
  organizationId: string;
  locations: {
    name: string;
    type: "STORE" | "DC" | "HYBRID";
    isSelfService: boolean;
    is24h: boolean;
  }[];
}): Promise<Result<null>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);
  if (input.locations.length === 0)
    return { success: false, error: "Cadastre ao menos uma unidade" };

  await prisma.$transaction(async (tx) => {
    await tx.location.deleteMany({
      where: { organizationId: input.organizationId },
    });
    await tx.location.createMany({
      data: input.locations.map((l) => ({
        ...l,
        organizationId: input.organizationId,
      })),
    });
    await tx.organization.update({
      where: { id: input.organizationId },
      data: { onboardingStep: 5 },
    });
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: a.session.user.id,
    action: "locations.created",
    resourceType: "Location",
    after: { count: input.locations.length },
  });

  return { success: true, data: null };
}

// Passo 5 — preferência de catálogo (registrada; execução em etapa futura).
export async function saveCatalogAction(input: {
  organizationId: string;
  method: "template" | "spreadsheet" | "manual";
}): Promise<Result<null>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { onboardingData: true },
  });
  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      onboardingStep: 6,
      onboardingData: {
        ...((org?.onboardingData as object) ?? {}),
        catalogMethod: input.method,
      },
    },
  });
  return { success: true, data: null };
}

// Passo 6 — finaliza (RN-11).
export async function finalizeOnboardingAction(input: {
  organizationId: string;
  nfceEnabled: boolean;
  paymentMethods: string[];
}): Promise<Result<null>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { onboardingData: true },
  });
  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      onboardingCompleted: true,
      onboardingStep: 6,
      onboardingData: {
        ...((org?.onboardingData as object) ?? {}),
        nfceEnabled: input.nfceEnabled,
        paymentMethods: input.paymentMethods,
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: a.session.user.id,
    action: "onboarding.completed",
    resourceType: "Organization",
    resourceId: input.organizationId,
  });

  revalidatePath("/app");
  return { success: true, data: null };
}

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m) throw new Error("FORBIDDEN");
}
