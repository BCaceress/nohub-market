"use server";

import { getSession } from "@/lib/auth-server";
import type { Result } from "@nohub/shared/schemas";

export interface OpenFoodFactsProduct {
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  weight?: number; // grams
  barcode: string;
  confidence: "high" | "medium" | "low";
  source: "open_food_facts" | "cosmos_br";
}

/* ── Helpers ────────────────────────────────────────────────── */

const OFF_UA = "NoHubMarket/1.0 (https://nohub.com.br; contact@nohub.com.br) Node.js";

/** Tenta buscar no Open Food Facts (global). */
async function fetchFromOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const fields = [
      "product_name",
      "product_name_pt",
      "brands",
      "categories",
      "categories_tags",
      "image_front_url",
      "image_url",
      "product_quantity",
      "product_quantity_unit",
      "quantity",
      "nutriscore_grade",
      "packaging",
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
        product_name?: string;
        product_name_pt?: string;
        brands?: string;
        categories?: string; // "Bebidas, Refrigerantes, ..."  (texto legível)
        categories_tags?: string[]; // ["en:beverages", "pt:porcarias-liquidas"]
        image_front_url?: string;
        image_url?: string;
        product_quantity?: number | string; // pode ser número (350) ou string
        product_quantity_unit?: string; // "ml", "g", "l", "kg"
        quantity?: string; // "350ml" (fallback)
        nutriscore_grade?: string;
        packaging?: string;
      };
    };

    if (json.status !== 1 || !json.product) return null;

    const p = json.product;

    // Nome: preferir versão PT
    const name = (p.product_name_pt ?? p.product_name ?? "").trim();
    if (!name) return null;

    // Marca: primeira da lista separada por vírgula
    const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";

    // Categoria: usar campo texto legível (categories) → pegar última (mais específica)
    // Ex: "Bebidas, Refrigerantes, Porcarias líquidas" → "Porcarias líquidas"
    // Filtrar junk ("Porcarias", etc.) se necessário — usar a penúltima como fallback
    let category = "";
    if (p.categories) {
      const parts = p.categories
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      // Pegar a mais específica que não contenha "porcaria" ou "lixo"
      const clean = parts.filter((s) => !/porcaria|junk|lixo/i.test(s));
      category = (clean.at(-1) ?? parts.at(-1) ?? "").trim();
    } else if (p.categories_tags?.length) {
      // Fallback: usar tags PT preferencialmente, senão última EN sem prefixo
      const ptTag = p.categories_tags.find((t) => t.startsWith("pt:"));
      const lastTag = p.categories_tags.at(-1) ?? "";
      const raw = ptTag ?? lastTag;
      category = raw.replace(/^[a-z]{2}:/i, "").replace(/-/g, " ");
    }

    // Imagem
    const imageUrl = (p.image_front_url ?? p.image_url ?? "").trim();

    // Peso/volume → converter tudo para gramas ou ml (valor numérico)
    let weight: number | undefined;

    if (p.product_quantity !== undefined && p.product_quantity_unit) {
      const qty = Number(p.product_quantity);
      const unit = p.product_quantity_unit.toLowerCase();
      if (!Number.isNaN(qty)) {
        if (unit === "g" || unit === "ml") weight = qty;
        else if (unit === "kg" || unit === "l") weight = qty * 1000;
      }
    } else {
      // Fallback: parse string "350ml", "1,5l", "500 g"
      const qtyStr = String(p.product_quantity ?? p.quantity ?? "");
      const m = qtyStr.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)/i);
      if (m) {
        const num = Number.parseFloat((m[1] ?? "").replace(",", "."));
        const unit = (m[2] ?? "").toLowerCase();
        if (unit === "g" || unit === "ml") weight = num;
        else if (unit === "kg" || unit === "l") weight = num * 1000;
      }
    }

    const filled = [name, brand, imageUrl].filter(Boolean).length;
    const confidence: "high" | "medium" | "low" =
      filled >= 3 ? "high" : filled >= 2 ? "medium" : "low";

    return {
      barcode,
      name,
      brand: brand || undefined,
      category: category || undefined,
      imageUrl: imageUrl || undefined,
      weight,
      confidence,
      source: "open_food_facts",
    };
  } catch {
    return null;
  }
}

/**
 * Tenta buscar no Cosmos Bluesoft (base brasileira).
 * Requer chave de API em COSMOS_API_TOKEN (opcional — funciona sem ela em modo público).
 */
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
      gtins?: Array<{ commercial_unit?: { type_packaging?: string; quantity?: number } }>;
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

/* ── Main action ────────────────────────────────────────────── */

export async function lookupProductByBarcodeAction(
  barcode: string,
): Promise<Result<OpenFoodFactsProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const cleaned = barcode.trim().replace(/\D/g, "");
  if (cleaned.length < 8 || cleaned.length > 14) {
    return { success: false, error: "Código de barras inválido (8–14 dígitos)" };
  }

  // Tenta Cosmos BR primeiro (mais completo para produtos brasileiros)
  const cosmos = await fetchFromCosmosBr(cleaned);
  if (cosmos) return { success: true, data: cosmos };

  // Fallback para Open Food Facts
  const off = await fetchFromOpenFoodFacts(cleaned);
  if (off) return { success: true, data: off };

  return {
    success: false,
    error:
      "Produto não encontrado nas bases consultadas (Open Food Facts e Cosmos BR). " +
      "Preencha os dados manualmente.",
  };
}
