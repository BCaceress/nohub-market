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
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,categories_tags,image_front_url,product_quantity,quantity`,
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
        brands?: string;
        categories_tags?: string[];
        image_front_url?: string;
        product_quantity?: string;
        quantity?: string;
      };
    };

    if (json.status !== 1 || !json.product) return null;

    const p = json.product;
    const name = (p.product_name ?? "").trim();
    if (!name) return null;

    const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";
    const rawCategory = (p.categories_tags ?? [])[0] ?? "";
    const category = rawCategory.replace(/^[a-z]{2}:/i, "").replace(/-/g, " ");
    const imageUrl = (p.image_front_url ?? "").trim();

    // Parse weight
    let weight: number | undefined;
    const qtyStr = p.product_quantity ?? p.quantity ?? "";
    const qtyMatch = qtyStr.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)/i);
    if (qtyMatch) {
      const num = Number.parseFloat(qtyMatch[1]?.replace(",", ".") ?? "");
      const unit = qtyMatch[2]?.toLowerCase() ?? "";
      if (unit === "g") weight = num;
      else if (unit === "kg") weight = num * 1000;
      else if (unit === "l") weight = num * 1000;
      else if (unit === "ml") weight = num;
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
