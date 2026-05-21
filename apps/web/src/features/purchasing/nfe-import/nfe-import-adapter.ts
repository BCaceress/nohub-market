/**
 * NfeImportAdapter — anti-corruption layer para XML de NFe de entrada (RN-P11, RN-P12).
 *
 * Faz parse do XML da NFe de compra (modelo 55) e extrai dados estruturados.
 * Não depende de nenhuma lib XML externa — usa regex/DOMParser (server-side via jsdom
 * ou Node 18+ native XML parsing via DOMParser polyfill).
 *
 * Retorna `ParsedNfe` com dados do fornecedor, itens, totais e chave de acesso.
 */

/* ── Tipos ──────────────────────────────────────────────────────── */

export type NfeSupplier = {
  cnpj: string;
  name: string;
  tradeName?: string;
  ie?: string;
  address?: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
};

export type NfeItem = {
  itemNumber: number;
  productCode: string; // código do produto no fornecedor
  ean?: string;
  description: string;
  ncm?: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  discount?: number;
  ipiAmount?: number;
  icmsAmount?: number;
};

export type ParsedNfe = {
  accessKey: string;
  issueDate: Date;
  model: string; // "55" = NFe, "65" = NFCe
  series: string;
  number: string;
  supplier: NfeSupplier;
  items: NfeItem[];
  totals: {
    products: number;
    discount: number;
    freight: number;
    ipi: number;
    icms: number;
    total: number;
  };
};

export type NfeParseResult =
  | { success: true; nfe: ParsedNfe }
  | { success: false; error: string; code?: string };

/* ── Funções auxiliares de XML ──────────────────────────────────── */

function extractTag(xml: string, tag: string): string | null {
  // Tenta com namespace (nfe:Tag) e sem (Tag)
  const patterns = [
    new RegExp(`<(?:nfe:)?${tag}[^>]*>([^<]*)</(?:nfe:)?${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractBlock(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<(?:nfe:)?${tag}[^>]*>([\\s\\S]*?)</(?:nfe:)?${tag}>`, "i");
  const match = xml.match(pattern);
  return match ? match[0] : null;
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<(?:nfe:)?${tag}[\\s\\S]*?</(?:nfe:)?${tag}>`, "gi");
  return xml.match(pattern) ?? [];
}

function parseDecimal(val: string | null): number {
  if (!val) return 0;
  return Number.parseFloat(val.replace(",", ".")) || 0;
}

/* ── Parser principal ───────────────────────────────────────────── */

export function parseNfeXml(xmlContent: string): NfeParseResult {
  // Extrair chave de acesso (Id da NFe)
  const idMatch = xmlContent.match(/Id="NFe(\d{44})"/i);
  const accessKey = idMatch?.[1] ?? extractTag(xmlContent, "chNFe") ?? "";

  if (!accessKey || accessKey.length !== 44) {
    return {
      success: false,
      error: "Chave de acesso inválida ou não encontrada",
      code: "INVALID_KEY",
    };
  }

  // Dados de identificação (bloco ide)
  const ideBlock = extractBlock(xmlContent, "ide") ?? xmlContent;
  const model = extractTag(ideBlock, "mod") ?? "55";
  const series = extractTag(ideBlock, "serie") ?? "";
  const number = extractTag(ideBlock, "nNF") ?? "";
  const issueDateStr = extractTag(ideBlock, "dhEmi") ?? extractTag(ideBlock, "dEmi") ?? "";
  const issueDate = issueDateStr ? new Date(issueDateStr) : new Date();

  // Dados do emitente (fornecedor)
  const emitBlock = extractBlock(xmlContent, "emit") ?? "";
  const cnpj = extractTag(emitBlock, "CNPJ") ?? "";
  const name = extractTag(emitBlock, "xNome") ?? "";
  const tradeName = extractTag(emitBlock, "xFant") ?? undefined;
  const ie = extractTag(emitBlock, "IE") ?? undefined;

  const enderBlock = extractBlock(emitBlock, "enderEmit") ?? "";
  const address = enderBlock
    ? {
        street: extractTag(enderBlock, "xLgr") ?? undefined,
        number: extractTag(enderBlock, "nro") ?? undefined,
        city: extractTag(enderBlock, "xMun") ?? undefined,
        state: extractTag(enderBlock, "UF") ?? undefined,
        postalCode: extractTag(enderBlock, "CEP") ?? undefined,
      }
    : undefined;

  if (!cnpj || !name) {
    return { success: false, error: "Dados do emitente não encontrados", code: "INVALID_SUPPLIER" };
  }

  // Itens
  const detBlocks = extractAllBlocks(xmlContent, "det");
  if (detBlocks.length === 0) {
    return { success: false, error: "Nenhum item encontrado na NFe", code: "NO_ITEMS" };
  }

  const items: NfeItem[] = detBlocks.map((det, idx) => {
    const prodBlock = extractBlock(det, "prod") ?? det;
    const impostoBlock = extractBlock(det, "imposto") ?? "";
    const ipiBlock = extractBlock(impostoBlock, "IPI") ?? "";
    const icmsBlock = extractBlock(impostoBlock, "ICMS") ?? "";

    const nItemMatch = det.match(/nItem="(\d+)"/);
    const itemNumber = nItemMatch?.[1] ? Number.parseInt(nItemMatch[1], 10) : idx + 1;

    const quantity = parseDecimal(extractTag(prodBlock, "qCom"));
    const unitCost = parseDecimal(extractTag(prodBlock, "vUnCom"));
    const lineTotal = parseDecimal(extractTag(prodBlock, "vProd"));
    const discount = parseDecimal(extractTag(prodBlock, "vDesc"));

    // IPI
    const ipiAmount = parseDecimal(
      extractTag(ipiBlock, "vIPI") ?? extractTag(ipiBlock, "vIPIDevol"),
    );

    // ICMS — tentar vários sub-tags
    const icmsAmount = parseDecimal(
      extractTag(icmsBlock, "vICMS") ?? extractTag(icmsBlock, "vICMSDeson"),
    );

    const ean = extractTag(prodBlock, "cEAN");

    return {
      itemNumber,
      productCode: extractTag(prodBlock, "cProd") ?? "",
      ean: ean && ean !== "SEM GTIN" ? ean : undefined,
      description: extractTag(prodBlock, "xProd") ?? "",
      ncm: extractTag(prodBlock, "NCM") ?? undefined,
      cfop: extractTag(prodBlock, "CFOP") ?? "",
      unit: extractTag(prodBlock, "uCom") ?? "UN",
      quantity,
      unitCost,
      lineTotal,
      discount: discount > 0 ? discount : undefined,
      ipiAmount: ipiAmount > 0 ? ipiAmount : undefined,
      icmsAmount: icmsAmount > 0 ? icmsAmount : undefined,
    };
  });

  // Totais (bloco total/ICMSTot)
  const totalBlock = extractBlock(xmlContent, "total") ?? xmlContent;
  const icmsTot = extractBlock(totalBlock, "ICMSTot") ?? totalBlock;

  const totals = {
    products: parseDecimal(extractTag(icmsTot, "vProd")),
    discount: parseDecimal(extractTag(icmsTot, "vDesc")),
    freight: parseDecimal(extractTag(icmsTot, "vFrete")),
    ipi: parseDecimal(extractTag(icmsTot, "vIPI")),
    icms: parseDecimal(extractTag(icmsTot, "vICMS")),
    total: parseDecimal(extractTag(icmsTot, "vNF")),
  };

  return {
    success: true,
    nfe: {
      accessKey,
      issueDate,
      model,
      series,
      number,
      supplier: { cnpj, name, tradeName, ie, address },
      items,
      totals,
    },
  };
}

/* ── Mapeamento de itens NFe → produtos do sistema ──────────────── */

export type NfeItemMapping = {
  nfeItemNumber: number;
  productId: string;
  variantId?: string | null;
  unitCost: number;
  quantity: number;
};

export type MappingResult = {
  mapped: NfeItemMapping[];
  unmapped: NfeItem[];
};

/**
 * mapNfeItems — tenta mapear itens NFe para produtos do sistema via:
 *   1. EAN (barcode match)
 *   2. código do fornecedor (SupplierProductMapping.supplierSku)
 *   3. Retorna unmapped para resolução manual na UI
 */
export async function mapNfeItems(
  items: NfeItem[],
  supplierId: string,
  organizationId: string,
  prismaClient: Parameters<typeof import("@nohub/db")["prisma"]["$transaction"]>[0] extends (
    tx: infer T,
  ) => unknown
    ? T
    : typeof import("@nohub/db")["prisma"],
): Promise<MappingResult> {
  const mapped: NfeItemMapping[] = [];
  const unmapped: NfeItem[] = [];

  for (const item of items) {
    let productId: string | null = null;
    let variantId: string | null = null;

    // Tentativa 1: EAN via ProductBarcode
    if (item.ean) {
      const byBarcode = await (
        prismaClient as typeof import("@nohub/db")["prisma"]
      ).productBarcode.findFirst({
        where: { barcode: item.ean, product: { organizationId } },
        select: { productId: true, variantId: true },
      });
      if (byBarcode) {
        productId = byBarcode.productId;
        variantId = byBarcode.variantId;
      } else {
        // Legado: barcode direto em Product
        const byProductEan = await (
          prismaClient as typeof import("@nohub/db")["prisma"]
        ).product.findFirst({
          where: { barcode: item.ean, organizationId },
          select: { id: true },
        });
        if (byProductEan) {
          productId = byProductEan.id;
        }
      }
    }

    // Tentativa 2: SupplierProductMapping.supplierProductCode
    if (!productId && item.productCode) {
      const bySupplierCode = await (
        prismaClient as typeof import("@nohub/db")["prisma"]
      ).supplierProductMapping.findFirst({
        where: {
          supplierId,
          supplierProductCode: item.productCode,
          product: { organizationId },
        },
        select: { productId: true, variantId: true },
      });
      if (bySupplierCode) {
        productId = bySupplierCode.productId;
        variantId = bySupplierCode.variantId;
      }
    }

    if (productId) {
      mapped.push({
        nfeItemNumber: item.itemNumber,
        productId,
        variantId,
        unitCost: item.unitCost,
        quantity: item.quantity,
      });
    } else {
      unmapped.push(item);
    }
  }

  return { mapped, unmapped };
}
