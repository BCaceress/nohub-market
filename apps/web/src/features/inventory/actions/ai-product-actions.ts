"use server";

import { getSession } from "@/lib/auth-server";
import type { Result } from "@nohub/shared/schemas";

export interface OpenFoodFactsProduct {
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  weight?: number;
  quantity?: string;
  packaging?: string;
  tags?: string[];
  isImported?: boolean;
  nutriscoreGrade?: "a" | "b" | "c" | "d" | "e";
  barcode: string;
  confidence: "high" | "medium" | "low";
  source: "open_food_facts" | "cosmos_br" | "gemini";
}

const OFF_UA = "NoHubMarket/1.0 (https://nohub.com.br; contact@nohub.com.br) Node.js";

/* ── EAN Pictures ───────────────────────────────────────────── */

async function fetchEanPictureUrl(barcode: string): Promise<string | null> {
  try {
    const res = await fetch(`http://www.eanpictures.com.br:9000/api/gtin/${barcode}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || ct.includes("text/json")) {
      const json = (await res.json()) as Record<string, unknown>;
      const url =
        json.url ?? json.image_url ?? json.image ?? json.thumbnail ?? json.picture ?? json.foto;
      if (typeof url === "string" && url.startsWith("http")) return url;
      return null;
    }
    if (ct.startsWith("image/")) {
      return `http://www.eanpictures.com.br:9000/api/gtin/${barcode}`;
    }
    return null;
  } catch {
    return null;
  }
}

/* ── Raw OFF fetch ──────────────────────────────────────────── */

const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_pt",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "image_front_url",
  "image_url",
  "packaging",
  "categories",
  "categories_tags",
  "_keywords",
  "nutrient_levels",
  "countries",
  "countries_tags",
  "nutriscore_grade",
  "ingredients_text_pt",
  "ingredients_text",
].join(",");

async function fetchRawFromOFF(barcode: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${OFF_FIELDS}`,
      { headers: { "User-Agent": OFF_UA }, next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { status: number; product?: Record<string, unknown> };
    if (json.status !== 1 || !json.product) return null;
    return json.product;
  } catch {
    return null;
  }
}

/* ── Gemini enrichment ──────────────────────────────────────── */

interface GeminiExtracted {
  name: string;
  brand?: string;
  category?: string;
  quantity?: string;
  packaging?: string;
  tags?: string[];
  isImported?: boolean;
  nutriscoreGrade?: string;
  description?: string;
}

async function enrichWithGemini(
  rawProduct: Record<string, unknown>,
  barcode: string,
): Promise<OpenFoodFactsProduct | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um extrator de dados de produtos para um sistema de varejo brasileiro.
Analise os dados brutos do OpenFoodFacts abaixo e retorne um JSON limpo em português brasileiro.

Regras:
- "name": nome comercial em PT-BR (traduza se necessário, formato limpo sem código ou barcode)
- "brand": nome da marca (mantenha original)
- "category": categoria principal em PT-BR (ex: "Refrigerante", "Biscoito", "Leite integral")
- "quantity": quantidade com unidade (ex: "350 ml", "1 kg", "6 unidades")
- "packaging": embalagem em PT-BR (ex: "Lata", "Garrafa PET", "Caixa", "Sachê", "Tetra Pak")
- "tags": array de 3 a 8 tags relevantes em PT-BR (ex: ["Sem glúten", "Light", "Carbonatado"])
  Inclua também os níveis nutricionais traduzidos (Gordura baixa, Açúcar alto, etc.)
- "isImported": true se NÃO for produto brasileiro, false se for
- "nutriscoreGrade": "a", "b", "c", "d" ou "e" (só se houver dado confiável, senão null)
- "description": frase curta descritiva do produto em PT-BR (opcional)

Dados brutos (código ${barcode}):
${JSON.stringify(rawProduct, null, 2).slice(0, 6000)}

Retorne APENAS JSON válido, sem markdown, sem explicação.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text ?? "";
    const data = JSON.parse(text) as GeminiExtracted;

    if (!data.name) return null;

    const grade = (data.nutriscoreGrade ?? "").toLowerCase();
    const nutriscoreGrade =
      grade === "a" || grade === "b" || grade === "c" || grade === "d" || grade === "e"
        ? (grade as "a" | "b" | "c" | "d" | "e")
        : undefined;

    const imageUrl = String(
      (rawProduct.image_front_url as string | undefined) ??
        (rawProduct.image_url as string | undefined) ??
        "",
    ).trim();

    return {
      barcode,
      name: data.name,
      brand: data.brand || undefined,
      category: data.category || undefined,
      quantity: data.quantity || undefined,
      packaging: data.packaging || undefined,
      tags: data.tags?.length ? data.tags : undefined,
      isImported: data.isImported ?? false,
      nutriscoreGrade,
      description: data.description || undefined,
      imageUrl: imageUrl || undefined,
      confidence: "high",
      source: "gemini",
    };
  } catch {
    return null;
  }
}

/* ── Manual OFF parse (fallback sem Gemini) ─────────────────── */

const NUTRIENT_PT: Record<string, Record<string, string>> = {
  fat: { low: "Gordura baixa", moderate: "Gordura moderada", high: "Gordura alta" },
  saturated_fat: { low: "G.sat. baixa", moderate: "G.sat. moderada", high: "G.sat. alta" },
  sugars: { low: "Açúcar baixo", moderate: "Açúcar moderado", high: "Açúcar alto" },
  salt: { low: "Sal baixo", moderate: "Sal moderado", high: "Sal alto" },
};

const KW_BLOCK = new Set([
  "de",
  "a",
  "o",
  "e",
  "em",
  "com",
  "sem",
  "por",
  "porcaria",
  "junk",
  "lixo",
  "horrivel",
  "base",
  "planta",
  "alimento",
  "liquida",
  "liquido",
  "produto",
  "food",
  "item",
]);

function parseOffManual(p: Record<string, unknown>, barcode: string): OpenFoodFactsProduct | null {
  const name = String(p.product_name_pt ?? p.product_name ?? "").trim();
  if (!name) return null;

  const brand =
    String(p.brands ?? "")
      .split(",")[0]
      ?.trim() ?? "";
  const quantity = String(p.quantity ?? "").trim() || undefined;
  const packaging = String(p.packaging ?? "").trim() || undefined;

  let weight: number | undefined;
  if (p.product_quantity !== undefined && p.product_quantity_unit) {
    const qty = Number(p.product_quantity);
    const unit = String(p.product_quantity_unit).toLowerCase();
    if (!Number.isNaN(qty)) weight = unit === "kg" || unit === "l" ? qty * 1000 : qty;
  } else {
    const m = quantity?.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)/i);
    if (m) {
      const num = Number.parseFloat((m[1] ?? "").replace(",", "."));
      const unit = (m[2] ?? "").toLowerCase();
      weight = unit === "kg" || unit === "l" ? num * 1000 : num;
    }
  }

  let category = "";
  const cats = String(p.categories ?? "");
  if (cats) {
    const parts = cats
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const clean = parts.filter((s) => !/porcaria|junk|lixo/i.test(s));
    category = (clean.at(-1) ?? parts.at(-1) ?? "").trim();
  }

  const tags: string[] = [];
  const nutrientLevels = p.nutrient_levels as Record<string, string> | undefined;
  for (const [n, l] of Object.entries(nutrientLevels ?? {})) {
    const label = NUTRIENT_PT[n]?.[l];
    if (label) tags.push(label);
  }
  const kwTags = ((p._keywords as string[] | undefined) ?? [])
    .map((k) => k.toLowerCase().trim())
    .filter(
      (k) => k.length > 3 && !KW_BLOCK.has(k) && !/^\d+$/.test(k) && !/porcaria|lixo|junk/i.test(k),
    )
    .slice(0, 6);
  tags.push(...kwTags);

  const countriesTags = (p.countries_tags as string[] | undefined) ?? [];
  const countries = String(p.countries ?? "").toLowerCase();
  const isImported =
    countriesTags.length > 0 &&
    !countriesTags.includes("en:brazil") &&
    !countries.includes("brazil") &&
    !countries.includes("brasil");

  const grade = String(p.nutriscore_grade ?? "").toLowerCase();
  const nutriscoreGrade =
    grade === "a" || grade === "b" || grade === "c" || grade === "d" || grade === "e"
      ? (grade as "a" | "b" | "c" | "d" | "e")
      : undefined;

  const imageUrl = String(p.image_front_url ?? p.image_url ?? "").trim();
  const filled = [name, brand, imageUrl].filter(Boolean).length;

  return {
    barcode,
    name,
    brand: brand || undefined,
    category: category || undefined,
    quantity,
    weight,
    packaging,
    tags: tags.length ? tags : undefined,
    isImported,
    nutriscoreGrade,
    imageUrl: imageUrl || undefined,
    confidence: filled >= 3 ? "high" : filled >= 2 ? "medium" : "low",
    source: "open_food_facts",
  };
}

/* ── Cosmos Bluesoft ─────────────────────────────────────────── */

async function fetchFromCosmosBr(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const token = process.env.COSMOS_API_TOKEN;
    const headers: Record<string, string> = { "User-Agent": OFF_UA, Accept: "application/json" };
    if (token) headers["X-Cosmos-Token"] = token;

    const res = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${barcode}.json`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      description?: string;
      brand?: { name?: string };
      category?: { description?: string };
      thumbnail?: string;
    };

    const name = (json.description ?? "").trim();
    if (!name) return null;

    return {
      barcode,
      name,
      brand: json.brand?.name?.trim() || undefined,
      category: json.category?.description?.trim() || undefined,
      imageUrl: (json.thumbnail ?? "").trim() || undefined,
      confidence: "high",
      source: "cosmos_br",
    };
  } catch {
    return null;
  }
}

/* ── Main action ─────────────────────────────────────────────── */

export async function lookupProductByBarcodeAction(
  barcode: string,
): Promise<Result<OpenFoodFactsProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const cleaned = barcode.trim().replace(/\D/g, "");
  if (cleaned.length < 8 || cleaned.length > 14) {
    return { success: false, error: "Código de barras inválido (8–14 dígitos)" };
  }

  const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY;

  // Busca dados brutos OFF + imagem EAN em paralelo (sempre)
  const [rawOff, eanImageUrl] = await Promise.all([
    fetchRawFromOFF(cleaned),
    fetchEanPictureUrl(cleaned),
  ]);

  // Se tem Gemini: usa IA para enriquecer os dados do OFF
  if (rawOff && hasGemini) {
    const geminiResult = await enrichWithGemini(rawOff, cleaned);
    if (geminiResult) {
      return {
        success: true,
        data: { ...geminiResult, imageUrl: eanImageUrl ?? geminiResult.imageUrl },
      };
    }
  }

  // Cosmos BR (mais completo para BR sem Gemini)
  const cosmos = await fetchFromCosmosBr(cleaned);
  if (cosmos) {
    return {
      success: true,
      data: { ...cosmos, imageUrl: eanImageUrl ?? cosmos.imageUrl },
    };
  }

  // Parse manual do OFF
  if (rawOff) {
    const manual = parseOffManual(rawOff, cleaned);
    if (manual) {
      return {
        success: true,
        data: { ...manual, imageUrl: eanImageUrl ?? manual.imageUrl },
      };
    }
  }

  return {
    success: false,
    error: "Produto não encontrado nas bases consultadas. Preencha os dados manualmente.",
  };
}
