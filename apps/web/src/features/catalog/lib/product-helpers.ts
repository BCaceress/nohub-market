/**
 * Helpers puros do cadastro de produto — sem dependência de servidor.
 * Geração de SKU sequencial vive em actions/product-actions (precisa do DB).
 */

export type CategoryLite = {
  id: string;
  name: string;
  parentId: string | null;
  hasAgeRestriction?: boolean;
  storageTemperature?: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
  controlsExpiry?: boolean;
  controlsLot?: boolean;
};

export const UNIT_OPTIONS = [
  { value: "UN", label: "Unidade (un)" },
  { value: "CX", label: "Caixa (cx)" },
  { value: "FARDO", label: "Fardo (fd)" },
  { value: "KG", label: "Quilograma (kg)" },
  { value: "G", label: "Grama (g)" },
  { value: "L", label: "Litro (l)" },
  { value: "ML", label: "Mililitro (ml)" },
  { value: "PCT", label: "Pacote (pct)" },
  { value: "DZ", label: "Dúzia (dz)" },
  { value: "BANDEJA", label: "Bandeja" },
  { value: "CENTO", label: "Cento" },
] as const;

/**
 * Normaliza nome de marca para Title Case canônico.
 * "FRUKI" / "fruki" → "Fruki"; "coca-cola" → "Coca-Cola".
 * Garante dedupe consistente (uma marca = uma grafia).
 */
export function normalizeBrandName(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s\-/])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** Margem percentual sobre o preço de venda. null quando indefinível. */
export function calcMargin(cost: number, price: number): number | null {
  if (!(price > 0) || !(cost > 0)) return null;
  return ((price - cost) / price) * 100;
}

export type InheritedProfile = {
  hasAgeRestriction: boolean;
  storageTemperature: "AMBIENTE" | "REFRIGERADO" | "CONGELADO" | null;
  controlsExpiry: boolean;
  controlsLot: boolean;
};

/** Resolve o perfil herdável efetivo subindo a árvore de categorias. */
export function resolveInheritedProfile(
  categories: CategoryLite[],
  categoryId: string,
): InheritedProfile {
  const chain: CategoryLite[] = [];
  let current = categories.find((c) => c.id === categoryId);
  for (let i = 0; current && i < 10; i++) {
    chain.push(current);
    const parentId = current.parentId;
    current = parentId ? categories.find((c) => c.id === parentId) : undefined;
  }
  const firstDefined = <T>(get: (c: CategoryLite) => T | null | undefined): T | null => {
    for (const c of chain) {
      const v = get(c);
      if (v != null) return v;
    }
    return null;
  };
  return {
    hasAgeRestriction: chain.some((c) => c.hasAgeRestriction),
    storageTemperature: firstDefined((c) => c.storageTemperature),
    controlsExpiry: firstDefined((c) => c.controlsExpiry) ?? false,
    controlsLot: firstDefined((c) => c.controlsLot) ?? false,
  };
}

export type InheritedBadgeKind =
  | "age"
  | "ambiente"
  | "refrigerado"
  | "congelado"
  | "expiry"
  | "lot";

export type InheritedBadge = { kind: InheritedBadgeKind; label: string };

/** Badges do perfil herdado — `kind` mapeia para ícone lucide na UI. */
export function inheritedBadges(profile: InheritedProfile): InheritedBadge[] {
  const out: InheritedBadge[] = [];
  if (profile.hasAgeRestriction) out.push({ kind: "age", label: "+18" });
  if (profile.storageTemperature === "AMBIENTE") out.push({ kind: "ambiente", label: "Ambiente" });
  else if (profile.storageTemperature === "REFRIGERADO")
    out.push({ kind: "refrigerado", label: "Refrigerado" });
  else if (profile.storageTemperature === "CONGELADO")
    out.push({ kind: "congelado", label: "Congelado" });
  if (profile.controlsExpiry) out.push({ kind: "expiry", label: "Controla validade" });
  if (profile.controlsLot) out.push({ kind: "lot", label: "Controla lote" });
  return out;
}
