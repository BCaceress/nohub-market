"use server";

import { getSession } from "@/lib/auth-server";
import type { Result } from "@nohub/shared/schemas";

export interface OpenFoodFactsProduct {
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  weight?: number; // ml ou g (valor numérico)
  quantity?: string; // "350ml", "1,5 l"
  packaging?: string; // "Lata", "Garrafa PET"
  tags?: string[]; // keywords + nutrient_levels traduzidos
  isImported?: boolean; // countries != Brazil
  nutriscoreGrade?: "a" | "b" | "c" | "d" | "e";
  barcode: string;
  confidence: "high" | "medium" | "low";
  source: "open_food_facts" | "cosmos_br";
}

/* ── Constants ──────────────────────────────────────────────── */

const OFF_UA = "NoHubMarket/1.0 (https://nohub.com.br; contact@nohub.com.br) Node.js";

const NUTRIENT_PT: Record<string, Record<string, string>> = {
  fat: { low: "Gordura baixa", moderate: "Gordura moderada", high: "Gordura alta" },
  saturated_fat: { low: "G.sat. baixa", moderate: "G.sat. moderada", high: "G.sat. alta" },
  sugars: { low: "Açúcar baixo", moderate: "Açúcar moderado", high: "Açúcar alto" },
  salt: { low: "Sal baixo", moderate: "Sal moderado", high: "Sal alto" },
};

const KEYWORD_BLOCKLIST = new Set([
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

/* ── EAN Pictures (imagem primária) ─────────────────────────── */

async function fetchEanPictureUrl(barcode: string): Promise<string | null> {
  try {
    const res = await fetch(`http://www.eanpictures.com.br:9000/api/gtin/${barcode}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") ?? "";

    // Se retornou JSON, procura campo de URL
    if (ct.includes("application/json") || ct.includes("text/json")) {
      const json = (await res.json()) as Record<string, unknown>;
      const url =
        json.url ?? json.image_url ?? json.image ?? json.thumbnail ?? json.picture ?? json.foto;
      if (typeof url === "string" && url.startsWith("http")) return url;
      return null;
    }

    // Se retornou imagem diretamente — usa a URL da request como imageUrl
    if (ct.startsWith("image/")) {
      return `http://www.eanpictures.com.br:9000/api/gtin/${barcode}`;
    }

    return null;
  } catch {
    return null;
  }
}

/* ── Open Food Facts ─────────────────────────────────────────── */

async function fetchFromOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const fields = [
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
    ].join(",");

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`,
      {
        headers: { "User-Agent": OFF_UA },
        next: { revalidate: 3600 },
      },
    );

    if (!res.ok) return null;

    const json = (await res.json()) as {
      status: number;
      product?: {
        code?: string;
        product_name?: string;
        product_name_pt?: string;
        brands?: string;
        quantity?: string;
        product_quantity?: number | string;
        product_quantity_unit?: string;
        image_front_url?: string;
        image_url?: string;
        packaging?: string;
        categories?: string;
        categories_tags?: string[];
        _keywords?: string[];
        nutrient_levels?: Record<string, string>;
        countries?: string;
        countries_tags?: string[];
        nutriscore_grade?: string;
      };
    };

    if (json.status !== 1 || !json.product) return null;
    const p = json.product;

    /* Nome */
    const name = (p.product_name_pt ?? p.product_name ?? "").trim();
    if (!name) return null;

    /* Marca */
    const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";

    /* Quantidade string */
    const quantity = p.quantity?.trim() || undefined;

    /* Peso numérico */
    let weight: number | undefined;
    if (p.product_quantity !== undefined && p.product_quantity_unit) {
      const qty = Number(p.product_quantity);
      const unit = p.product_quantity_unit.toLowerCase();
      if (!Number.isNaN(qty)) {
        weight = unit === "kg" || unit === "l" ? qty * 1000 : qty;
      }
    } else {
      const m = (p.quantity ?? "").match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)/i);
      if (m) {
        const num = Number.parseFloat((m[1] ?? "").replace(",", "."));
        const unit = (m[2] ?? "").toLowerCase();
        weight = unit === "kg" || unit === "l" ? num * 1000 : num;
      }
    }

    /* Embalagem */
    const packaging = p.packaging?.trim() || undefined;

    /* Categoria (texto mais específico) */
    let category = "";
    if (p.categories) {
      const parts = p.categories
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const clean = parts.filter((s) => !/porcaria|junk|lixo/i.test(s));
      category = (clean.at(-1) ?? parts.at(-1) ?? "").trim();
    } else if (p.categories_tags?.length) {
      const ptTag = p.categories_tags.find((t) => t.startsWith("pt:"));
      const raw = ptTag ?? p.categories_tags.at(-1) ?? "";
      category = raw.replace(/^[a-z]{2}:/i, "").replace(/-/g, " ");
    }

    /* Tags: keywords + nutrient_levels */
    const tags: string[] = [];

    // Nutrient levels (traduzidos)
    for (const [nutrient, level] of Object.entries(p.nutrient_levels ?? {})) {
      const label = NUTRIENT_PT[nutrient]?.[level];
      if (label) tags.push(label);
    }

    // Keywords filtradas
    const kwTags = (p._keywords ?? [])
      .map((k) => k.toLowerCase().trim())
      .filter(
        (k) =>
          k.length > 3 &&
          !KEYWORD_BLOCKLIST.has(k) &&
          !/^\d+$/.test(k) && // skip pure numbers
          !/porcaria|lixo|junk/i.test(k),
      )
      .slice(0, 6);
    tags.push(...kwTags);

    /* Importado? */
    const countriesTags = p.countries_tags ?? [];
    const countries = (p.countries ?? "").toLowerCase();
    const isImported =
      countriesTags.length > 0 &&
      !countriesTags.includes("en:brazil") &&
      !countries.includes("brazil") &&
      !countries.includes("brasil");

    /* Nutriscore */
    const grade = p.nutriscore_grade?.toLowerCase();
    const nutriscoreGrade =
      grade === "a" || grade === "b" || grade === "c" || grade === "d" || grade === "e"
        ? (grade as "a" | "b" | "c" | "d" | "e")
        : undefined;

    /* Imagem (OFF, EAN Pictures resolve depois) */
    const imageUrl = (p.image_front_url ?? p.image_url ?? "").trim();

    const filled = [name, brand, imageUrl].filter(Boolean).length;
    const confidence: "high" | "medium" | "low" =
      filled >= 3 ? "high" : filled >= 2 ? "medium" : "low";

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
      confidence,
      source: "open_food_facts",
    };
  } catch {
    return null;
  }
}

/* ── Cosmos Bluesoft ─────────────────────────────────────────── */

async function fetchFromCosmosBr(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const token = process.env.COSMOS_API_TOKEN;
    const headers: Record<string, string> = {
      "User-Agent": OFF_UA,
      Accept: "application/json",
    };
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
      avg_price?: number;
    };

    const name = (json.description ?? "").trim();
    if (!name) return null;

    const brand = json.brand?.name?.trim() ?? "";
    const category = json.category?.description?.trim() ?? "";
    const imageUrl = (json.thumbnail ?? "").trim();

    return {
      barcode,
      name,
      brand: brand || undefined,
      category: category || undefined,
      imageUrl: imageUrl || undefined,
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

  // Busca produto + imagem EAN em paralelo
  const [cosmos, eanImageUrl] = await Promise.all([
    fetchFromCosmosBr(cleaned),
    fetchEanPictureUrl(cleaned),
  ]);

  if (cosmos) {
    return {
      success: true,
      data: { ...cosmos, imageUrl: eanImageUrl ?? cosmos.imageUrl },
    };
  }

  // Fallback OFF (já inclui imagem própria)
  const off = await fetchFromOpenFoodFacts(cleaned);
  if (off) {
    return {
      success: true,
      data: { ...off, imageUrl: eanImageUrl ?? off.imageUrl },
    };
  }

  return {
    success: false,
    error:
      "Produto não encontrado nas bases consultadas (Open Food Facts e Cosmos BR). " +
      "Preencha os dados manualmente.",
  };
}
