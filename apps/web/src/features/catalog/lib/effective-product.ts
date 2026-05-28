import { prisma } from "@nohub/db";

/**
 * Resolução de herança "cadastro em duas velocidades".
 *
 * Cada campo herdável da subcategoria (Category filha) é resolvido para um
 * valor efetivo:
 *   - operacional (temperatura, validade, lote): produto.x ?? subcategoria.x
 *     (sobe a árvore de categorias até encontrar valor)
 *   - idade (+18): OR — categoria escala, produto nunca relaxa
 *   - fiscal (ncm/cest/cfop/cst/csosn/alíquotas): ProductTax.x ?? CategoryTaxDefault.x
 *
 * `getProdutoEfetivo(productId, organizationId)` retorna o produto cru + um
 * objeto `effective` com os valores resolvidos e a fonte de cada bloco.
 */

type FiscalEffective = {
  ncm: string | null;
  cest: string | null;
  cfopInternal: string | null;
  cfopInterstate: string | null;
  origin: string | null;
  icmsCst: string | null;
  icmsCsosn: string | null;
  icmsRate: string | null;
  pisCst: string | null;
  pisRate: string | null;
  cofinsCst: string | null;
  cofinsRate: string | null;
  ipiCst: string | null;
  ipiRate: string | null;
  /** "product" = sobrescrito no produto; "category" = herdado; "none" */
  source: "product" | "category" | "none";
};

type OperationalEffective = {
  hasAgeRestriction: boolean;
  storageTemperature: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
  controlsExpiry: boolean;
  controlsLot: boolean;
};

const dec = (v: { toString(): string } | null | undefined): string | null =>
  v == null ? null : v.toString();

/** Sobe a árvore de categorias a partir de `categoryId`, retornando a cadeia raiz→folha invertida (folha primeiro). */
async function loadCategoryChain(categoryId: string | null, organizationId: string) {
  const chain: Array<{
    id: string;
    parentId: string | null;
    hasAgeRestriction: boolean;
    storageTemperature: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
    controlsExpiry: boolean;
    controlsLot: boolean;
    taxDefault: Record<string, unknown> | null;
  }> = [];

  let currentId = categoryId;
  // Limite defensivo contra ciclos
  for (let depth = 0; currentId && depth < 10; depth++) {
    const cat = await prisma.category.findFirst({
      where: { id: currentId, organizationId, deletedAt: null },
      select: {
        id: true,
        parentId: true,
        hasAgeRestriction: true,
        storageTemperature: true,
        controlsExpiry: true,
        controlsLot: true,
        taxDefault: true,
      },
    });
    if (!cat) break;
    chain.push(cat as (typeof chain)[number]);
    currentId = cat.parentId;
  }
  return chain;
}

export async function getProdutoEfetivo(productId: string, organizationId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    include: { taxData: true, category: { select: { id: true, name: true } } },
  });
  if (!product) return null;

  const chain = await loadCategoryChain(product.categoryId, organizationId);

  // ── Operacional ──────────────────────────────────────────────
  const firstDefined = <T>(getter: (c: (typeof chain)[number]) => T | null | undefined) => {
    for (const c of chain) {
      const v = getter(c);
      if (v != null) return v;
    }
    return null;
  };

  const operational: OperationalEffective = {
    hasAgeRestriction: product.hasAgeRestriction || chain.some((c) => c.hasAgeRestriction),
    storageTemperature: product.storageTemperature ?? firstDefined((c) => c.storageTemperature),
    controlsExpiry: product.controlsExpiry ?? firstDefined((c) => c.controlsExpiry) ?? false,
    controlsLot: product.controlsLot ?? firstDefined((c) => c.controlsLot) ?? false,
  };

  // ── Fiscal ───────────────────────────────────────────────────
  const own = (product.taxData[0] ?? null) as Record<string, unknown> | null;
  // CategoryTaxDefault mais próximo na cadeia (folha → raiz)
  const catTax = (chain.find((c) => c.taxDefault)?.taxDefault ?? null) as Record<
    string,
    unknown
  > | null;

  const pick = (key: string): string | null => {
    const o = own ? own[key] : null;
    if (o != null && o !== "") return dec(o as { toString(): string });
    const c = catTax ? catTax[key] : null;
    return c != null ? dec(c as { toString(): string }) : null;
  };

  const fiscal: FiscalEffective = {
    ncm: pick("ncm"),
    cest: pick("cest"),
    cfopInternal: pick("cfopInternal"),
    cfopInterstate: pick("cfopInterstate"),
    origin: pick("origin"),
    icmsCst: pick("icmsCst"),
    icmsCsosn: pick("icmsCsosn"),
    icmsRate: pick("icmsRate"),
    pisCst: pick("pisCst"),
    pisRate: pick("pisRate"),
    cofinsCst: pick("cofinsCst"),
    cofinsRate: pick("cofinsRate"),
    ipiCst: pick("ipiCst"),
    ipiRate: pick("ipiRate"),
    source: own ? "product" : catTax ? "category" : "none",
  };

  return { product, effective: { operational, fiscal } };
}

export type ProdutoEfetivo = NonNullable<Awaited<ReturnType<typeof getProdutoEfetivo>>>;
