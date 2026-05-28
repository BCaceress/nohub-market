"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { type SegmentType, type StockStructureType, deriveCapabilities } from "@/lib/capabilities";
import { type Prisma, prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";

const MAX_ORGS_PER_USER = Number(process.env.MAX_ORGS_PER_USER ?? 5);

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
  if (!session.user.emailVerified) return { error: "Email não verificado" as const };
  return { ok: true, session };
}

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m) throw new Error("FORBIDDEN");
}

// Nome inicial — gerado a partir do segmento; usuário ajusta em /app/settings.
function defaultOrgName(segment: SegmentType): string {
  switch (segment) {
    case "BEVERAGE_CONVENIENCE":
      return "Minha Conveniência";
    case "SUPERMARKET":
      return "Meu Supermercado";
    case "UNMANNED_MARKET":
      return "Meu Mercado Autônomo";
  }
}

// Passo 1 — cria a organização com o segmento escolhido.
// RN: 1 conta = 1 segmento. CNPJ/dados fiscais ficam em settings depois.
export async function selectSegmentAction(input: {
  segmentType: SegmentType;
}): Promise<Result<{ organizationId: string }>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  const { session } = a;

  const count = await prisma.member.count({ where: { userId: session.user.id } });
  if (count >= MAX_ORGS_PER_USER) {
    return {
      success: false,
      error: `Limite de ${MAX_ORGS_PER_USER} organizações por usuário`,
    };
  }

  const name = defaultOrgName(input.segmentType);

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        slug: slugify(name),
        legalName: name,
        tradeName: name,
        segmentType: input.segmentType,
        onboardingStep: 2,
      },
    });
    await tx.member.create({
      data: {
        userId: session.user.id,
        organizationId: created.id,
        role: "owner",
      },
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
    after: { segmentType: input.segmentType },
  });

  return { success: true, data: { organizationId: org.id } };
}

// Passo 2 — persiste a quantidade de lojas no estado da org.
export async function saveStoreCountAction(input: {
  organizationId: string;
  storeCount: number;
}): Promise<Result<null>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);

  if (input.storeCount < 1 || input.storeCount > 100) {
    return { success: false, error: "Quantidade entre 1 e 100" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { onboardingData: true },
  });
  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      onboardingStep: 3,
      onboardingData: {
        ...((org?.onboardingData as object) ?? {}),
        storeCount: input.storeCount,
      },
    },
  });

  return { success: true, data: null };
}

// Passo 3 — nomes das lojas (apenas valida + avança passo).
export async function saveStoreNamesAction(input: {
  organizationId: string;
  storeNames: string[];
}): Promise<Result<null>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);

  const cleaned = input.storeNames.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length === 0) return { success: false, error: "Informe ao menos 1 loja" };

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { onboardingData: true },
  });
  await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      onboardingStep: 4,
      onboardingData: {
        ...((org?.onboardingData as object) ?? {}),
        storeNames: cleaned,
      },
    },
  });

  return { success: true, data: null };
}

// Passo 4 — escolha da estrutura de estoque.
export async function saveStockStructureAction(input: {
  organizationId: string;
  stockStructureType: StockStructureType;
  centralDcName?: string;
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
      stockStructureType: input.stockStructureType,
      onboardingStep: 5,
      onboardingData: {
        ...((org?.onboardingData as object) ?? {}),
        centralDcName: input.centralDcName ?? "Centro de Distribuição",
      },
    },
  });

  return { success: true, data: null };
}

// Passo 5 — auto-criação completa.
// Materializa lojas, CD (se aplicável), capabilities, default sales channels.
export async function finalizeOnboardingAction(input: {
  organizationId: string;
}): Promise<Result<{ locationsCreated: number; capabilitiesActivated: number }>> {
  const a = await authed();
  if ("error" in a) return { success: false, error: a.error };
  await assertMember(a.session.user.id, input.organizationId);

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      segmentType: true,
      stockStructureType: true,
      onboardingData: true,
    },
  });
  if (!org?.segmentType || !org.stockStructureType) {
    return { success: false, error: "Onboarding incompleto — segmento ou estoque ausentes" };
  }

  const data = (org.onboardingData as Record<string, unknown>) ?? {};
  const storeNames = (data.storeNames as string[] | undefined) ?? [];
  const centralDcName = (data.centralDcName as string | undefined) ?? "Centro de Distribuição";

  if (storeNames.length === 0) {
    return { success: false, error: "Nenhuma loja cadastrada" };
  }

  const caps = deriveCapabilities({
    segmentType: org.segmentType,
    stockStructureType: org.stockStructureType,
    storeCount: storeNames.length,
  });

  const needsCD = org.stockStructureType === "CENTRAL_DC" || org.stockStructureType === "HYBRID";
  const segment = org.segmentType;

  let locationsCreated = 0;

  await prisma.$transaction(async (tx) => {
    // Limpa locations pré-existentes — onboarding é fonte de verdade.
    await tx.location.deleteMany({ where: { organizationId: input.organizationId } });

    // Cria lojas. Mercado autônomo = isSelfService + 24h por padrão.
    const isUnmanned = segment === "UNMANNED_MARKET";
    for (const name of storeNames) {
      await tx.location.create({
        data: {
          organizationId: input.organizationId,
          name,
          type: "STORE",
          isSelfService: isUnmanned,
          is24h: isUnmanned,
        },
      });
      locationsCreated++;
    }

    // CD se estrutura exige.
    if (needsCD) {
      await tx.location.create({
        data: {
          organizationId: input.organizationId,
          name: centralDcName,
          type: "DC",
          isSelfService: false,
          is24h: false,
        },
      });
      locationsCreated++;
    }

    // Capabilities.
    await tx.organizationCapability.deleteMany({
      where: { organizationId: input.organizationId },
    });
    for (const c of caps) {
      const config = c.config as Prisma.InputJsonValue | undefined;
      await tx.organizationCapability.create({
        data: {
          organizationId: input.organizationId,
          key: c.key,
          config,
          enabled: true,
        },
      });
    }

    // Default sales channels — POS sempre criado.
    // Outros canais (iFood, WhatsApp, ML) ficam disponíveis para ativação posterior em /app/channels.
    await tx.salesChannel.deleteMany({ where: { organizationId: input.organizationId } });

    // Marca completo.
    await tx.organization.update({
      where: { id: input.organizationId },
      data: {
        onboardingCompleted: true,
        onboardingStep: 5,
      },
    });
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: a.session.user.id,
    action: "onboarding.completed",
    resourceType: "Organization",
    resourceId: input.organizationId,
    after: {
      segmentType: segment,
      stockStructureType: org.stockStructureType,
      locationsCreated,
      capabilitiesActivated: caps.length,
    },
  });

  revalidatePath("/app");
  return {
    success: true,
    data: { locationsCreated, capabilitiesActivated: caps.length },
  };
}
