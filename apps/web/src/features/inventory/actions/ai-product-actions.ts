"use server";

import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import type { Result } from "@nohub/shared/schemas";

/* ─────────────────────────────────────────────────────────────────────
   Public interface — returned to client
───────────────────────────────────────────────────────────────────── */

export interface OpenFoodFactsProduct {
  name: string;
  brand?: string;
  category?: string; // display name
  categoryId?: string; // matched existing category ID
  description?: string;
  imageUrl?: string;
  weight?: number; // grams
  quantity?: string;
  packaging?: string;
  /** display-only tag names */
  tags?: string[];
  /** IDs of existing org tags to apply */
  suggestedTagIds?: string[];
  /** new tag names+groups to create */
  suggestedNewTags?: { name: string; group: string }[];
  isImported?: boolean;
  barcode: string;
  confidence: "high" | "medium" | "low";
  source: "cosmos_br" | "gemini";
  // unit suggestions
  suggestedUnit?: string; // UN | KG | G | L | ML | CX | PCT | FARDO | DZ | BANDEJA
  suggestedPackUnit?: string; // fardo / caixa unit
  suggestedPackSize?: number; // quantity per pack
  // fiscal
  ncm?: string; // 8 digits
  ncmDescription?: string;
  cest?: string; // 7 digits
  cfopInternal?: string;
  cfopInterstate?: string;
  origin?: string;
  icmsCst?: string;
  icmsCsosn?: string;
  pisCst?: string;
  cofinsCst?: string;
}

/* ─────────────────────────────────────────────────────────────────────
   Internal types
───────────────────────────────────────────────────────────────────── */

interface CosmosGtin {
  gtin: string;
  typePackaging?: string; // UN FD CX PCT BD DZ KG
  quantityPackaging?: number;
  ballast?: number;
  layer?: number;
}

interface CosmosResult {
  name: string;
  barcode: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  ncmCode?: string; // 8 digits
  ncmDescription?: string;
  cestCode?: string; // 7 digits
  weight?: number; // net weight grams
  grossWeight?: number;
  avgPrice?: number;
  gtins: CosmosGtin[];
}

interface ContextCategory {
  id: string;
  name: string;
  parentName?: string;
}

interface ContextTag {
  id: string;
  name: string;
  group: string;
}

interface GeminiFullResult {
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  categoryId?: string;
  quantity?: string;
  packaging?: string;
  isImported?: boolean;
  suggestedTagIds?: string[];
  suggestedNewTags?: { name: string; group: string }[];
  unit?: string;
  packUnit?: string;
  packSize?: number;
  // fiscal
  ncm?: string;
  cest?: string;
  cfopInternal?: string;
  cfopInterstate?: string;
  origin?: string;
  icmsCst?: string;
  icmsCsosn?: string;
  pisCst?: string;
  cofinsCst?: string;
}

const UA = "NoHubMarket/1.0 (https://nohub.com.br; contact@nohub.com.br) Node.js";

/* ─────────────────────────────────────────────────────────────────────
   Cosmos Bluesoft
───────────────────────────────────────────────────────────────────── */

// Map Cosmos packaging type codes to system unit enum
const COSMOS_PKG_MAP: Record<string, string> = {
  UN: "UN",
  FD: "FARDO",
  CX: "CX",
  PCT: "PCT",
  BD: "BANDEJA",
  DZ: "DZ",
  KG: "KG",
  LT: "L",
  ML: "ML",
};

async function fetchFromCosmosBr(barcode: string): Promise<CosmosResult | null> {
  const token = process.env.COSMOS_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${barcode}.json`, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "X-Cosmos-Token": token,
      },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      description?: string;
      gtin?: string | number;
      thumbnail?: string;
      brand?: { name?: string };
      category?: { description?: string };
      // ncm/cest may be an object {code,description} or a flat string
      ncm?: { code?: string; description?: string } | string;
      cest?: { code?: string } | string;
      net_weight?: number | string;
      gross_weight?: number | string;
      avg_price?: number | string;
      gtins?: Array<{
        gtin?: string | number;
        type_packaging?: string;
        quantity_packaging?: number | string;
        ballast?: number | string;
        layer?: number | string;
      }>;
    };

    const name = String(json.description ?? "").trim();
    if (!name) return null;

    // NCM — accept object {code,description} or flat string
    const ncmRaw = typeof json.ncm === "string" ? json.ncm : (json.ncm?.code ?? "");
    const ncmCode = String(ncmRaw).replace(/\D/g, "").slice(0, 8) || undefined;
    const ncmDescription =
      typeof json.ncm === "object"
        ? String(json.ncm?.description ?? "").trim() || undefined
        : undefined;

    // CEST — accept object {code} or flat string; must be 7 digits
    const cestRaw = typeof json.cest === "string" ? json.cest : (json.cest?.code ?? "");
    const cleanCest = String(cestRaw).replace(/\D/g, "");
    const cestCode = cleanCest.length === 7 ? cleanCest : undefined;

    // Packaging variants
    const gtins: CosmosGtin[] = (json.gtins ?? []).map((g) => ({
      gtin: String(g.gtin ?? ""),
      typePackaging:
        (COSMOS_PKG_MAP[String(g.type_packaging ?? "").toUpperCase()] ??
          String(g.type_packaging ?? "")) ||
        undefined,
      quantityPackaging: Number(g.quantity_packaging ?? 0) || undefined,
      ballast: Number(g.ballast ?? 0) || undefined,
      layer: Number(g.layer ?? 0) || undefined,
    }));

    return {
      name,
      barcode: String(json.gtin ?? barcode),
      brand: String(json.brand?.name ?? "").trim() || undefined,
      category: String(json.category?.description ?? "").trim() || undefined,
      imageUrl: String(json.thumbnail ?? "").trim() || undefined,
      ncmCode,
      ncmDescription,
      cestCode,
      weight: Number(json.net_weight ?? 0) || undefined,
      grossWeight: Number(json.gross_weight ?? 0) || undefined,
      avgPrice: Number(json.avg_price ?? 0) || undefined,
      gtins,
    };
  } catch {
    return null;
  }
}

/** Convert CosmosResult → product without Gemini enrichment */
function cosmosToProduct(cosmos: CosmosResult): OpenFoodFactsProduct {
  // Infer base unit from packaging variants
  const unitGtin = cosmos.gtins.find((g) => g.typePackaging === "UN" || g.quantityPackaging === 1);
  const suggestedUnit = unitGtin?.typePackaging === "UN" ? "UN" : undefined;

  // Infer pack option from non-unit GTINs
  const packGtin = cosmos.gtins.find(
    (g) => g.typePackaging && g.typePackaging !== "UN" && (g.quantityPackaging ?? 0) > 1,
  );

  return {
    barcode: cosmos.barcode,
    name: cosmos.name,
    brand: cosmos.brand,
    category: cosmos.category,
    imageUrl: cosmos.imageUrl,
    weight: cosmos.weight,
    ncm: cosmos.ncmCode,
    ncmDescription: cosmos.ncmDescription,
    cest: cosmos.cestCode,
    suggestedUnit,
    suggestedPackUnit: packGtin?.typePackaging,
    suggestedPackSize: packGtin?.quantityPackaging,
    confidence: "high",
    source: "cosmos_br",
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Gemini — full enrichment with Cosmos data + org context
───────────────────────────────────────────────────────────────────── */

async function enrichWithGeminiContext(params: {
  barcode: string;
  cosmosData: CosmosResult;
  categories: ContextCategory[];
  tags: ContextTag[];
  taxRegime?: string | null;
}): Promise<GeminiFullResult | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const { barcode, cosmosData, categories, tags, taxRegime } = params;
  const isSimples = taxRegime === "SIMPLES_NACIONAL" || taxRegime === "MEI" || !taxRegime;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const catList = categories
      .slice(0, 80)
      .map((c) =>
        c.parentName
          ? `{"id":"${c.id}","name":"${c.parentName} > ${c.name}"}`
          : `{"id":"${c.id}","name":"${c.name}"}`,
      )
      .join(",\n");

    const tagList = tags
      .slice(0, 120)
      .map((t) => `{"id":"${t.id}","name":"${t.name}","group":"${t.group}"}`)
      .join(",\n");

    // Packaging variants summary
    const gtinsSummary = cosmosData.gtins.length
      ? cosmosData.gtins
          .map((g) => `  ${g.typePackaging ?? "?"} × ${g.quantityPackaging ?? 1} — EAN ${g.gtin}`)
          .join("\n")
      : "  (sem variantes de embalagem)";

    const prompt = `Você é especialista fiscal e de varejo brasileiro.
Analise os dados do produto abaixo e retorne um JSON completo em PT-BR para cadastro em sistema de varejo.

## Dados do produto (Cosmos Bluesoft — fonte confiável BR)
- EAN: ${barcode}
- Nome bruto: ${cosmosData.name}
- Marca: ${cosmosData.brand ?? "desconhecida"}
- Categoria Cosmos: ${cosmosData.category ?? "não informada"}
- NCM: ${cosmosData.ncmCode ?? "desconhecido"} — ${cosmosData.ncmDescription ?? ""}
- CEST: ${cosmosData.cestCode ?? "não informado"}
- Peso líquido: ${cosmosData.weight ? `${cosmosData.weight}g` : "não informado"}
- Peso bruto: ${cosmosData.grossWeight ? `${cosmosData.grossWeight}g` : "não informado"}
- Preço médio mercado: ${cosmosData.avgPrice ? `R$ ${cosmosData.avgPrice.toFixed(2)}` : "não informado"}

## Variantes de embalagem
${gtinsSummary}

## Categorias disponíveis no sistema
[${catList}]

## Tags disponíveis no sistema
[${tagList}]

## Regime tributário
${isSimples ? "Simples Nacional / MEI → usar CSOSN (3 dígitos), campo icmsCst deve ser null" : "Regime Normal (Lucro Real/Presumido) → usar CST (2 dígitos), campo icmsCsosn deve ser null"}

## Retorne APENAS este JSON válido, sem markdown, sem comentários:
{
  "name": "nome comercial limpo em PT-BR (capitalize, ex: Fanta Laranja 2L, Chiclets Adams Hortelã 36g)",
  "brand": "marca capitalizada (ex: Fanta, Adams)",
  "description": "frase descritiva curta em PT-BR (1 linha, opcional)",
  "quantity": "quantidade com unidade legível (ex: 2 L, 350 ml, 36 g)",
  "packaging": "tipo de embalagem em PT-BR (ex: Garrafa PET, Lata, Caixa, Sachê)",
  "isImported": false,
  "unit": "unidade de estoque: UN | KG | G | L | ML (baseado no tipo de produto — líquidos→L/ML, peso→KG/G, unitário→UN)",
  "packUnit": "unidade da embalagem de compra se houver fardo/caixa: CX | FARDO | PCT | DZ ou null",
  "packSize": número de unidades no fardo/caixa ou null,
  "categoryId": "ID exato da categoria da lista acima que melhor se encaixa, ou null",
  "category": "nome da categoria escolhida ou null",
  "suggestedTagIds": ["IDs de tags existentes relevantes (0–8)"],
  "suggestedNewTags": [{"name":"nome PT-BR","group":"geral|tipo|volume|temperatura|dieta|comercial|operacional"}],
  "ncm": "${cosmosData.ncmCode ?? "NCM de 8 dígitos"}",
  "cest": "${cosmosData.cestCode ?? "7 dígitos ou null"}",
  "cfopInternal": "${isSimples ? "5405" : "5102"} — ajuste se necessário",
  "cfopInterstate": "${isSimples ? "6404" : "6102"} — ajuste se necessário",
  "origin": "NACIONAL ou IMPORTADO_DIRETO ou IMPORTADO_NACIONAL",
  ${
    isSimples
      ? `"icmsCsosn": "CSOSN 3 dígitos (400 para não ST, 500 para ST, 102 para sem tributação Simples)",
  "icmsCst": null,`
      : `"icmsCst": "CST 2 dígitos (00 tributado normal, 40 isento, 60 ST retido)",
  "icmsCsosn": null,`
  }
  "pisCst": "${isSimples ? "07" : "01"}",
  "cofinsCst": "${isSimples ? "07" : "01"}"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = (response.text ?? "").trim();
    if (!text) return null;

    const data = JSON.parse(text) as GeminiFullResult & { unknown?: boolean };
    if (data.unknown || !data.name) return null;

    // Validate categoryId belongs to our list
    const validCatIds = new Set(categories.map((c) => c.id));
    if (data.categoryId && !validCatIds.has(data.categoryId)) {
      data.categoryId = undefined;
    }

    // Validate tagIds belong to our list
    const validTagIds = new Set(tags.map((t) => t.id));
    if (data.suggestedTagIds) {
      data.suggestedTagIds = data.suggestedTagIds.filter((id) => validTagIds.has(id));
    }

    return data;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Gemini — barcode-only last resort (no external data)
───────────────────────────────────────────────────────────────────── */

async function lookupWithGeminiBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é especialista em produtos de varejo brasileiro.
Com base no código EAN ${barcode}, identifique o produto.
Se não conhecer, retorne: {"unknown": true}

Retorne JSON:
{
  "name": "nome comercial em PT-BR",
  "brand": "marca",
  "category": "categoria principal",
  "quantity": "quantidade com unidade",
  "packaging": "embalagem em PT-BR",
  "tags": ["tags relevantes"],
  "isImported": false,
  "description": "frase curta descritiva"
}

Retorne APENAS JSON válido, sem markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = (response.text ?? "").trim();
    if (!text) return null;

    const data = JSON.parse(text) as {
      name?: string;
      brand?: string;
      category?: string;
      quantity?: string;
      packaging?: string;
      tags?: string[];
      isImported?: boolean;
      description?: string;
      unknown?: boolean;
    };
    if (data.unknown || !data.name) return null;

    return {
      barcode,
      name: data.name,
      brand: data.brand || undefined,
      category: data.category || undefined,
      quantity: data.quantity || undefined,
      packaging: data.packaging || undefined,
      tags: data.tags?.length ? data.tags : undefined,
      isImported: data.isImported ?? false,
      description: data.description || undefined,
      confidence: "medium",
      source: "gemini",
    };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Main action
───────────────────────────────────────────────────────────────────── */

export async function lookupProductByBarcodeAction(
  barcode: string,
  organizationId?: string,
): Promise<Result<OpenFoodFactsProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const cleaned = barcode.trim().replace(/\D/g, "");
  if (cleaned.length < 8 || cleaned.length > 14) {
    return { success: false, error: "Código de barras inválido (8–14 dígitos)" };
  }

  const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY;

  // Fetch Cosmos + org context in parallel
  const [cosmosData, orgContext] = await Promise.all([
    fetchFromCosmosBr(cleaned),
    organizationId
      ? Promise.all([
          prisma.category.findMany({
            where: { organizationId, deletedAt: null },
            select: { id: true, name: true, parent: { select: { name: true } } },
            orderBy: [{ position: "asc" }, { name: "asc" }],
          }),
          prisma.tag.findMany({
            where: { organizationId },
            select: { id: true, name: true, group: true },
            orderBy: [{ group: "asc" }, { name: "asc" }],
          }),
          prisma.organization.findUnique({
            where: { id: organizationId },
            select: { taxRegime: true },
          }),
        ])
      : null,
  ]);

  const categories: ContextCategory[] = orgContext
    ? orgContext[0].map((c) => ({ id: c.id, name: c.name, parentName: c.parent?.name }))
    : [];
  const tags: ContextTag[] = orgContext ? orgContext[1] : [];
  const taxRegime = orgContext ? (orgContext[2]?.taxRegime ?? null) : null;

  // ── Path 1: Cosmos + Gemini full context ─────────────────────
  if (cosmosData && hasGemini) {
    const geminiResult = await enrichWithGeminiContext({
      barcode: cleaned,
      cosmosData,
      categories,
      tags,
      taxRegime,
    });

    if (geminiResult?.name) {
      const existingTagNames = (geminiResult.suggestedTagIds ?? [])
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[];
      const newTagNames = (geminiResult.suggestedNewTags ?? []).map((t) => t.name);
      const allTagNames = [...existingTagNames, ...newTagNames];

      return {
        success: true,
        data: {
          barcode: cleaned,
          name: geminiResult.name,
          brand: geminiResult.brand || cosmosData.brand,
          category: geminiResult.category || cosmosData.category,
          categoryId: geminiResult.categoryId || undefined,
          description: geminiResult.description || undefined,
          quantity: geminiResult.quantity || undefined,
          packaging: geminiResult.packaging || undefined,
          isImported: geminiResult.isImported ?? false,
          imageUrl: cosmosData.imageUrl,
          weight: cosmosData.weight,
          tags: allTagNames.length ? allTagNames : undefined,
          suggestedTagIds: geminiResult.suggestedTagIds?.length
            ? geminiResult.suggestedTagIds
            : undefined,
          suggestedNewTags: geminiResult.suggestedNewTags?.length
            ? geminiResult.suggestedNewTags
            : undefined,
          suggestedUnit: geminiResult.unit || undefined,
          suggestedPackUnit: geminiResult.packUnit || undefined,
          suggestedPackSize: geminiResult.packSize || undefined,
          confidence: "high",
          source: "gemini",
          // fiscal — Gemini confirms/corrects Cosmos values
          ncm: geminiResult.ncm ?? cosmosData.ncmCode,
          ncmDescription: cosmosData.ncmDescription,
          cest: geminiResult.cest ?? cosmosData.cestCode,
          cfopInternal: geminiResult.cfopInternal || undefined,
          cfopInterstate: geminiResult.cfopInterstate || undefined,
          origin: geminiResult.origin || undefined,
          icmsCst: geminiResult.icmsCst || undefined,
          icmsCsosn: geminiResult.icmsCsosn || undefined,
          pisCst: geminiResult.pisCst || undefined,
          cofinsCst: geminiResult.cofinsCst || undefined,
        },
      };
    }
  }

  // ── Path 2: Cosmos only (no Gemini / Gemini failed) ──────────
  if (cosmosData) {
    return { success: true, data: cosmosToProduct(cosmosData) };
  }

  // ── Path 3: Gemini barcode-only (no Cosmos token or not found) ─
  if (hasGemini) {
    const geminiOnly = await lookupWithGeminiBarcode(cleaned);
    if (geminiOnly) return { success: true, data: geminiOnly };
  }

  return {
    success: false,
    error: "Produto não encontrado. Verifique o token COSMOS_API_TOKEN ou preencha manualmente.",
  };
}
