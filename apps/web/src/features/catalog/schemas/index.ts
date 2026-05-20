import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Helpers fiscais
// ─────────────────────────────────────────────────────────────────────

const ncmSchema = z
  .string()
  .regex(/^\d{8}$/, "NCM deve ter exatamente 8 dígitos numéricos"); // RN-C07

const cestSchema = z
  .string()
  .regex(/^\d{7}$/, "CEST deve ter exatamente 7 dígitos numéricos") // RN-C07
  .optional()
  .or(z.literal(""));

const cfopSchema = z
  .string()
  .regex(/^\d{4}$/, "CFOP deve ter 4 dígitos")
  .optional()
  .or(z.literal(""));

const icmsCstValues = ["00","10","20","30","40","41","50","51","60","70","90"] as const;
const icmsCsosnValues = ["101","102","103","201","202","203","300","400","500","900"] as const;

// ─────────────────────────────────────────────────────────────────────
// Categoria
// ─────────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(80),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens")
    .optional(),
  parentId: z.string().cuid().optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).default(0),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// ─────────────────────────────────────────────────────────────────────
// Produto
// ─────────────────────────────────────────────────────────────────────

export const productSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  brand: z.string().max(100).optional().or(z.literal("")),
  sku: z.string().max(50).optional().or(z.literal("")),
  barcode: z.string().max(20).optional().or(z.literal("")),
  tags: z.array(z.string().max(50)).default([]),

  productType: z
    .enum(["SIMPLE", "VARIANT_PARENT", "KIT", "FRACTIONED"])
    .default("SIMPLE"),

  // Unidades
  unit: z.enum(["UN", "KG", "G", "L", "ML", "CX", "PCT"]).default("UN"),
  saleUnit: z.enum(["UN", "KG", "G", "L", "ML", "CX", "PCT"]).default("UN"),
  conversionFactor: z.coerce
    .number()
    .positive("conversionFactor deve ser > 0")
    .default(1),

  // Preço base (simples — canônico em ProductPrice)
  price: z.coerce.number().min(0).default(0),
  costPrice: z.coerce.number().min(0).optional(),

  weight: z.coerce.number().min(0).optional(),
  imageUrl: z.string().url("URL inválida").optional().or(z.literal("")),

  categoryId: z.string().cuid().optional().or(z.literal("")),
  supplierId: z.string().cuid().optional().or(z.literal("")),

  isActive: z.boolean().default(true),
  hasAgeRestriction: z.boolean().default(false),
  minAge: z.coerce.number().int().min(0).max(99).optional(),
  expiryDays: z.coerce.number().int().min(1).optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

// ─────────────────────────────────────────────────────────────────────
// Variante
// ─────────────────────────────────────────────────────────────────────

export const variantSchema = z.object({
  name: z.string().min(1, "Nome da variante obrigatório").max(100),
  sku: z.string().max(50).optional().or(z.literal("")),
  attributes: z.record(z.string()).default({}),
  isActive: z.boolean().default(true),
  position: z.coerce.number().int().min(0).default(0),
});
export type VariantInput = z.infer<typeof variantSchema>;

// ─────────────────────────────────────────────────────────────────────
// Kit component
// ─────────────────────────────────────────────────────────────────────

export const kitComponentSchema = z.object({
  componentProductId: z.string().cuid(),
  componentVariantId: z.string().cuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("Quantidade deve ser positiva"),
  position: z.coerce.number().int().min(0).default(0),
});
export type KitComponentInput = z.infer<typeof kitComponentSchema>;

// ─────────────────────────────────────────────────────────────────────
// Preço dimensional
// ─────────────────────────────────────────────────────────────────────

export const productPriceSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().or(z.literal("")),
  locationId: z.string().cuid().optional().or(z.literal("")),
  channel: z
    .enum(["IFOOD", "WHATSAPP", "MERCADO_LIVRE", "RAPPI", "OWN_ECOMMERCE", "OTHER"])
    .optional()
    .or(z.literal("")),
  price: z.coerce.number().min(0, "Preço inválido"),
  promoPrice: z.coerce.number().min(0).optional(),
  cost: z.coerce.number().min(0).optional(),
  validFrom: z.string().datetime().optional().or(z.literal("")),
  validTo: z.string().datetime().optional().or(z.literal("")),
}).refine(
  (d) => {
    if (d.promoPrice !== undefined && d.validTo === undefined) {
      return false; // promoPrice sem janela de validade é erro
    }
    return true;
  },
  { message: "promoPrice requer validTo", path: ["validTo"] },
);
export type ProductPriceInput = z.infer<typeof productPriceSchema>;

// ─────────────────────────────────────────────────────────────────────
// Fiscal (produto e categoria)
// ─────────────────────────────────────────────────────────────────────

const taxBaseSchema = z.object({
  ncm: ncmSchema,
  cest: cestSchema,
  cfopInternal: cfopSchema,
  cfopInterstate: cfopSchema,

  origin: z
    .enum([
      "NACIONAL",
      "IMPORTADO_DIRETO",
      "IMPORTADO_NACIONAL",
      "NACIONAL_MAIS_40_IMPORTADO",
      "NACIONAL_MENOS_40_IMPORTADO",
      "NACIONAL_SEM_SIMILAR",
      "ESTRANGEIRO_DIRETO",
      "ESTRANGEIRO_NACIONAL",
      "NACIONAL_MENOS_70_IMPORTADO",
    ])
    .default("NACIONAL"),

  icmsCst: z.enum(icmsCstValues).optional().or(z.literal("")),
  icmsCsosn: z.enum(icmsCsosnValues).optional().or(z.literal("")),
  icmsRate: z.coerce.number().min(0).max(100).optional(),

  pisCst: z.string().max(3).optional().or(z.literal("")),
  pisRate: z.coerce.number().min(0).max(100).optional(),
  cofinsCst: z.string().max(3).optional().or(z.literal("")),
  cofinsRate: z.coerce.number().min(0).max(100).optional(),
  unitTaxable: z.boolean().default(true),
});

export const productTaxSchema = taxBaseSchema.extend({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().or(z.literal("")),
});
export type ProductTaxInput = z.infer<typeof productTaxSchema>;

// CategoryTaxDefault doesn't store unitTaxable (that's per-product only)
export const categoryTaxDefaultSchema = taxBaseSchema.omit({ unitTaxable: true }).extend({
  categoryId: z.string().cuid(),
});
export type CategoryTaxDefaultInput = z.infer<typeof categoryTaxDefaultSchema>;

// ─────────────────────────────────────────────────────────────────────
// Barcode
// ─────────────────────────────────────────────────────────────────────

export const barcodeSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().or(z.literal("")),
  barcode: z.string().min(8).max(20),
  type: z.enum(["EAN13", "EAN8", "INTERNAL", "DUN14"]).default("EAN13"),
});
export type BarcodeInput = z.infer<typeof barcodeSchema>;

// ─────────────────────────────────────────────────────────────────────
// Importação
// ─────────────────────────────────────────────────────────────────────

// Uma linha do CSV/XLSX após parse
export const importRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(), // nome da categoria (match ou criação)
  price: z.coerce.number().min(0).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  unit: z.enum(["UN", "KG", "G", "L", "ML", "CX", "PCT"]).default("UN"),
  ncm: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  cest: z
    .string()
    .regex(/^\d{7}$/)
    .optional(),
  cfopInternal: z.string().regex(/^\d{4}$/).optional(),
  description: z.string().optional(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

// Resultado por linha da importação (RN-C12)
export interface ImportRowResult {
  row: number;
  input: Record<string, unknown>;
  success: boolean;
  productId?: string;
  error?: string;
}
