/**
 * SupplierProductMapping — vínculo N:N Fornecedor↔Produto (RN-P12).
 *
 * Modela "Fornecedores do produto": cada produto pode ser comprado de vários
 * fornecedores, cada um com seu código, preço, embalagem e prazo. A UI vive na
 * página do produto (seção Fornecedores), mas o domínio é de compras.
 *
 * Padrão: organizationId sempre presente; mutations escrevem AuditLog; retorna Result<T>.
 *
 * Custos: `lastCost`/`previousCost` são snapshot. A série completa vai em
 * SupplierProductPriceHistory (base p/ menor preço / preço médio / economia),
 * alimentada por recordSupplierPrice — chamado no recebimento e na importação de NFe.
 */

import type { PriceSource, Prisma } from "@nohub/db";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { writeAudit } from "@/lib/audit";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type SupplierProductMappingInput = {
  supplierId: string;
  productId: string;
  variantId?: string | null;
  supplierProductCode: string;
  supplierProductName: string;
  purchaseUnit?: Prisma.SupplierProductMappingCreateInput["purchaseUnit"];
  defaultPackQuantity?: number | null;
  minOrderQuantity?: number | null;
  barcode?: string | null;
  leadTimeDays?: number | null;
  discountPercent?: number | null;
  lastCost?: number | null;
  isPreferred?: boolean;
  active?: boolean;
};

type MappingMutationContext = {
  organizationId: string;
  actorId: string;
};

/* ── Helpers ────────────────────────────────────────────────────── */

function normalizeVariantId(variantId?: string | null): string | null {
  return variantId && variantId.length > 0 ? variantId : null;
}

/**
 * Garante que no máximo um mapping seja `isPreferred` por (produto, variante).
 * Roda dentro de uma transação; desmarca os demais antes de marcar o alvo.
 */
async function clearOtherPreferred(
  tx: Prisma.TransactionClient,
  organizationId: string,
  productId: string,
  variantId: string | null,
  keepMappingId: string | null,
) {
  await tx.supplierProductMapping.updateMany({
    where: {
      organizationId,
      productId,
      variantId,
      isPreferred: true,
      ...(keepMappingId ? { id: { not: keepMappingId } } : {}),
    },
    data: { isPreferred: false },
  });
}

/* ── List ───────────────────────────────────────────────────────── */

/** Lista os fornecedores de um produto, preferencial primeiro, com nome do fornecedor. */
export async function listProductSuppliers(organizationId: string, productId: string) {
  return prisma.supplierProductMapping.findMany({
    where: { organizationId, productId },
    orderBy: [{ isPreferred: "desc" }, { lastCost: "asc" }, { createdAt: "asc" }],
    include: {
      supplier: { select: { id: true, name: true, defaultLeadTimeDays: true } },
    },
  });
}

/* ── Create ─────────────────────────────────────────────────────── */

export async function createSupplierProductMapping(
  ctx: MappingMutationContext,
  input: SupplierProductMappingInput,
): Promise<Result<{ id: string }>> {
  const { organizationId, actorId } = ctx;
  const variantId = normalizeVariantId(input.variantId);

  // Produto e fornecedor precisam pertencer à org (evita cross-tenant)
  const [product, supplier] = await Promise.all([
    prisma.product.findFirst({
      where: { id: input.productId, organizationId },
      select: { id: true },
    }),
    prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!product) return { success: false, error: "Produto não encontrado" };
  if (!supplier) return { success: false, error: "Fornecedor não encontrado" };

  // Um fornecedor só pode aparecer uma vez por produto/variante
  const existing = await prisma.supplierProductMapping.findFirst({
    where: { organizationId, productId: input.productId, variantId, supplierId: input.supplierId },
    select: { id: true },
  });
  if (existing) return { success: false, error: "Este fornecedor já está vinculado ao produto" };

  try {
    const created = await prisma.$transaction(async (tx) => {
      const mapping = await tx.supplierProductMapping.create({
        data: {
          organizationId,
          supplierId: input.supplierId,
          productId: input.productId,
          variantId,
          supplierProductCode: input.supplierProductCode.trim(),
          supplierProductName: input.supplierProductName.trim(),
          purchaseUnit: input.purchaseUnit ?? null,
          defaultPackQuantity: input.defaultPackQuantity ?? null,
          minOrderQuantity: input.minOrderQuantity ?? null,
          barcode: input.barcode?.trim() || null,
          leadTimeDays: input.leadTimeDays ?? null,
          discountPercent: input.discountPercent ?? null,
          lastCost: input.lastCost ?? null,
          isPreferred: input.isPreferred ?? false,
          active: input.active ?? true,
        },
        select: { id: true },
      });

      if (input.isPreferred) {
        await clearOtherPreferred(tx, organizationId, input.productId, variantId, mapping.id);
      }

      // Custo inicial entra no histórico como ponto MANUAL
      if (input.lastCost != null) {
        await tx.supplierProductPriceHistory.create({
          data: {
            organizationId,
            mappingId: mapping.id,
            unitCost: input.lastCost,
            source: "MANUAL",
          },
        });
      }

      return mapping;
    });

    await writeAudit({
      organizationId,
      actorId,
      action: "supplier_product_mapping.created",
      resourceType: "SupplierProductMapping",
      resourceId: created.id,
      after: { supplierId: input.supplierId, productId: input.productId, variantId },
    });

    return { success: true, data: { id: created.id } };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "Já existe um produto com esse código neste fornecedor" };
    }
    throw err;
  }
}

/* ── Update ─────────────────────────────────────────────────────── */

export async function updateSupplierProductMapping(
  ctx: MappingMutationContext,
  mappingId: string,
  input: Partial<SupplierProductMappingInput>,
): Promise<Result<null>> {
  const { organizationId, actorId } = ctx;

  const current = await prisma.supplierProductMapping.findFirst({
    where: { id: mappingId, organizationId },
    select: { id: true, productId: true, variantId: true, lastCost: true },
  });
  if (!current) return { success: false, error: "Vínculo não encontrado" };

  // Trocar lastCost arquiva o anterior em previousCost e registra ponto MANUAL
  const costChanged =
    input.lastCost !== undefined && Number(input.lastCost) !== Number(current.lastCost ?? NaN);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplierProductMapping.update({
        where: { id: mappingId },
        data: {
          supplierProductCode: input.supplierProductCode?.trim(),
          supplierProductName: input.supplierProductName?.trim(),
          purchaseUnit: input.purchaseUnit,
          defaultPackQuantity: input.defaultPackQuantity,
          minOrderQuantity: input.minOrderQuantity,
          barcode: input.barcode === undefined ? undefined : input.barcode?.trim() || null,
          leadTimeDays: input.leadTimeDays,
          discountPercent: input.discountPercent,
          isPreferred: input.isPreferred,
          active: input.active,
          ...(costChanged
            ? { lastCost: input.lastCost, previousCost: current.lastCost ?? null }
            : {}),
        },
      });

      if (input.isPreferred) {
        await clearOtherPreferred(
          tx,
          organizationId,
          current.productId,
          current.variantId,
          mappingId,
        );
      }

      if (costChanged && input.lastCost != null) {
        await tx.supplierProductPriceHistory.create({
          data: { organizationId, mappingId, unitCost: input.lastCost, source: "MANUAL" },
        });
      }
    });

    await writeAudit({
      organizationId,
      actorId,
      action: "supplier_product_mapping.updated",
      resourceType: "SupplierProductMapping",
      resourceId: mappingId,
    });

    return { success: true, data: null };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { success: false, error: "Já existe um produto com esse código neste fornecedor" };
    }
    throw err;
  }
}

/* ── Delete ─────────────────────────────────────────────────────── */

export async function deleteSupplierProductMapping(
  ctx: MappingMutationContext,
  mappingId: string,
): Promise<Result<null>> {
  const { organizationId, actorId } = ctx;

  const current = await prisma.supplierProductMapping.findFirst({
    where: { id: mappingId, organizationId },
    select: { id: true },
  });
  if (!current) return { success: false, error: "Vínculo não encontrado" };

  // priceHistory cai junto via onDelete: Cascade
  await prisma.supplierProductMapping.delete({ where: { id: mappingId } });

  await writeAudit({
    organizationId,
    actorId,
    action: "supplier_product_mapping.deleted",
    resourceType: "SupplierProductMapping",
    resourceId: mappingId,
  });

  return { success: true, data: null };
}

/* ── recordSupplierPrice ────────────────────────────────────────── */

/**
 * Registra um custo de compra observado e atualiza o snapshot do mapping.
 * Chamar no recebimento (GoodsReceipt), na confirmação de NFe ou na PO.
 * Idempotente o suficiente para o fluxo: arquiva lastCost→previousCost e
 * grava um ponto no histórico com a origem.
 */
export async function recordSupplierPrice(params: {
  organizationId: string;
  mappingId: string;
  unitCost: number;
  source: PriceSource;
  sourceId?: string | null;
  purchasedAt?: Date;
}): Promise<Result<null>> {
  const { organizationId, mappingId, unitCost, source, sourceId, purchasedAt } = params;

  const mapping = await prisma.supplierProductMapping.findFirst({
    where: { id: mappingId, organizationId },
    select: { id: true, lastCost: true },
  });
  if (!mapping) return { success: false, error: "Vínculo não encontrado" };

  await prisma.$transaction([
    prisma.supplierProductPriceHistory.create({
      data: {
        organizationId,
        mappingId,
        unitCost,
        source,
        sourceId: sourceId ?? null,
        ...(purchasedAt ? { recordedAt: purchasedAt } : {}),
      },
    }),
    prisma.supplierProductMapping.update({
      where: { id: mappingId },
      data: {
        previousCost: mapping.lastCost ?? null,
        lastCost: unitCost,
        lastPurchaseAt: purchasedAt ?? new Date(),
      },
    }),
  ]);

  return { success: true, data: null };
}

/* ── priceStats ─────────────────────────────────────────────────── */

/** Estatísticas de preço de um mapping: menor/maior/médio + último custo. */
export async function getSupplierPriceStats(organizationId: string, mappingId: string) {
  const [agg, last] = await Promise.all([
    prisma.supplierProductPriceHistory.aggregate({
      where: { organizationId, mappingId },
      _min: { unitCost: true },
      _max: { unitCost: true },
      _avg: { unitCost: true },
      _count: true,
    }),
    prisma.supplierProductPriceHistory.findFirst({
      where: { organizationId, mappingId },
      orderBy: { recordedAt: "desc" },
      select: { unitCost: true, recordedAt: true },
    }),
  ]);

  return {
    samples: agg._count,
    minCost: agg._min.unitCost,
    maxCost: agg._max.unitCost,
    avgCost: agg._avg.unitCost,
    lastCost: last?.unitCost ?? null,
    lastRecordedAt: last?.recordedAt ?? null,
  };
}

/* ── Auxiliar ───────────────────────────────────────────────────── */

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
