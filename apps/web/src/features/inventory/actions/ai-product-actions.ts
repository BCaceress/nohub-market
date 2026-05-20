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
  source: "open_food_facts";
}

export async function lookupProductByBarcodeAction(
  barcode: string,
): Promise<Result<OpenFoodFactsProduct>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Não autenticado" };

  const cleaned = barcode.trim().replace(/\D/g, "");
  if (cleaned.length < 8 || cleaned.length > 14) {
    return { success: false, error: "Código de barras inválido" };
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${cleaned}?fields=product_name,brands,categories_tags,ingredients_text,image_front_url,product_quantity,quantity`,
      { next: { revalidate: 3600 } },
    );

    if (!res.ok) {
      return { success: false, error: "Produto não encontrado" };
    }

    const json = await res.json();

    if (json.status === 0 || !json.product) {
      return { success: false, error: "Produto não encontrado na base Open Food Facts" };
    }

    const p = json.product;

    const name: string = p.product_name || "";
    const brand: string = (p.brands ?? "").split(",")[0]?.trim() ?? "";
    const rawCategory: string = (p.categories_tags ?? [])[0] ?? "";
    const category = rawCategory.replace(/^[a-z]{2}:/i, "").replace(/-/g, " ");
    const imageUrl: string = p.image_front_url ?? "";

    // Parse weight from quantity string like "500 g" or "1 L"
    let weight: number | undefined;
    const qtyStr: string = p.product_quantity ?? p.quantity ?? "";
    const qtyMatch = qtyStr.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l)/i);
    if (qtyMatch) {
      const num = parseFloat(qtyMatch[1]!.replace(",", "."));
      const unit = qtyMatch[2]!.toLowerCase();
      if (unit === "g") weight = num;
      else if (unit === "kg") weight = num * 1000;
      else if (unit === "l") weight = num * 1000;
      else if (unit === "ml") weight = num;
    }

    // Confidence: high if name + brand + image, medium if name only, low otherwise
    const filled = [name, brand, imageUrl].filter(Boolean).length;
    const confidence: "high" | "medium" | "low" =
      filled >= 3 ? "high" : filled >= 2 ? "medium" : "low";

    if (!name) {
      return { success: false, error: "Produto encontrado mas sem nome — preencha manualmente" };
    }

    return {
      success: true,
      data: {
        barcode: cleaned,
        name,
        brand: brand || undefined,
        category: category || undefined,
        imageUrl: imageUrl || undefined,
        weight,
        confidence,
        source: "open_food_facts",
      },
    };
  } catch (err) {
    console.error("[lookupProductByBarcode]", err);
    return { success: false, error: "Erro ao consultar base de produtos" };
  }
}
