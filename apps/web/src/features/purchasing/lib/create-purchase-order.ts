/**
 * createPurchaseOrder — cria PO em DRAFT com snapshot de negociação (RN-P01, RN-P02).
 *
 * Snapshot: productNameSnapshot, unitCost negociado, fiscalDataSnapshot — imutáveis após criação.
 * Idempotência: idempotencyKey evita duplicatas.
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";

export type POItemInput = {
  productId: string;
  variantId?: string | null;
  expectedQuantity: number;
  unitCost: number;
  expectedPackQuantity?: number;
};

export type PaymentTermsInput = {
  type: string; // "CASH" | "NET30" | "NET30_60" | "NET30_60_90" | "CUSTOM"
  installments?: Array<{ days: number; percentual: number }>;
};

export type CreatePurchaseOrderInput = {
  organizationId: string;
  supplierId: string;
  locationId: string;
  items: POItemInput[];
  paymentTerms?: PaymentTermsInput;
  expectedDate?: Date;
  freight?: number;
  discountTotal?: number;
  notes?: string;
  idempotencyKey?: string;
  createdBy: string;
  originSuggestionId?: string;
  originQuotationId?: string;
};

export type CreatePurchaseOrderResult =
  | { success: true; purchaseOrderId: string }
  | { success: false; error: string; code?: string };

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<CreatePurchaseOrderResult> {
  // Idempotência
  if (input.idempotencyKey) {
    const existing = await prisma.purchaseOrder.findFirst({
      where: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return { success: true, purchaseOrderId: existing.id };
  }

  if (input.items.length === 0) {
    return { success: false, error: "Pedido deve ter pelo menos um item", code: "NO_ITEMS" };
  }

  // Validar fornecedor
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, organizationId: input.organizationId, deletedAt: null },
  });
  if (!supplier) {
    return { success: false, error: "Fornecedor não encontrado", code: "SUPPLIER_NOT_FOUND" };
  }

  // Validar location
  const location = await prisma.location.findFirst({
    where: { id: input.locationId, organizationId: input.organizationId, deletedAt: null },
  });
  if (!location) {
    return {
      success: false,
      error: "Unidade de destino não encontrada",
      code: "LOCATION_NOT_FOUND",
    };
  }

  // Buscar snapshots de produtos
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: input.organizationId },
    include: {
      taxData: { take: 1 },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    if (!productMap.has(item.productId)) {
      return {
        success: false,
        error: `Produto ${item.productId} não encontrado`,
        code: "PRODUCT_NOT_FOUND",
      };
    }
  }

  // Calcular totais
  const subtotal = input.items.reduce((s, i) => s + i.unitCost * i.expectedQuantity, 0);
  const discountTotal = input.discountTotal ?? 0;
  const freight = input.freight ?? 0;
  const total = subtotal - discountTotal + freight;

  const po = await prisma.purchaseOrder.create({
    data: {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      locationId: input.locationId,
      status: "DRAFT",
      paymentTerms: (input.paymentTerms ?? null) as never,
      expectedDate: input.expectedDate ?? null,
      notes: input.notes ?? null,
      subtotal,
      discountTotal,
      freight,
      total,
      idempotencyKey: input.idempotencyKey ?? null,
      createdBy: input.createdBy,
      originSuggestionId: input.originSuggestionId ?? null,
      originQuotationId: input.originQuotationId ?? null,
      items: {
        create: input.items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) throw new Error(`Product ${item.productId} not found`);
          const tax = product.taxData[0];
          return {
            productId: item.productId,
            variantId: item.variantId ?? null,
            productNameSnapshot: product.name,
            expectedQuantity: item.expectedQuantity,
            unitCost: item.unitCost,
            lineTotal: item.unitCost * item.expectedQuantity,
            expectedPackQuantity: item.expectedPackQuantity ?? null,
            fiscalDataSnapshot: tax
              ? { ncm: tax.ncm, cfop: tax.cfopInternal ?? tax.cfopInterstate }
              : null,
          };
        }) as never,
      },
      history: {
        create: {
          toStatus: "DRAFT",
          actorId: input.createdBy,
          source: "INTERNAL",
        },
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.createdBy,
    action: "purchase_order.created",
    resourceType: "PurchaseOrder",
    resourceId: po.id,
    after: { supplierId: input.supplierId, total, itemCount: input.items.length },
  });

  return { success: true, purchaseOrderId: po.id };
}
