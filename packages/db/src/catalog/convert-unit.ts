/**
 * Conversão entre unidades compatíveis (mesma família física).
 * Usado no produto CUSTOM: quantidade da opção é informada na unidade do grupo
 * (ex: "ml"), mas o estoque do insumo pode estar em outra (ex: "L").
 *
 * Famílias:
 *   - Volume (base ml): ML=1, L=1000
 *   - Massa   (base g):  G=1, KG=1000
 *   - Contagem(base un): UN=1, DZ=12, CENTO=100
 *
 * Unidades de embalagem (CX, PCT, FARDO, BANDEJA) não têm fator fixo —
 * tratadas como 1:1 (sem conversão). Famílias incompatíveis → 1:1 (fallback).
 */

const FACTORS: Record<string, { family: string; factor: number }> = {
  ML: { family: "volume", factor: 1 },
  L: { family: "volume", factor: 1000 },
  G: { family: "mass", factor: 1 },
  KG: { family: "mass", factor: 1000 },
  UN: { family: "count", factor: 1 },
  DZ: { family: "count", factor: 12 },
  CENTO: { family: "count", factor: 100 },
};

/**
 * Converte `qty` da unidade `from` para a unidade `to`.
 * Se as unidades forem iguais, de famílias diferentes, ou sem fator conhecido,
 * retorna `qty` inalterado (1:1).
 */
export function convertQuantity(qty: number, from: string, to: string): number {
  if (from === to) return qty;
  const f = FACTORS[from];
  const t = FACTORS[to];
  if (!f || !t || f.family !== t.family) return qty; // incompatível → 1:1
  return (qty * f.factor) / t.factor;
}
