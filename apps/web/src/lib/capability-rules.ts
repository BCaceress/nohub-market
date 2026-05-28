// Regras puras de capabilities por segmento (sem server-only/Prisma) — testáveis.
// RN: cada conta tem UM segmento. Capabilities derivam dele + estrutura de estoque.
// Omnichannel (iFood, ML, Amazon, WhatsApp, ecommerce próprio) NÃO derivam do segmento —
// são módulos ativáveis por qualquer conta via /app/channels.

export type SegmentType = "BEVERAGE_CONVENIENCE" | "SUPERMARKET" | "UNMANNED_MARKET";

export type StockStructureType = "LOCAL" | "CENTRAL_DC" | "HYBRID";

export interface OperationInput {
  segmentType: SegmentType;
  stockStructureType: StockStructureType;
  storeCount: number;
}

export interface DerivedCapability {
  key: string;
  config?: Record<string, unknown>;
}

// Matriz fixa de capabilities por segmento.
// Cada segmento é um perfil opinionated — sem mistura de regras.
const SEGMENT_CAPS: Record<SegmentType, string[]> = {
  BEVERAGE_CONVENIENCE: [
    "operation.pos",
    "operation.fast_checkout",
    "operation.delivery",
    "catalog.whatsapp_share",
    "pricing.multi_price",
    "pricing.promotions",
    "product.age_restriction",
    "product.time_restriction",
    "inventory.quick_count",
  ],
  SUPERMARKET: [
    "operation.pos",
    "operation.continuous_pos",
    "product.expiry_tracking",
    "product.fractioned_sale",
    "inventory.min_stock_alerts",
    "inventory.replenishment",
    "inventory.full_count",
    "inventory.sectors",
    "purchasing.suggestions",
    "purchasing.quotations",
    "catalog.large_volume",
  ],
  UNMANNED_MARKET: [
    "operation.unmanned",
    "operation.self_service",
    "operation.24h",
    "operation.qr_checkout",
    "operation.app_integration",
    "operation.remote_monitoring",
    "operation.access_control",
    "product.age_restriction",
  ],
};

// Capabilities derivadas da estrutura de estoque — ortogonal ao segmento.
function stockStructureCaps(s: StockStructureType, storeCount: number): string[] {
  const out: string[] = [];
  if (s === "CENTRAL_DC" || s === "HYBRID") {
    out.push("operation.central_dc");
    out.push("operation.central_receiving");
  }
  if (s === "HYBRID") {
    out.push("operation.local_stock");
  }
  if (s === "LOCAL") {
    out.push("operation.local_stock");
  }
  if (storeCount > 1) {
    out.push("operation.multi_location");
    out.push("inventory.transfers");
  }
  return out;
}

// Configs adicionais por capability quando precisa parametrizar.
function capConfig(key: string): Record<string, unknown> | undefined {
  switch (key) {
    case "product.age_restriction":
      return { minAge: 18 };
    case "product.time_restriction":
      return { reason: "lei_seca" };
    default:
      return undefined;
  }
}

export function deriveCapabilities(input: OperationInput): DerivedCapability[] {
  const keys = new Set<string>([
    ...SEGMENT_CAPS[input.segmentType],
    ...stockStructureCaps(input.stockStructureType, input.storeCount),
  ]);
  return [...keys].map((key) => ({ key, config: capConfig(key) }));
}

// Lista canônica de canais omnichannel ativáveis pós-onboarding.
// Independe do segmento — qualquer conta pode ativar qualquer canal.
export const OMNICHANNEL_CHANNELS = [
  "IFOOD",
  "WHATSAPP",
  "MERCADO_LIVRE",
  "RAPPI",
  "OWN_ECOMMERCE",
  "OTHER",
] as const;
