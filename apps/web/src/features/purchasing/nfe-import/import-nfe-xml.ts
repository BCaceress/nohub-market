/**
 * importNfeXml — faz upload e parse de XML de NFe de entrada (RN-P11).
 * confirmNfeImport — cria PO CONFIRMED + GoodsReceipt DRAFT a partir do mapeamento (RN-P12).
 *
 * Idempotência via accessKey (chave de acesso de 44 dígitos).
 *
 * NfeImportStatus: PENDING → PARSED → MAPPED → CONFIRMED | REJECTED
 */

import { writeAudit } from "@/lib/audit";
import { prisma } from "@nohub/db";
import { createPurchaseOrder } from "../lib/create-purchase-order";
import { registerReceipt } from "../lib/register-receipt";
import { confirmPurchaseOrder, sendPurchaseOrder } from "../lib/transition-purchase-order";
import { mapNfeItems, parseNfeXml } from "./nfe-import-adapter";
import type { NfeItemMapping } from "./nfe-import-adapter";

/* ── Tipos ──────────────────────────────────────────────────────── */

export type ImportNfeXmlInput = {
  organizationId: string;
  locationId: string;
  actorId: string;
  xmlContent: string;
  autoMap?: boolean; // tentar mapeamento automático (default: true)
};

export type ImportNfeXmlResult =
  | { success: true; nfeImportId: string; mappingPending: boolean; unmappedCount: number }
  | { success: false; error: string; code?: string };

export type ConfirmNfeImportInput = {
  organizationId: string;
  nfeImportId: string;
  actorId: string;
  /** Mapeamento final (auto + manual) */
  itemMappings: NfeItemMapping[];
  supplierId?: string;
  paymentTerms?: { type: string; installments?: Array<{ days: number; percentual: number }> };
};

export type ConfirmNfeImportResult =
  | { success: true; purchaseOrderId: string; receiptId: string }
  | { success: false; error: string; code?: string };

/* ── importNfeXml ───────────────────────────────────────────────── */

export async function importNfeXml(input: ImportNfeXmlInput): Promise<ImportNfeXmlResult> {
  const parseResult = parseNfeXml(input.xmlContent);
  if (!parseResult.success) {
    // Salvar como REJECTED para auditoria
    await prisma.nfeImport
      .create({
        data: {
          organizationId: input.organizationId,
          accessKey: `PARSE_FAIL_${Date.now()}`, // placeholder — sem chave válida
          xmlContent: input.xmlContent,
          uploadedBy: input.actorId,
          status: "REJECTED",
          parseErrors: { error: parseResult.error, code: parseResult.code } as never,
        },
      })
      .catch(() => {}); // silencioso — não falhar por isso

    return { success: false, error: parseResult.error, code: parseResult.code };
  }

  const { nfe } = parseResult;

  // Idempotência
  const existing = await prisma.nfeImport.findFirst({
    where: { accessKey: nfe.accessKey, organizationId: input.organizationId },
  });
  if (existing) {
    return {
      success: true,
      nfeImportId: existing.id,
      mappingPending: existing.status === "PARSED",
      unmappedCount: 0,
    };
  }

  // Buscar fornecedor pelo CNPJ
  const supplierByCnpj = await prisma.supplier.findFirst({
    where: { document: nfe.supplier.cnpj, organizationId: input.organizationId, deletedAt: null },
  });

  // Mapeamento automático
  let autoMapped: NfeItemMapping[] = [];
  let unmappedCount = nfe.items.length;

  if (input.autoMap !== false && supplierByCnpj) {
    const mapResult = await mapNfeItems(nfe.items, supplierByCnpj.id, input.organizationId, prisma);
    autoMapped = mapResult.mapped;
    unmappedCount = mapResult.unmapped.length;
  }

  const allMapped = unmappedCount === 0;
  const status = allMapped ? "MAPPED" : "PARSED";

  const nfeImport = await prisma.nfeImport.create({
    data: {
      organizationId: input.organizationId,
      accessKey: nfe.accessKey,
      xmlContent: input.xmlContent,
      uploadedBy: input.actorId,
      status,
      supplierId: supplierByCnpj?.id ?? null,
      parsedData: nfe as never,
      mappingPending: (!allMapped
        ? {
            locationId: input.locationId,
            autoMapped,
            unmappedItems: nfe.items
              .filter((item) => !autoMapped.find((m) => m.nfeItemNumber === item.itemNumber))
              .map((item) => ({
                itemNumber: item.itemNumber,
                productCode: item.productCode,
                ean: item.ean,
                description: item.description,
                quantity: item.quantity,
                unitCost: item.unitCost,
              })),
          }
        : { locationId: input.locationId, autoMapped }) as never,
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "nfe_import.created",
    resourceType: "NfeImport",
    resourceId: nfeImport.id,
    after: { accessKey: nfe.accessKey, itemCount: nfe.items.length, unmappedCount },
  });

  return {
    success: true,
    nfeImportId: nfeImport.id,
    mappingPending: !allMapped,
    unmappedCount,
  };
}

/* ── confirmNfeImport ───────────────────────────────────────────── */

export async function confirmNfeImport(
  input: ConfirmNfeImportInput,
): Promise<ConfirmNfeImportResult> {
  const nfeImport = await prisma.nfeImport.findUnique({
    where: { id: input.nfeImportId },
  });

  if (!nfeImport || nfeImport.organizationId !== input.organizationId) {
    return { success: false, error: "Importação de NFe não encontrada", code: "NOT_FOUND" };
  }

  if (nfeImport.status === "CONFIRMED") {
    return {
      success: true,
      purchaseOrderId: nfeImport.purchaseOrderId ?? "",
      receiptId: nfeImport.goodsReceiptId ?? "",
    };
  }

  if (nfeImport.status !== "PARSED" && nfeImport.status !== "MAPPED") {
    return {
      success: false,
      error: `Status inválido para confirmação: ${nfeImport.status}`,
      code: "INVALID_STATUS",
    };
  }

  if (input.itemMappings.length === 0) {
    return { success: false, error: "Nenhum item mapeado", code: "NO_MAPPINGS" };
  }

  const supplierId = input.supplierId ?? nfeImport.supplierId;
  if (!supplierId) {
    return {
      success: false,
      error: "Fornecedor não identificado. Informe o supplierId.",
      code: "NO_SUPPLIER",
    };
  }

  // Extrair locationId e totais do mappingPending (salvo no upload)
  const mappingPendingData = nfeImport.mappingPending as { locationId?: string } | null;
  const parsedData = nfeImport.parsedData as {
    totals?: { freight?: number; discount?: number };
  } | null;
  const locationId = mappingPendingData?.locationId;
  const totals = parsedData?.totals;

  if (!locationId) {
    return {
      success: false,
      error: "locationId não encontrado na importação",
      code: "NO_LOCATION",
    };
  }

  // ── 1. Criar PO ──────────────────────────────────────────────────
  const poResult = await createPurchaseOrder({
    organizationId: input.organizationId,
    supplierId,
    locationId,
    createdBy: input.actorId,
    paymentTerms: input.paymentTerms,
    freight: totals?.freight,
    discountTotal: totals?.discount,
    items: input.itemMappings.map((m) => ({
      productId: m.productId,
      variantId: m.variantId,
      expectedQuantity: m.quantity,
      unitCost: m.unitCost,
    })),
  });

  if (!poResult.success) {
    return { success: false, error: poResult.error, code: poResult.code };
  }

  // Avançar PO para CONFIRMED via DRAFT→SENT→CONFIRMED
  await sendPurchaseOrder(input.organizationId, poResult.purchaseOrderId, input.actorId);
  await confirmPurchaseOrder(input.organizationId, poResult.purchaseOrderId, input.actorId);

  // ── 2. Criar GoodsReceipt DRAFT ───────────────────────────────────
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poResult.purchaseOrderId },
    include: { items: true },
  });

  const poItemMap = new Map(
    (po?.items ?? []).map((i) => [`${i.productId}|${i.variantId ?? ""} `, i]),
  );

  const receiptResult = await registerReceipt({
    organizationId: input.organizationId,
    purchaseOrderId: poResult.purchaseOrderId,
    receivedBy: input.actorId,
    supplierInvoiceAccessKey: nfeImport.accessKey,
    items: input.itemMappings.map((m) => {
      const key = `${m.productId}|${m.variantId ?? ""} `;
      const poItem = poItemMap.get(key);
      return {
        purchaseOrderItemId: poItem?.id,
        productId: m.productId,
        variantId: m.variantId,
        receivedQuantity: m.quantity,
        unitCost: m.unitCost,
      };
    }),
  });

  if (!receiptResult.success) {
    return { success: false, error: receiptResult.error, code: receiptResult.code };
  }

  // ── 3. Atualizar NfeImport → CONFIRMED ───────────────────────────
  await prisma.nfeImport.update({
    where: { id: input.nfeImportId },
    data: {
      status: "CONFIRMED",
      purchaseOrderId: poResult.purchaseOrderId,
      goodsReceiptId: receiptResult.receiptId,
    },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "nfe_import.confirmed",
    resourceType: "NfeImport",
    resourceId: input.nfeImportId,
    after: {
      purchaseOrderId: poResult.purchaseOrderId,
      receiptId: receiptResult.receiptId,
      itemCount: input.itemMappings.length,
    },
  });

  return {
    success: true,
    purchaseOrderId: poResult.purchaseOrderId,
    receiptId: receiptResult.receiptId,
  };
}
