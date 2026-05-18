import "server-only";
import { prisma } from "@nohub/db";

// Etapa 4 — motor de capabilities (RN-06/07/08).

export type ProductCategory =
  | "alcohol"
  | "perishable"
  | "hortifruti"
  | "grocery"
  | "tobacco"
  | "general";

export type BusinessType = "UNMANNED_MARKET" | "CONVENIENCE" | "BEVERAGE" | "HYBRID";

export interface OperationInput {
  businessType: BusinessType;
  productCategories: ProductCategory[];
}

export interface DerivedCapability {
  key: string;
  config?: Record<string, unknown>;
}

// Regras derivadas aplicadas automaticamente a partir das escolhas.
export function deriveCapabilities(input: OperationInput): DerivedCapability[] {
  const caps = new Map<string, DerivedCapability>();
  const add = (key: string, config?: Record<string, unknown>) => caps.set(key, { key, config });
  const cats = new Set(input.productCategories);

  if (cats.has("alcohol")) {
    add("product.age_restriction", { minAge: 18 }); // RN-06
    add("product.time_restriction", { reason: "lei_seca" });
  }
  if (cats.has("perishable") || cats.has("hortifruti")) {
    add("product.expiry_tracking"); // RN-07
  }
  if (cats.has("hortifruti")) {
    add("product.fractioned_sale");
  }
  if (input.businessType === "UNMANNED_MARKET") {
    add("operation.unmanned"); // RN-08
    add("operation.24h");
  }
  if (input.businessType === "CONVENIENCE" || input.businessType === "BEVERAGE") {
    add("operation.pos");
  }
  return [...caps.values()];
}

export async function getCapabilities(
  organizationId: string,
): Promise<Map<string, Record<string, unknown> | null>> {
  const rows = await prisma.organizationCapability.findMany({
    where: { organizationId, enabled: true },
  });
  return new Map(rows.map((r) => [r.key, (r.config as Record<string, unknown>) ?? null]));
}

export async function hasCapability(organizationId: string, key: string): Promise<boolean> {
  const row = await prisma.organizationCapability.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  return !!row?.enabled;
}

// Guard de servidor — bloqueia recurso não habilitado.
export async function requireCapability(organizationId: string, key: string) {
  if (!(await hasCapability(organizationId, key))) {
    throw new Error(`CAPABILITY_REQUIRED:${key}`);
  }
}
