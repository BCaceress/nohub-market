/**
 * Converte quantidade de venda → quantidade de estoque (RN-C11).
 *
 * Produto unitário:  conversionFactor = 1, stockUnit = saleUnit → stockQty = saleQty
 * Produto fracionado: ex. presunto vende por "g" (saleUnit), estoque em "kg" (stockUnit)
 *   conversionFactor = 0.001  (1 g = 0.001 kg)
 *   stockQty = saleQty × conversionFactor
 *
 * @param conversionFactor  Obtido de product.conversionFactor (já como Number)
 * @param saleQty           Quantidade na unidade de venda
 * @returns                 Quantidade na unidade de estoque
 */
export function toStockQuantity(conversionFactor: number, saleQty: number): number {
  if (conversionFactor <= 0) {
    throw new Error("conversionFactor deve ser > 0 (RN-C11)");
  }
  return saleQty * conversionFactor;
}

/**
 * Inverso: converte quantidade de estoque → quantidade de venda.
 */
export function toSaleQuantity(conversionFactor: number, stockQty: number): number {
  if (conversionFactor <= 0) {
    throw new Error("conversionFactor deve ser > 0 (RN-C11)");
  }
  return stockQty / conversionFactor;
}

/**
 * Formata uma quantidade com a unidade correta.
 */
export function formatQuantity(qty: number, unit: string): string {
  const locale = "pt-BR";
  const fmtOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: unit === "KG" || unit === "L" ? 3 : 0,
  };
  return `${qty.toLocaleString(locale, fmtOptions)} ${unit.toLowerCase()}`;
}
