/**
 * createQuotation — cria Quotation para cotação com múltiplos fornecedores.
 * recordSupplierResponse — registra resposta de um fornecedor.
 * selectQuotationResponse — seleciona resposta vencedora e gera PO DRAFT.
 *
 * Schema real:
 *   Quotation: description (required), status: OPEN/CLOSED/CONVERTED, closedAt
 *   QuotationItem: quantity (not requestedQuantity)
 *   QuotationSupplierResponse: selected Boolean, receivedAt, paymentTerms, leadTimeDays, totalPrice
 *   QuotationSupplierItemResponse: unitCost Decimal?, available Boolean
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import { createPurchaseOrder } from "./create-purchase-order";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type QuotationItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  notes?: string | null;
};

export type CreateQuotationInput = {
  organizationId: string;
  locationId: string;
  createdBy: string;
  description: string;
  supplierIds: string[];
  items: QuotationItemInput[];
  expectedDeliveryDate?: Date | null;
};

export type CreateQuotationResult =
  | { success: true; quotationId: string }
  | { success: false; error: string; code?: string };

/* ── createQuotation ────────────────────────────────────────────── */

export async function createQuotation(input: CreateQuotationInput): Promise<CreateQuotationResult> {
  if (input.supplierIds.length === 0) {
    return { success: false, error: "Informe pelo menos um fornecedor", code: "NO_SUPPLIERS" };
  }
  if (input.items.length === 0) {
    return { success: false, error: "Cotação deve ter pelo menos um item", code: "NO_ITEMS" };
  }

  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: input.supplierIds }, organizationId: input.organizationId, deletedAt: null },
  });
  if (suppliers.length !== input.supplierIds.length) {
    return {
      success: false,
      error: "Um ou mais fornecedores não encontrados",
      code: "SUPPLIER_NOT_FOUND",
    };
  }

  const quotation = await prisma.quotation.create({
    data: {
      organizationId: input.organizationId,
      description: input.description,
      createdBy: input.createdBy,
      status: "OPEN",
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
          notes: item.notes ?? null,
        })),
      },
      supplierResponses: {
        create: input.supplierIds.map((supplierId) => ({
          supplierId,
          selected: false,
        })),
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.createdBy,
    action: "quotation.created",
    resourceType: "Quotation",
    resourceId: quotation.id,
    after: { supplierCount: input.supplierIds.length, itemCount: input.items.length },
  });

  return { success: true, quotationId: quotation.id };
}

/* ── recordSupplierResponse ─────────────────────────────────────── */

export type SupplierItemResponseInput = {
  quotationItemId: string;
  unitCost?: number | null;
  available?: boolean;
  notes?: string | null;
};

export type RecordSupplierResponseInput = {
  organizationId: string;
  quotationId: string;
  supplierId: string;
  actorId: string;
  itemResponses: SupplierItemResponseInput[];
  paymentTerms?: {
    type: string;
    installments?: Array<{ days: number; percentual: number }>;
  } | null;
  leadTimeDays?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
};

export type RecordSupplierResponseResult =
  | { success: true; responseId: string }
  | { success: false; error: string; code?: string };

export async function recordSupplierResponse(
  input: RecordSupplierResponseInput,
): Promise<RecordSupplierResponseResult> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: input.quotationId },
  });

  if (!quotation || quotation.organizationId !== input.organizationId) {
    return { success: false, error: "Cotação não encontrada", code: "NOT_FOUND" };
  }
  if (quotation.status === "CLOSED" || quotation.status === "CONVERTED") {
    return { success: false, error: `Cotação em ${quotation.status}`, code: "INVALID_STATUS" };
  }

  const existing = await prisma.quotationSupplierResponse.findFirst({
    where: { quotationId: input.quotationId, supplierId: input.supplierId },
  });
  if (!existing) {
    return {
      success: false,
      error: "Fornecedor não está nesta cotação",
      code: "SUPPLIER_NOT_IN_QUOTATION",
    };
  }

  const response = await prisma.quotationSupplierResponse.update({
    where: { id: existing.id },
    data: {
      paymentTerms: (input.paymentTerms ?? null) as never,
      leadTimeDays: input.leadTimeDays ?? null,
      totalPrice: input.totalPrice ?? null,
      notes: input.notes ?? null,
      receivedAt: new Date(),
      itemResponses: {
        deleteMany: {},
        create: input.itemResponses.map((ir) => ({
          quotationItemId: ir.quotationItemId,
          unitCost: ir.unitCost ?? null,
          available: ir.available ?? true,
          notes: ir.notes ?? null,
        })),
      },
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "quotation_response.recorded",
    resourceType: "QuotationSupplierResponse",
    resourceId: response.id,
    after: { quotationId: input.quotationId, supplierId: input.supplierId },
  });

  return { success: true, responseId: response.id };
}

/* ── selectQuotationResponse ────────────────────────────────────── */

export type SelectQuotationResponseInput = {
  organizationId: string;
  quotationId: string;
  responseId: string;
  locationId: string;
  actorId: string;
  notes?: string | null;
};

export type SelectQuotationResponseResult =
  | { success: true; purchaseOrderId: string }
  | { success: false; error: string; code?: string };

export async function selectQuotationResponse(
  input: SelectQuotationResponseInput,
): Promise<SelectQuotationResponseResult> {
  const quotation = await prisma.quotation.findUnique({
    where: { id: input.quotationId },
    include: {
      items: true,
      supplierResponses: {
        include: { itemResponses: true },
      },
    },
  });

  if (!quotation || quotation.organizationId !== input.organizationId) {
    return { success: false, error: "Cotação não encontrada", code: "NOT_FOUND" };
  }
  if (quotation.status !== "OPEN") {
    return {
      success: false,
      error: `Não é possível selecionar em ${quotation.status}`,
      code: "INVALID_STATUS",
    };
  }

  const selectedResponse = quotation.supplierResponses.find((r) => r.id === input.responseId);
  if (!selectedResponse) {
    return { success: false, error: "Resposta não encontrada", code: "RESPONSE_NOT_FOUND" };
  }
  if (!selectedResponse.receivedAt) {
    return {
      success: false,
      error: "Resposta do fornecedor ainda não registrada",
      code: "RESPONSE_NOT_READY",
    };
  }

  const itemResponseMap = new Map(
    selectedResponse.itemResponses.map((ir) => [ir.quotationItemId, ir]),
  );

  const poItems = quotation.items.map((qi) => {
    const ir = itemResponseMap.get(qi.id);
    return {
      productId: qi.productId,
      variantId: qi.variantId,
      expectedQuantity: Number(qi.quantity),
      unitCost: ir?.unitCost != null ? Number(ir.unitCost) : 0,
    };
  });

  const poResult = await createPurchaseOrder({
    organizationId: input.organizationId,
    supplierId: selectedResponse.supplierId,
    locationId: input.locationId,
    createdBy: input.actorId,
    originQuotationId: input.quotationId,
    paymentTerms: selectedResponse.paymentTerms as
      | { type: string; installments?: Array<{ days: number; percentual: number }> }
      | undefined,
    notes: input.notes ?? undefined,
    items: poItems,
  });

  if (!poResult.success) {
    return { success: false, error: poResult.error, code: poResult.code };
  }

  // Marcar resposta como selecionada e fechar cotação
  await prisma.$transaction([
    prisma.quotationSupplierResponse.update({
      where: { id: input.responseId },
      data: { selected: true },
    }),
    prisma.quotation.update({
      where: { id: input.quotationId },
      data: { status: "CONVERTED", closedAt: new Date() },
    }),
  ]);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "quotation.converted",
    resourceType: "Quotation",
    resourceId: input.quotationId,
    after: { responseId: input.responseId, purchaseOrderId: poResult.purchaseOrderId },
  });

  return { success: true, purchaseOrderId: poResult.purchaseOrderId };
}
