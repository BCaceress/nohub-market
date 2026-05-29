"use server";

import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";
import { type ImportRow, type ImportRowResult, importRowSchema } from "../schemas";

async function assertMember(userId: string, organizationId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!m || m.role === "viewer") throw new Error("FORBIDDEN");
  return m;
}

/* ── Template import ─────────────────────────────────────────── */

/**
 * Importa N produtos de templates fiscais pré-definidos.
 * Cada template cria um produto com NCM/CFOP/CST já corretos.
 * RN-C12: processa linha a linha, retorna sucesso/erro por item.
 */
export async function importFromFiscalTemplateAction(
  organizationId: string,
  templateIds: string[],
): Promise<Result<{ results: ImportRowResult[] }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  if (templateIds.length === 0) {
    return { success: false, error: "Selecione ao menos um produto do template" };
  }

  const templates = await prisma.fiscalTemplate.findMany({
    where: { id: { in: templateIds } },
  });

  const results: ImportRowResult[] = [];

  for (const [i, tpl] of templates.entries()) {
    try {
      // Check if product with same name already exists
      const existing = await prisma.product.findFirst({
        where: { organizationId, name: tpl.productName, deletedAt: null },
      });

      if (existing) {
        results.push({
          row: i + 1,
          input: { name: tpl.productName },
          success: false,
          error: `Produto "${tpl.productName}" já existe`,
        });
        continue;
      }

      // Create product
      const product = await prisma.product.create({
        data: {
          organizationId,
          name: tpl.productName,
          productType: "SIMPLE",
          unit: "UN",
          saleUnit: "UN",
          conversionFactor: 1,
          price: 0,
          isActive: true,
          active: true,
        },
      });

      // Register barcode if template has one
      if (tpl.barcode) {
        await prisma.productBarcode
          .create({
            data: {
              organizationId,
              productId: product.id,
              barcode: tpl.barcode,
              type: tpl.barcode.length === 8 ? "EAN8" : "EAN13",
            },
          })
          .catch(() => {}); // ignore duplicate barcode
      }

      // Create ProductTax from template
      await prisma.productTax.create({
        data: {
          organizationId,
          productId: product.id,
          ncm: tpl.suggestedNcm,
          cest: tpl.suggestedCest,
          cfopInternal: tpl.defaultCfopInternal,
          cfopInterstate: tpl.defaultCfopInterstate,
          origin: tpl.origin,
          icmsCst: tpl.icmsCst,
          icmsCsosn: tpl.icmsCsosn,
          pisCst: tpl.pisCst,
          cofinsCst: tpl.cofinsCst,
        },
      });

      results.push({
        row: i + 1,
        input: { name: tpl.productName },
        success: true,
        productId: product.id,
      });
    } catch (err) {
      results.push({
        row: i + 1,
        input: { name: tpl.productName },
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "products.import.template",
    resourceType: "Product",
    after: { templateCount: templates.length, successCount },
  });

  revalidatePath("/app/products");
  return { success: true, data: { results } };
}

/* ── CSV/XLSX row import ─────────────────────────────────────── */

/**
 * Importa produtos a partir de linhas já parseadas (do upload de planilha).
 * RN-C12: valida linha a linha; linhas válidas entram mesmo se outras falham.
 */
export async function importProductRowsAction(
  organizationId: string,
  rows: unknown[],
): Promise<Result<{ results: ImportRowResult[] }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };
  try {
    await assertMember(session.user.id, organizationId);
  } catch {
    return { success: false, error: "Sem permissão" };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "Nenhuma linha para importar" };
  }

  if (rows.length > 500) {
    return { success: false, error: "Máximo de 500 produtos por importação" };
  }

  // Pre-load existing SKUs and barcodes to avoid per-row queries
  const existingSkus = new Set(
    (
      await prisma.product.findMany({
        where: { organizationId, deletedAt: null, sku: { not: null } },
        select: { sku: true },
      })
    ).map((p) => p.sku as string),
  );

  const existingBarcodes = new Set(
    (
      await prisma.productBarcode.findMany({
        where: { organizationId },
        select: { barcode: true },
      })
    ).map((b) => b.barcode),
  );

  // Category name → id cache
  const categoryCache = new Map<string, string>();

  async function resolveCategory(name: string): Promise<string> {
    const key = name.toLowerCase().trim();
    if (categoryCache.has(key)) return categoryCache.get(key)!;

    let cat = await prisma.category.findFirst({
      where: { organizationId, name: { equals: name, mode: "insensitive" }, deletedAt: null },
    });
    if (!cat) {
      const slug = `${key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
      cat = await prisma.category.create({
        data: { organizationId, name, slug },
      });
    }
    categoryCache.set(key, cat.id);
    return cat.id;
  }

  const results: ImportRowResult[] = [];

  for (const [i, rawRow] of rows.entries()) {
    const rowNum = i + 1;
    const parsed = importRowSchema.safeParse(rawRow);

    if (!parsed.success) {
      results.push({
        row: rowNum,
        input: rawRow as Record<string, unknown>,
        success: false,
        error: parsed.error.errors[0]?.message ?? "Dados inválidos",
      });
      continue;
    }

    const row: ImportRow = parsed.data;

    // SKU conflict check (in-memory)
    if (row.sku && existingSkus.has(row.sku)) {
      results.push({
        row: rowNum,
        input: rawRow as Record<string, unknown>,
        success: false,
        error: `SKU "${row.sku}" já existe`,
      });
      continue;
    }

    // Barcode conflict check (in-memory)
    if (row.barcode && existingBarcodes.has(row.barcode)) {
      results.push({
        row: rowNum,
        input: rawRow as Record<string, unknown>,
        success: false,
        error: `Código de barras "${row.barcode}" já existe`,
      });
      continue;
    }

    try {
      const categoryId = row.category ? await resolveCategory(row.category) : null;

      const product = await prisma.product.create({
        data: {
          organizationId,
          name: row.name,
          description: row.description || null,
          brand: row.brand || null,
          sku: row.sku || null,
          barcode: row.barcode || null,
          productType: "SIMPLE",
          unit: row.unit,
          saleUnit: row.unit,
          conversionFactor: 1,
          price: row.price ?? 0,
          costPrice: row.costPrice ?? null,
          isActive: true,
          active: true,
          categoryId,
        },
      });

      if (row.barcode) {
        existingBarcodes.add(row.barcode);
        await prisma.productBarcode
          .create({
            data: {
              organizationId,
              productId: product.id,
              barcode: row.barcode,
              type: row.barcode.length === 8 ? "EAN8" : "EAN13",
            },
          })
          .catch(() => {});
      }

      if (row.sku) existingSkus.add(row.sku);

      // Fiscal if NCM provided
      if (row.ncm) {
        await prisma.productTax.create({
          data: {
            organizationId,
            productId: product.id,
            ncm: row.ncm,
            cest: row.cest || null,
            cfopInternal: row.cfopInternal || "5102",
            cfopInterstate: "6102",
            origin: "NACIONAL",
          },
        });
      }

      if (row.price && row.price > 0) {
        await prisma.productPrice.create({
          data: {
            organizationId,
            productId: product.id,
            price: row.price,
            cost: row.costPrice ?? null,
          },
        });
      }

      results.push({
        row: rowNum,
        input: rawRow as Record<string, unknown>,
        success: true,
        productId: product.id,
      });
    } catch (err) {
      results.push({
        row: rowNum,
        input: rawRow as Record<string, unknown>,
        success: false,
        error: err instanceof Error ? err.message : "Erro ao criar produto",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  await writeAudit({
    organizationId,
    actorId: session.user.id,
    action: "products.import.csv",
    resourceType: "Product",
    after: { total: rows.length, successCount, errorCount: rows.length - successCount },
  });

  revalidatePath("/app/products");
  return { success: true, data: { results } };
}
