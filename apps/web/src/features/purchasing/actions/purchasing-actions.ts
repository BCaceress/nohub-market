"use server";

/**
 * Purchasing server actions — Etapa 6.
 *
 * Padrão: requireSessionWithOrg() → organizationId → domain lib → Result<T,E>
 * Todas as mutations escrevem AuditLog via as libs.
 */

import type { SupplierReturnReason } from "@nohub/db";
import { prisma } from "@nohub/db";
import { requireSessionWithOrg } from "@/lib/auth-server";
import { confirmReceipt } from "../lib/confirm-receipt";
import type { SuggestionItemOverride } from "../lib/convert-suggestion-to-po";
import { convertSuggestionToPO } from "../lib/convert-suggestion-to-po";
import type { PaymentTermsInput, POItemInput } from "../lib/create-purchase-order";
import { createPurchaseOrder } from "../lib/create-purchase-order";
import type { QuotationItemInput, SupplierItemResponseInput } from "../lib/create-quotation";
import {
  createQuotation,
  recordSupplierResponse,
  selectQuotationResponse,
} from "../lib/create-quotation";
import type { SupplierReturnItemInput } from "../lib/create-supplier-return";
import { confirmSupplierReturn, createSupplierReturn } from "../lib/create-supplier-return";
import { generatePurchaseSuggestion } from "../lib/generate-purchase-suggestion";
import type { ReceiptItemInput } from "../lib/register-receipt";
import { registerReceipt } from "../lib/register-receipt";
import type { SupplierProductMappingInput } from "../lib/supplier-product-mapping";
import {
  createSupplierProductMapping,
  deleteSupplierProductMapping,
  getSupplierPriceStats,
  listProductSuppliers,
  updateSupplierProductMapping,
} from "../lib/supplier-product-mapping";
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  sendPurchaseOrder,
} from "../lib/transition-purchase-order";
import { confirmNfeImport, importNfeXml } from "../nfe-import/import-nfe-xml";
import type { NfeItemMapping } from "../nfe-import/nfe-import-adapter";

/* ── PurchaseOrder ──────────────────────────────────────────────── */

export async function createPurchaseOrderAction(input: {
  supplierId: string;
  locationId: string;
  items: POItemInput[];
  paymentTerms?: PaymentTermsInput;
  expectedDate?: Date;
  freight?: number;
  discountTotal?: number;
  notes?: string;
  idempotencyKey?: string;
  originSuggestionId?: string;
  originQuotationId?: string;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return createPurchaseOrder({
    ...input,
    organizationId,
    createdBy: actorId,
  });
}

export async function sendPurchaseOrderAction(poId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return sendPurchaseOrder(organizationId, poId, actorId);
}

export async function confirmPurchaseOrderAction(poId: string, expectedDate?: Date) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return confirmPurchaseOrder(organizationId, poId, actorId, expectedDate);
}

export async function cancelPurchaseOrderAction(poId: string, reason: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return cancelPurchaseOrder(organizationId, poId, actorId, reason);
}

/* ── GoodsReceipt ───────────────────────────────────────────────── */

export async function registerReceiptAction(input: {
  purchaseOrderId: string;
  items: ReceiptItemInput[];
  supplierInvoiceNumber?: string | null;
  supplierInvoiceSeries?: string | null;
  supplierInvoiceAccessKey?: string | null;
  notes?: string | null;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return registerReceipt({
    ...input,
    organizationId,
    receivedBy: actorId,
  });
}

export async function confirmReceiptAction(receiptId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return confirmReceipt(receiptId, organizationId, actorId);
}

/* ── SupplierReturn ─────────────────────────────────────────────── */

export async function createSupplierReturnAction(input: {
  goodsReceiptId: string;
  reason: SupplierReturnReason;
  items: SupplierReturnItemInput[];
  notes?: string | null;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return createSupplierReturn({
    ...input,
    organizationId,
    requestedBy: actorId,
  });
}

export async function confirmSupplierReturnAction(returnId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return confirmSupplierReturn(returnId, organizationId, actorId);
}

/* ── PurchaseSuggestion ─────────────────────────────────────────── */

export async function generatePurchaseSuggestionAction(input: {
  locationId: string;
  lookbackDays?: number;
  bufferDays?: number;
  productIds?: string[];
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return generatePurchaseSuggestion({ ...input, organizationId, actorId });
}

export async function convertSuggestionToPOAction(input: {
  suggestionId: string;
  itemOverrides?: SuggestionItemOverride[];
  paymentTerms?: PaymentTermsInput;
  notes?: string;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return convertSuggestionToPO({ ...input, organizationId, actorId });
}

export async function dismissSuggestionAction(suggestionId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  const suggestion = await prisma.purchaseSuggestion.findUnique({
    where: { id: suggestionId },
  });
  if (!suggestion || suggestion.organizationId !== organizationId) {
    return { success: false as const, error: "Sugestão não encontrada" };
  }
  if (suggestion.status !== "PENDING") {
    return { success: false as const, error: "Sugestão não está pendente" };
  }

  await prisma.purchaseSuggestion.update({
    where: { id: suggestionId },
    data: { status: "DISMISSED" },
  });

  return { success: true as const };
}

/* ── Quotation ──────────────────────────────────────────────────── */

export async function createQuotationAction(input: {
  locationId: string;
  description: string;
  supplierIds: string[];
  items: QuotationItemInput[];
  expectedDeliveryDate?: Date | null;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return createQuotation({ ...input, organizationId, createdBy: actorId });
}

export async function recordSupplierResponseAction(input: {
  quotationId: string;
  supplierId: string;
  itemResponses: SupplierItemResponseInput[];
  paymentTerms?: {
    type: string;
    installments?: Array<{ days: number; percentual: number }>;
  } | null;
  leadTimeDays?: number | null;
  totalPrice?: number | null;
  notes?: string | null;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return recordSupplierResponse({ ...input, organizationId, actorId });
}

export async function selectQuotationResponseAction(input: {
  quotationId: string;
  responseId: string;
  locationId: string;
  notes?: string | null;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return selectQuotationResponse({ ...input, organizationId, actorId });
}

/* ── NFe Import ─────────────────────────────────────────────────── */

export async function importNfeXmlAction(input: {
  locationId: string;
  xmlContent: string;
  autoMap?: boolean;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return importNfeXml({ ...input, organizationId, actorId });
}

export async function confirmNfeImportAction(input: {
  nfeImportId: string;
  itemMappings: NfeItemMapping[];
  supplierId?: string;
  paymentTerms?: { type: string; installments?: Array<{ days: number; percentual: number }> };
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const actorId = session.user.id;

  return confirmNfeImport({ ...input, organizationId, actorId });
}

/* ── Queries ────────────────────────────────────────────────────── */

export async function listPurchaseOrdersAction(params?: {
  status?: string;
  supplierId?: string;
  page?: number;
  pageSize?: number;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const { status, supplierId, page = 1, pageSize = 20 } = params ?? {};

  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: where as never,
      include: { supplier: { select: { id: true, name: true } }, items: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where: where as never }),
  ]);

  return { orders, total, page, pageSize };
}

export async function getPurchaseOrderAction(poId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.purchaseOrder.findFirst({
    where: { id: poId, organizationId },
    include: {
      supplier: true,
      location: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true } },
        },
      },
      receipts: { orderBy: { createdAt: "desc" } },
      accountPayables: { orderBy: { dueDate: "asc" } },
      history: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function listReceiptsAction(poId?: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.goodsReceipt.findMany({
    where: { organizationId, ...(poId ? { purchaseOrderId: poId } : {}) },
    include: { purchaseOrder: { select: { id: true, supplier: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getReceiptAction(receiptId: string) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.goodsReceipt.findFirst({
    where: { id: receiptId, organizationId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true } },
          variant: { select: { id: true, name: true } },
        },
      },
      purchaseOrder: {
        select: { id: true, supplierId: true, supplier: { select: { name: true } } },
      },
    },
  });
}

export async function listAccountPayablesAction(params?: {
  status?: string;
  supplierId?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;
  const { status, supplierId, overdue, page = 1, pageSize = 20 } = params ?? {};

  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (overdue) where.dueDate = { lt: new Date() };

  const [payables, total] = await Promise.all([
    prisma.accountPayable.findMany({
      where: where as never,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.accountPayable.count({ where: where as never }),
  ]);

  return { payables, total, page, pageSize };
}

export async function listSuggestionsAction() {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.purchaseSuggestion.findMany({
    where: { organizationId, status: "PENDING" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });
}

export async function listQuotationsAction() {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.quotation.findMany({
    where: { organizationId },
    include: {
      items: { include: { product: { select: { id: true, name: true } } } },
      supplierResponses: { include: { supplier: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listNfeImportsAction(params?: { status?: string }) {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.nfeImport.findMany({
    where: { organizationId, ...(params?.status ? { status: params.status as never } : {}) },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });
}

export async function listSuppliersAction() {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.supplier.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function listLocationsAction() {
  const session = await requireSessionWithOrg();
  const organizationId = session.organizationId;

  return prisma.location.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

/* ── Fornecedores do produto (SupplierProductMapping, RN-P12) ─────── */

// Decimal → number: objetos Prisma.Decimal não podem cruzar a fronteira
// Server→Client. Serializa antes de devolver pra UI.
function dec(v: { toString(): string } | null): number | null {
  if (v == null) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

export async function listProductSuppliersAction(productId: string) {
  const session = await requireSessionWithOrg();
  const rows = await listProductSuppliers(session.organizationId, productId);
  return rows.map((m) => ({
    id: m.id,
    supplierId: m.supplierId,
    supplierProductCode: m.supplierProductCode,
    supplierProductName: m.supplierProductName,
    purchaseUnit: m.purchaseUnit,
    defaultPackQuantity: dec(m.defaultPackQuantity),
    minOrderQuantity: dec(m.minOrderQuantity),
    barcode: m.barcode,
    leadTimeDays: m.leadTimeDays,
    discountPercent: dec(m.discountPercent),
    lastCost: dec(m.lastCost),
    previousCost: dec(m.previousCost),
    lastPurchaseAt: m.lastPurchaseAt ? m.lastPurchaseAt.toISOString() : null,
    isPreferred: m.isPreferred,
    active: m.active,
    supplier: {
      id: m.supplier.id,
      name: m.supplier.name,
      defaultLeadTimeDays: m.supplier.defaultLeadTimeDays,
    },
  }));
}

export async function createProductSupplierAction(input: SupplierProductMappingInput) {
  const session = await requireSessionWithOrg();
  return createSupplierProductMapping(
    { organizationId: session.organizationId, actorId: session.user.id },
    input,
  );
}

export async function updateProductSupplierAction(
  mappingId: string,
  input: Partial<SupplierProductMappingInput>,
) {
  const session = await requireSessionWithOrg();
  return updateSupplierProductMapping(
    { organizationId: session.organizationId, actorId: session.user.id },
    mappingId,
    input,
  );
}

export async function deleteProductSupplierAction(mappingId: string) {
  const session = await requireSessionWithOrg();
  return deleteSupplierProductMapping(
    { organizationId: session.organizationId, actorId: session.user.id },
    mappingId,
  );
}

export async function getProductSupplierPriceStatsAction(mappingId: string) {
  const session = await requireSessionWithOrg();
  return getSupplierPriceStats(session.organizationId, mappingId);
}
