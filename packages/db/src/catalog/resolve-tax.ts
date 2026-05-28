import type { TaxOrigin } from "@prisma/client";
import { prisma } from "../index";

export interface ResolvedTax {
  ncm: string;
  cest: string | null;
  cfopInternal: string | null;
  cfopInterstate: string | null;
  origin: TaxOrigin;

  // ICMS — apenas um preenchido dependendo do regime (RN-C06)
  icmsCst: string | null;
  icmsCsosn: string | null;
  icmsRate: string | null; // Decimal serializado como string

  // PIS / COFINS
  pisCst: string | null;
  pisRate: string | null;
  cofinsCst: string | null;
  cofinsRate: string | null;

  // IPI
  ipiCst: string | null;
  ipiRate: string | null;

  unitTaxable: boolean;
  source: "product" | "category_default";
}

export type TaxResult =
  | { success: true; data: ResolvedTax }
  | { success: false; error: "TAX_NOT_CONFIGURED" };

export interface ResolveTaxInput {
  productId: string;
  variantId?: string | null;
  organizationId: string;
}

/**
 * Resolve dados fiscais em cascata (RN-C13):
 * 1. ProductTax do produto/variante
 * 2. CategoryTaxDefault da categoria do produto
 *
 * Decide CST vs CSOSN pelo taxRegime da organização (RN-C06):
 * - SIMPLES_NACIONAL | MEI → retorna icmsCsosn, zera icmsCst
 * - LUCRO_PRESUMIDO | LUCRO_REAL | null → retorna icmsCst, zera icmsCsosn
 */
export async function resolveTax(input: ResolveTaxInput): Promise<TaxResult> {
  const { productId, variantId, organizationId } = input;

  // Load org regime + product category in parallel
  const [org, product] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { taxRegime: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    }),
  ]);

  const isSimples = org?.taxRegime === "SIMPLES_NACIONAL" || org?.taxRegime === "MEI";

  // 1. ProductTax específico
  const productTax = await prisma.productTax.findFirst({
    where: {
      productId,
      variantId: variantId ?? null,
      organizationId,
    },
  });

  if (productTax) {
    return {
      success: true,
      data: sanitizeTax(productTax, isSimples, "product"),
    };
  }

  // 2. CategoryTaxDefault — sobe a árvore de categorias (subcategoria → pai → raiz)
  //    e usa o primeiro default com NCM encontrado (RN-C13).
  let currentCategoryId = product?.categoryId ?? null;
  for (let depth = 0; currentCategoryId && depth < 10; depth++) {
    const category = await prisma.category.findUnique({
      where: { id: currentCategoryId },
      select: { parentId: true, taxDefault: true },
    });
    if (!category) break;

    if (category.taxDefault?.ncm) {
      return {
        success: true,
        data: sanitizeTax(category.taxDefault, isSimples, "category_default"),
      };
    }
    currentCategoryId = category.parentId;
  }

  return { success: false, error: "TAX_NOT_CONFIGURED" };
}

function sanitizeTax(
  row: {
    ncm?: string | null;
    cest?: string | null;
    cfopInternal?: string | null;
    cfopInterstate?: string | null;
    origin: TaxOrigin;
    icmsCst?: string | null;
    icmsCsosn?: string | null;
    icmsRate?: { toString(): string } | null;
    pisCst?: string | null;
    pisRate?: { toString(): string } | null;
    cofinsCst?: string | null;
    cofinsRate?: { toString(): string } | null;
    ipiCst?: string | null;
    ipiRate?: { toString(): string } | null;
    unitTaxable?: boolean;
  },
  isSimples: boolean,
  source: ResolvedTax["source"],
): ResolvedTax {
  return {
    ncm: row.ncm ?? "",
    cest: row.cest ?? null,
    cfopInternal: row.cfopInternal ?? null,
    cfopInterstate: row.cfopInterstate ?? null,
    origin: row.origin,
    // RN-C06: nunca os dois
    icmsCst: isSimples ? null : (row.icmsCst ?? null),
    icmsCsosn: isSimples ? (row.icmsCsosn ?? null) : null,
    icmsRate: row.icmsRate?.toString() ?? null,
    pisCst: row.pisCst ?? null,
    pisRate: row.pisRate?.toString() ?? null,
    cofinsCst: row.cofinsCst ?? null,
    cofinsRate: row.cofinsRate?.toString() ?? null,
    ipiCst: row.ipiCst ?? null,
    ipiRate: row.ipiRate?.toString() ?? null,
    unitTaxable: row.unitTaxable ?? true,
    source,
  };
}
